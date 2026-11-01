from collections import defaultdict
from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
)

from backend.app.connectors.loader import (
    validate_connector_config,
)
from backend.app.connectors.schema import (
    ConnectorConfig,
)
from backend.app.db.models import AppUser
from backend.app.security.audit import (
    write_security_audit,
)
from backend.app.security.auth import (
    require_roles,
)


router = APIRouter(
    prefix="/api/catalog",
    tags=["Integration Catalog"],
    dependencies=[
        Depends(
            require_roles(
                "viewer",
                "operator",
                "admin",
            )
        )
    ],
)


PROJECT_ROOT = Path(__file__).resolve().parents[3]

CATALOG_CONFIG_DIRECTORY = (
    PROJECT_ROOT
    / "mock-services"
    / "generated-integrations"
    / "deployment-configs"
)


DISPLAY_NAMES = {
    "cisco-secure-firewall": (
        "Cisco Secure Firewall"
    ),
    "cortex-xsiam": (
        "Palo Alto Cortex XSIAM"
    ),
    "crowdstrike-cloud-security": (
        "CrowdStrike Cloud Security"
    ),
    "elastic-security": (
        "Elastic Security"
    ),
    "fortinet-fortigate": (
        "Fortinet FortiGate"
    ),
    "netskope": (
        "Netskope"
    ),
    "prisma-cloud": (
        "Prisma Cloud"
    ),
    "sophos-intercept-x": (
        "Sophos Intercept X"
    ),
    "trend-micro-vision-one": (
        "Trend Micro Vision One"
    ),
    "wiz": (
        "Wiz"
    ),
}


ENTITY_ORDER = {
    "user": 0,
    "device": 1,
    "event": 2,
}


def _source_id_from_connector(
    connector_name: str,
    entity: str,
) -> str:
    suffix_by_entity = {
        "user": "-users",
        "device": "-devices",
        "event": "-events",
    }

    suffix = suffix_by_entity.get(entity)

    if suffix is None:
        raise ValueError(
            f"Unsupported connector entity: {entity}"
        )

    if not connector_name.endswith(suffix):
        raise ValueError(
            "Connector name does not match "
            f"its entity suffix: {connector_name}"
        )

    source_id = connector_name[
        : -len(suffix)
    ]

    if not source_id:
        raise ValueError(
            "Unable to determine source id"
        )

    return source_id


def _connector_summary(
    config,
) -> dict[str, Any]:
    return {
        "connector": config.name,
        "entity": config.mapping.entity,
        "description": config.description,
        "auth_type": config.auth.type,
        "response_format": (
            config.response.format
        ),
        "pagination_type": (
            config.pagination.type
        ),
        "schedule_every_minutes": (
            config.schedule.every_minutes
        ),
        "incremental_enabled": (
            config.incremental.enabled
        ),
        "enabled": config.enabled,
    }


def _load_catalog() -> list[dict[str, Any]]:
    if not CATALOG_CONFIG_DIRECTORY.exists():
        raise RuntimeError(
            "Integration catalog directory "
            "does not exist"
        )

    grouped: dict[
        str,
        list[dict[str, Any]],
    ] = defaultdict(list)

    config_paths = sorted(
        list(
            CATALOG_CONFIG_DIRECTORY.glob(
                "*.yaml"
            )
        )
        + list(
            CATALOG_CONFIG_DIRECTORY.glob(
                "*.yml"
            )
        )
    )

    for path in config_paths:
        config = validate_connector_config(
            path
        )

        source_id = (
            _source_id_from_connector(
                config.name,
                config.mapping.entity,
            )
        )

        grouped[source_id].append(
            _connector_summary(config)
        )

    sources: list[dict[str, Any]] = []

    for source_id, connectors in grouped.items():

        connectors.sort(
            key=lambda item: ENTITY_ORDER[
                item["entity"]
            ]
        )

        entities = sorted(
            {
                item["entity"]
                for item in connectors
            },
            key=lambda value: ENTITY_ORDER[
                value
            ],
        )

        auth_types = sorted(
            {
                item["auth_type"]
                for item in connectors
            }
        )

        response_formats = sorted(
            {
                item["response_format"]
                for item in connectors
            }
        )

        pagination_types = sorted(
            {
                item["pagination_type"]
                for item in connectors
            }
        )

        enabled_count = sum(
            1
            for item in connectors
            if item["enabled"]
        )

        sources.append(
            {
                "source_id": source_id,
                "display_name": (
                    DISPLAY_NAMES.get(
                        source_id,
                        source_id,
                    )
                ),
                "vendor_style": True,
                "available": True,
                "connector_count": len(
                    connectors
                ),
                "enabled_connector_count": (
                    enabled_count
                ),
                "entities": entities,
                "auth_types": auth_types,
                "response_formats": (
                    response_formats
                ),
                "pagination_types": (
                    pagination_types
                ),
                "connectors": connectors,
            }
        )

    sources.sort(
        key=lambda item: (
            item["display_name"].lower()
        )
    )

    return sources


@router.get("/sources")
def list_sources():
    """
    Return available vendor-style integration
    sources derived from validated connector
    configuration templates.
    """

    try:
        sources = _load_catalog()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to load integration "
                "catalog"
            ),
        ) from exc

    return sources


@router.get("/sources/{source_id}")
def get_source(
    source_id: str,
):
    """
    Return detailed connector capabilities for
    one source.
    """

    try:
        sources = _load_catalog()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to load integration "
                "catalog"
            ),
        ) from exc

    for source in sources:
        if source["source_id"] == source_id:
            return source

    raise HTTPException(
        status_code=404,
        detail="Integration source not found",
    )



# ==================================================
# STAGE 2: IN-MEMORY CONFIG VALIDATION
# ==================================================

MAX_CONFIG_UPLOAD_BYTES = 256 * 1024


def _required_secret_refs(
    config: ConnectorConfig,
) -> list[str]:
    auth = config.auth

    refs: list[str] = []

    if auth.type in {
        "api_key",
        "bearer",
    }:
        refs.append(
            auth.secret_ref
        )

    elif auth.type == "basic":
        refs.extend(
            [
                auth.username_ref,
                auth.password_ref,
            ]
        )

    elif auth.type == "custom_headers":
        refs.extend(
            auth.secret_headers.values()
        )

    return sorted(
        set(refs)
    )


def _safe_schema_errors(
    exc: ValidationError,
) -> list[dict[str, Any]]:
    safe_errors = []

    for error in exc.errors():
        safe_errors.append(
            {
                "location": [
                    str(part)
                    for part in error.get(
                        "loc",
                        (),
                    )
                ],
                "message": error.get(
                    "msg",
                    "Invalid value",
                ),
                "type": error.get(
                    "type",
                    "validation_error",
                ),
            }
        )

    return safe_errors


def _safe_config_preview(
    config: ConnectorConfig,
    source_id: str,
    display_name: str,
    filename: str,
) -> dict[str, Any]:

    pagination = config.pagination
    incremental = config.incremental

    return {
        "valid": True,
        "saved": False,
        "activated": False,
        "filename": filename,
        "source_id": source_id,
        "display_name": display_name,
        "connector": config.name,
        "description": config.description,
        "entity": config.mapping.entity,
        "enabled": config.enabled,
        "auth_type": config.auth.type,
        "required_secret_refs": (
            _required_secret_refs(config)
        ),
        "endpoint": {
            "method": (
                config.endpoint.method
            ),
            "path": (
                config.endpoint.path
            ),
        },
        "response": {
            "format": (
                config.response.format
            ),
            "records_path": (
                config.response.records_path
            ),
        },
        "pagination": {
            "type": pagination.type,
            "page_size": getattr(
                pagination,
                "page_size",
                None,
            ),
            "page_param": getattr(
                pagination,
                "page_param",
                None,
            ),
            "offset_param": getattr(
                pagination,
                "offset_param",
                None,
            ),
            "limit_param": getattr(
                pagination,
                "limit_param",
                None,
            ),
            "has_more_path": getattr(
                pagination,
                "has_more_path",
                None,
            ),
        },
        "schedule": {
            "every_minutes": (
                config.schedule.every_minutes
            ),
        },
        "incremental": {
            "enabled": (
                incremental.enabled
            ),
            "type": (
                incremental.type
            ),
            "request_param": (
                incremental.request_param
            ),
            "source_field": (
                incremental.source_field
            ),
        },
        "mapping": {
            "entity": (
                config.mapping.entity
            ),
            "field_count": len(
                config.mapping.fields
            ),
            "fields": dict(
                config.mapping.fields
            ),
        },
    }


@router.post(
    "/sources/{source_id}/validate-config"
)
async def validate_uploaded_config(
    source_id: str,
    request: Request,
    file: UploadFile = File(...),
    user: AppUser = Depends(
        require_roles(
            "operator",
            "admin",
        )
    ),
):
    """
    Validate an uploaded CyberForge YAML connector
    configuration entirely in memory.

    This endpoint does NOT:
    - save the configuration
    - activate the connector
    - write secret values
    - modify the filesystem
    """

    # ----------------------------------------------
    # Verify selected catalog source exists
    # ----------------------------------------------

    try:
        sources = _load_catalog()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to load integration "
                "catalog"
            ),
        ) from exc

    selected_source = next(
        (
            item
            for item in sources
            if item["source_id"] == source_id
        ),
        None,
    )

    if selected_source is None:
        raise HTTPException(
            status_code=404,
            detail="Integration source not found",
        )


    # ----------------------------------------------
    # Filename validation
    # ----------------------------------------------

    filename = (
        file.filename
        or "uploaded.yaml"
    )

    suffix = Path(
        filename
    ).suffix.lower()

    if suffix not in {
        ".yaml",
        ".yml",
    }:
        raise HTTPException(
            status_code=415,
            detail=(
                "Connector configuration must "
                "be a .yaml or .yml file"
            ),
        )


    # ----------------------------------------------
    # Read bounded upload
    # ----------------------------------------------

    raw_bytes = await file.read(
        MAX_CONFIG_UPLOAD_BYTES + 1
    )

    if not raw_bytes:
        raise HTTPException(
            status_code=422,
            detail="Uploaded configuration is empty",
        )

    if (
        len(raw_bytes)
        > MAX_CONFIG_UPLOAD_BYTES
    ):
        raise HTTPException(
            status_code=413,
            detail=(
                "Connector configuration exceeds "
                "the 256 KiB upload limit"
            ),
        )


    # ----------------------------------------------
    # UTF-8 decode
    # ----------------------------------------------

    try:
        text = raw_bytes.decode(
            "utf-8"
        )

    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                "Connector configuration must "
                "be UTF-8 encoded"
            ),
        ) from exc


    # ----------------------------------------------
    # Safe YAML parsing
    # ----------------------------------------------

    try:
        payload = yaml.safe_load(
            text
        )

    except yaml.YAMLError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "valid": False,
                "error_type": (
                    "YAML_PARSE_ERROR"
                ),
                "message": (
                    "Uploaded file is not "
                    "valid YAML"
                ),
            },
        ) from exc

    if not isinstance(
        payload,
        dict,
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "valid": False,
                "error_type": (
                    "CONFIG_STRUCTURE_ERROR"
                ),
                "message": (
                    "Connector configuration "
                    "must be a YAML object"
                ),
            },
        )


    # ----------------------------------------------
    # Pydantic connector schema validation
    # ----------------------------------------------

    try:
        config = (
            ConnectorConfig.model_validate(
                payload
            )
        )

    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "valid": False,
                "error_type": (
                    "CONFIG_VALIDATION_ERROR"
                ),
                "message": (
                    "Connector configuration "
                    "failed schema validation"
                ),
                "errors": (
                    _safe_schema_errors(exc)
                ),
            },
        ) from exc


    # ----------------------------------------------
    # Verify config belongs to selected source
    # ----------------------------------------------

    try:
        uploaded_source_id = (
            _source_id_from_connector(
                config.name,
                config.mapping.entity,
            )
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "valid": False,
                "error_type": (
                    "CONNECTOR_IDENTITY_ERROR"
                ),
                "message": str(exc),
            },
        ) from exc


    if uploaded_source_id != source_id:
        raise HTTPException(
            status_code=409,
            detail={
                "valid": False,
                "error_type": (
                    "SOURCE_MISMATCH"
                ),
                "message": (
                    "Uploaded configuration "
                    "does not belong to the "
                    "selected integration source"
                ),
                "selected_source_id": (
                    source_id
                ),
                "uploaded_source_id": (
                    uploaded_source_id
                ),
            },
        )


    # ----------------------------------------------
    # Verify entity connector exists for template
    # ----------------------------------------------

    expected_connectors = {
        item["connector"]
        for item in selected_source[
            "connectors"
        ]
    }

    if (
        config.name
        not in expected_connectors
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "valid": False,
                "error_type": (
                    "CONNECTOR_TEMPLATE_MISMATCH"
                ),
                "message": (
                    "Uploaded connector is not "
                    "one of the available "
                    "templates for this source"
                ),
            },
        )


    # ----------------------------------------------
    # Audit successful validation
    # ----------------------------------------------

    client_ip = (
        request.client.host[:64]
        if request.client
        else "unknown"
    )

    write_security_audit(
        action="connector.config_validate",
        outcome="success",
        username=user.username,
        actor_user_id=user.id,
        client_ip=client_ip,
        detail=(
            "Validated connector config: "
            + config.name[:200]
        ),
    )


    # ----------------------------------------------
    # SAFE PREVIEW ONLY
    # ----------------------------------------------

    return _safe_config_preview(
        config,
        source_id,
        selected_source[
            "display_name"
        ],
        filename,
    )
