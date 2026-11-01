from __future__ import annotations

import base64
import copy
import json
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any
import xml.etree.ElementTree as ET

import yaml

from fastapi import APIRouter, HTTPException, Request, Response

from backend.app.connectors.mapper import (
    extract_path,
    extract_records,
)
from backend.app.connectors.parser import (
    parse_response,
)


router = APIRouter(
    prefix="/mock",
    tags=["Generated Mock Security Integrations"],
)


HERE = Path(__file__).resolve().parent

BUNDLE_ROOT = (
    HERE
    / "generated-integrations"
    / "cyberforge_mock_security_integrations"
)

DEPLOY_CONFIG_DIRECTORY = (
    HERE
    / "generated-integrations"
    / "deployment-configs"
)


ENTITY_SEGMENTS = {
    "users": "user",
    "devices": "device",
    "events": "event",
}


def _parse_iso(value: str) -> datetime:
    candidate = str(value).strip()

    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="since must be a valid ISO timestamp",
        ) from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(
            tzinfo=timezone.utc
        )

    return parsed


def _mock_secret(secret_ref: str) -> str:
    """
    Deterministic synthetic mock credential.

    This is NOT a real credential.
    The same convention will later be used when we
    populate CyberForge's encrypted demo vault.
    """

    return (
        "cfmock-"
        + secret_ref.lower().replace("_", "-")
    )


def _check_auth(
    request: Request,
    auth: dict[str, Any],
) -> None:

    auth_type = auth.get("type", "none")

    if auth_type == "none":
        return

    if auth_type == "bearer":
        secret_ref = auth["secret_ref"]

        expected = (
            "Bearer "
            + _mock_secret(secret_ref)
        )

        actual = request.headers.get(
            "Authorization"
        )

        if actual != expected:
            raise HTTPException(
                status_code=401,
                detail="Invalid bearer credential",
            )

        return

    if auth_type == "api_key":
        header = auth["header"]
        secret_ref = auth["secret_ref"]

        expected = _mock_secret(
            secret_ref
        )

        actual = request.headers.get(
            header
        )

        if actual != expected:
            raise HTTPException(
                status_code=401,
                detail="Invalid API key",
            )

        return

    if auth_type == "basic":
        username_ref = auth[
            "username_ref"
        ]

        password_ref = auth[
            "password_ref"
        ]

        expected_username = (
            _mock_secret(username_ref)
        )

        expected_password = (
            _mock_secret(password_ref)
        )

        authorization = request.headers.get(
            "Authorization"
        )

        if not authorization:
            raise HTTPException(
                status_code=401,
                detail="Missing Basic authorization",
            )

        prefix = "Basic "

        if not authorization.startswith(prefix):
            raise HTTPException(
                status_code=401,
                detail="Invalid Basic authorization",
            )

        try:
            decoded = base64.b64decode(
                authorization[len(prefix):]
            ).decode("utf-8")

            username, password = (
                decoded.split(":", 1)
            )

        except Exception:
            raise HTTPException(
                status_code=401,
                detail="Invalid Basic authorization",
            )

        if (
            username != expected_username
            or password != expected_password
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid Basic credentials",
            )

        return

    if auth_type == "custom_headers":
        secret_headers = auth.get(
            "secret_headers",
            {},
        )

        for header, secret_ref in (
            secret_headers.items()
        ):
            expected = _mock_secret(
                secret_ref
            )

            actual = request.headers.get(
                header
            )

            if actual != expected:
                raise HTTPException(
                    status_code=401,
                    detail=(
                        "Invalid custom-header credential"
                    ),
                )

        return

    raise HTTPException(
        status_code=500,
        detail="Unsupported generated mock auth type",
    )


def _vendor_slug_from_dataset(
    dataset_path: str,
) -> str:

    parts = Path(dataset_path).parts

    try:
        index = parts.index("data")
        return parts[index + 1]

    except (ValueError, IndexError):
        raise RuntimeError(
            "Invalid generated dataset path"
        )


@lru_cache(maxsize=1)
def _catalog() -> dict[
    tuple[str, str],
    dict[str, Any],
]:

    manifest_path = (
        BUNDLE_ROOT / "manifest.json"
    )

    manifest = json.loads(
        manifest_path.read_text(
            encoding="utf-8"
        )
    )

    catalog: dict[
        tuple[str, str],
        dict[str, Any],
    ] = {}

    for entry in manifest:
        original_config_path = (
            BUNDLE_ROOT
            / entry["connector_config"]
        )

        deploy_config_path = (
            DEPLOY_CONFIG_DIRECTORY
            / original_config_path.name
        )

        config = yaml.safe_load(
            deploy_config_path.read_text(
                encoding="utf-8"
            )
        )

        vendor_slug = (
            _vendor_slug_from_dataset(
                entry["dataset_file"]
            )
        )

        entity = config[
            "mapping"
        ]["entity"]

        key = (
            vendor_slug,
            entity,
        )

        if key in catalog:
            raise RuntimeError(
                f"Duplicate generated mock route: {key}"
            )

        catalog[key] = {
            "manifest": entry,
            "config": config,
        }

    return catalog


def _apply_pagination(
    records: list[Any],
    config: dict[str, Any],
    request: Request,
) -> list[Any]:

    pagination = config["pagination"]

    kind = pagination["type"]

    if kind == "page":
        page_param = pagination[
            "page_param"
        ]

        limit_param = pagination.get(
            "limit_param"
        )

        start_page = pagination.get(
            "start_page",
            1,
        )

        try:
            page = int(
                request.query_params.get(
                    page_param,
                    start_page,
                )
            )

            limit = int(
                request.query_params.get(
                    limit_param,
                    pagination["page_size"],
                )
            )

        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail="Invalid page pagination parameters",
            )

        if page < start_page:
            raise HTTPException(
                status_code=400,
                detail="Invalid page value",
            )

        if limit < 1 or limit > 500:
            raise HTTPException(
                status_code=400,
                detail="Invalid limit value",
            )

        start = (
            page - start_page
        ) * limit

        end = start + limit

        return records[start:end]

    if kind == "offset":
        offset_param = pagination[
            "offset_param"
        ]

        limit_param = pagination[
            "limit_param"
        ]

        try:
            offset = int(
                request.query_params.get(
                    offset_param,
                    0,
                )
            )

            limit = int(
                request.query_params.get(
                    limit_param,
                    pagination["page_size"],
                )
            )

        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail="Invalid offset pagination parameters",
            )

        if offset < 0:
            raise HTTPException(
                status_code=400,
                detail="Invalid offset value",
            )

        if limit < 1 or limit > 500:
            raise HTTPException(
                status_code=400,
                detail="Invalid limit value",
            )

        return records[
            offset:offset + limit
        ]

    raise HTTPException(
        status_code=500,
        detail="Unsupported mock pagination type",
    )


def _filter_since(
    records: list[Any],
    source_field: str,
    request: Request,
    request_param: str,
) -> list[Any]:

    since = request.query_params.get(
        request_param
    )

    if not since:
        return records

    cutoff = _parse_iso(
        since
    )

    filtered = []

    for record in records:
        try:
            raw_value = extract_path(
                record,
                source_field,
            )

            record_time = _parse_iso(
                str(raw_value)
            )

        except Exception:
            continue

        if record_time > cutoff:
            filtered.append(record)

    return filtered


def _set_path(
    payload: dict[str, Any],
    path: str,
    value: Any,
) -> None:

    parts = path.split(".")

    current: Any = payload

    for part in parts[:-1]:
        if (
            not isinstance(current, dict)
            or part not in current
        ):
            raise HTTPException(
                status_code=500,
                detail="Invalid generated records path",
            )

        current = current[part]

    if not isinstance(current, dict):
        raise HTTPException(
            status_code=500,
            detail="Invalid generated records path",
        )

    current[parts[-1]] = value


def _serve_json_or_yaml(
    dataset_path: Path,
    config: dict[str, Any],
    request: Request,
) -> Response:

    response_config = config[
        "response"
    ]

    fmt = response_config[
        "format"
    ]

    raw_text = dataset_path.read_text(
        encoding="utf-8"
    )

    parsed = parse_response(
        raw_text,
        fmt,
    )

    records = extract_records(
        parsed,
        response_config[
            "records_path"
        ],
    )

    records = list(records)

    incremental = config[
        "incremental"
    ]

    if incremental.get(
        "enabled",
        False,
    ):
        records = _filter_since(
            records,
            incremental[
                "source_field"
            ],
            request,
            incremental[
                "request_param"
            ],
        )

    records = _apply_pagination(
        records,
        config,
        request,
    )

    result = copy.deepcopy(
        parsed
    )

    _set_path(
        result,
        response_config[
            "records_path"
        ],
        records,
    )

    if fmt == "json":
        return Response(
            content=json.dumps(
                result,
                ensure_ascii=False,
            ),
            media_type="application/json",
        )

    return Response(
        content=yaml.safe_dump(
            result,
            sort_keys=False,
            allow_unicode=True,
        ),
        media_type="application/yaml",
    )


def _xml_find_parent(
    root: ET.Element,
    records_path: str,
) -> tuple[
    ET.Element,
    str,
]:

    parts = records_path.split(".")

    if parts and parts[0] == root.tag:
        parts = parts[1:]

    if not parts:
        raise HTTPException(
            status_code=500,
            detail="Invalid XML records path",
        )

    current = root

    for part in parts[:-1]:
        child = current.find(part)

        if child is None:
            raise HTTPException(
                status_code=500,
                detail="Invalid XML records path",
            )

        current = child

    return current, parts[-1]


def _xml_extract(
    element: ET.Element,
    path: str,
) -> str | None:

    parts = path.split(".")

    current = element

    if parts and parts[0] == element.tag:
        parts = parts[1:]

    for part in parts:
        child = current.find(part)

        if child is None:
            return None

        current = child

    return current.text


def _serve_xml(
    dataset_path: Path,
    config: dict[str, Any],
    request: Request,
) -> Response:

    try:
        root = ET.fromstring(
            dataset_path.read_text(
                encoding="utf-8"
            )
        )
    except ET.ParseError as exc:
        raise HTTPException(
            status_code=500,
            detail="Generated XML dataset invalid",
        ) from exc

    response_config = config[
        "response"
    ]

    parent, record_tag = (
        _xml_find_parent(
            root,
            response_config[
                "records_path"
            ],
        )
    )

    records = list(
        parent.findall(record_tag)
    )

    incremental = config[
        "incremental"
    ]

    if incremental.get(
        "enabled",
        False,
    ):
        since = request.query_params.get(
            incremental[
                "request_param"
            ]
        )

        if since:
            cutoff = _parse_iso(
                since
            )

            filtered = []

            for record in records:
                value = _xml_extract(
                    record,
                    incremental[
                        "source_field"
                    ],
                )

                if not value:
                    continue

                try:
                    item_time = _parse_iso(
                        value
                    )
                except HTTPException:
                    continue

                if item_time > cutoff:
                    filtered.append(record)

            records = filtered

    pagination = config[
        "pagination"
    ]

    if pagination["type"] == "page":

        page = int(
            request.query_params.get(
                pagination["page_param"],
                pagination.get(
                    "start_page",
                    1,
                ),
            )
        )

        limit = int(
            request.query_params.get(
                pagination.get(
                    "limit_param"
                ),
                pagination["page_size"],
            )
        )

        start_page = pagination.get(
            "start_page",
            1,
        )

        start = (
            page - start_page
        ) * limit

        records = records[
            start:start + limit
        ]

    elif pagination["type"] == "offset":

        offset = int(
            request.query_params.get(
                pagination[
                    "offset_param"
                ],
                0,
            )
        )

        limit = int(
            request.query_params.get(
                pagination[
                    "limit_param"
                ],
                pagination["page_size"],
            )
        )

        records = records[
            offset:offset + limit
        ]

    else:
        raise HTTPException(
            status_code=500,
            detail="Unsupported XML pagination type",
        )

    # Remove original record elements only.
    for original in list(
        parent.findall(record_tag)
    ):
        parent.remove(original)

    # Append only this page's records.
    for record in records:
        parent.append(record)

    xml_body = ET.tostring(
        root,
        encoding="unicode",
    )

    return Response(
        content=xml_body,
        media_type="application/xml",
    )


@router.get("/_catalog")
def generated_mock_catalog():
    """
    Non-secret inventory of generated mock integrations.
    """

    rows = []

    for (
        vendor_slug,
        entity,
    ), item in sorted(
        _catalog().items()
    ):
        config = item["config"]

        rows.append(
            {
                "vendor": vendor_slug,
                "entity": entity,
                "connector": config["name"],
                "format": config[
                    "response"
                ]["format"],
                "auth": config[
                    "auth"
                ]["type"],
                "pagination": config[
                    "pagination"
                ]["type"],
                "path": config[
                    "endpoint"
                ]["path"],
            }
        )

    return {
        "count": len(rows),
        "integrations": rows,
    }


@router.get(
    "/{vendor_slug}/{entity_segment}"
)
def generated_mock_endpoint(
    vendor_slug: str,
    entity_segment: str,
    request: Request,
):

    entity = ENTITY_SEGMENTS.get(
        entity_segment
    )

    if entity is None:
        raise HTTPException(
            status_code=404,
            detail="Unknown generated mock entity",
        )

    item = _catalog().get(
        (
            vendor_slug,
            entity,
        )
    )

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Generated mock integration not found",
        )

    config = item[
        "config"
    ]

    manifest = item[
        "manifest"
    ]

    _check_auth(
        request,
        config["auth"],
    )

    dataset_path = (
        BUNDLE_ROOT
        / manifest[
            "dataset_file"
        ]
    )

    if not dataset_path.exists():
        raise HTTPException(
            status_code=500,
            detail="Generated mock dataset not found",
        )

    fmt = config[
        "response"
    ]["format"]

    if fmt in {
        "json",
        "yaml",
    }:
        return _serve_json_or_yaml(
            dataset_path,
            config,
            request,
        )

    if fmt == "xml":
        return _serve_xml(
            dataset_path,
            config,
            request,
        )

    raise HTTPException(
        status_code=500,
        detail="Unsupported generated mock format",
    )
