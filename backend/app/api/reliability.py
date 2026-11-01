import json
from pathlib import Path
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
)
from sqlalchemy import (
    func,
    select,
)

from backend.app.connectors.loader import (
    validate_connector_config,
)
from backend.app.connectors.parser import (
    ResponseParseError,
    parse_response,
)
from backend.app.connectors.processor import (
    process_records,
)
from backend.app.connectors.test_connection import (
    find_connector_config,
)
from backend.app.db.database import (
    SessionLocal,
)
from backend.app.db.models import (
    AppUser,
    QuarantinedRecord,
)
from backend.app.security.audit import (
    write_security_audit,
)
from backend.app.security.auth import (
    require_roles,
)


router = APIRouter(
    prefix="/api",
    tags=["Reliability"],
)


PROJECT_ROOT = Path(__file__).resolve().parents[3]

BAD_FIXTURE_ROOT = (
    PROJECT_ROOT
    / "mock-services"
    / "generated-integrations"
    / "cyberforge_mock_security_integrations"
    / "tests"
    / "fixtures"
    / "bad-records"
)


ENTITY_SUFFIX = {
    "user": "-users",
    "device": "-devices",
    "event": "-events",
}


class ReliabilityLabError(Exception):
    pass


def _client_ip(
    request: Request,
) -> str:
    if request.client is None:
        return "unknown"

    return request.client.host[:64]


def _source_id(
    connector_name: str,
    entity: str,
) -> str:

    suffix = ENTITY_SUFFIX.get(
        entity
    )

    if suffix is None:
        raise ReliabilityLabError(
            f"Unsupported entity: {entity}"
        )

    if not connector_name.endswith(
        suffix
    ):
        raise ReliabilityLabError(
            "Connector name does not match "
            "its entity type"
        )

    return connector_name[
        :-len(suffix)
    ]


def _fixture_for_config(
    config,
) -> Path:

    source = _source_id(
        config.name,
        config.mapping.entity,
    )

    directory = (
        BAD_FIXTURE_ROOT
        / source
    )

    pattern = (
        f"*_{config.mapping.entity}s_bad.*"
    )

    matches = sorted(
        path
        for path in directory.glob(
            pattern
        )
        if path.is_file()
    )

    if len(matches) != 1:
        raise ReliabilityLabError(
            f"Expected exactly one bad fixture "
            f"for {config.name}, found "
            f"{len(matches)}"
        )

    return matches[0]


def _extract_records(
    parsed: Any,
    records_path: str | None,
) -> list[dict[str, Any]]:

    current = parsed

    if records_path:
        for part in records_path.split("."):

            if not isinstance(
                current,
                dict,
            ):
                raise ReliabilityLabError(
                    "Response records path "
                    "could not be traversed"
                )

            if part not in current:
                raise ReliabilityLabError(
                    "Response records path "
                    f"not found: {records_path}"
                )

            current = current[
                part
            ]

    if current is None:
        return []

    if isinstance(
        current,
        list,
    ):
        records = current

    elif isinstance(
        current,
        dict,
    ):
        records = [
            current
        ]

    else:
        raise ReliabilityLabError(
            "Resolved response records "
            "are not an object or list"
        )

    for item in records:
        if not isinstance(
            item,
            dict,
        ):
            raise ReliabilityLabError(
                "Fixture contains a record "
                "that is not an object"
            )

    return records


def _fixture_inventory() -> list[dict]:

    rows = []

    if not BAD_FIXTURE_ROOT.exists():
        return rows

    for vendor_dir in sorted(
        path
        for path in BAD_FIXTURE_ROOT.iterdir()
        if path.is_dir()
    ):
        for fixture in sorted(
            path
            for path in vendor_dir.iterdir()
            if path.is_file()
            and path.suffix.lower()
            in {
                ".json",
                ".yaml",
                ".yml",
                ".xml",
            }
        ):
            rows.append(
                {
                    "source_id": (
                        vendor_dir.name
                    ),
                    "fixture": (
                        fixture.name
                    ),
                    "format": (
                        fixture.suffix
                        .lower()
                        .lstrip(".")
                    ),
                }
            )

    return rows


# ==================================================
# QUARANTINE READ API
# ==================================================

@router.get("/quarantine")
def quarantine_records(
    connector: str | None = Query(
        default=None,
        min_length=1,
        max_length=255,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
    ),
    user: AppUser = Depends(
        require_roles(
            "viewer",
            "operator",
            "admin",
        )
    ),
):
    """
    Return quarantined-record metadata.

    Full raw source payloads are deliberately not
    returned. A bounded preview is provided instead.
    """

    with SessionLocal() as session:

        count_stmt = select(
            func.count(
                QuarantinedRecord.id
            )
        )

        data_stmt = select(
            QuarantinedRecord
        )

        if connector:
            count_stmt = count_stmt.where(
                QuarantinedRecord.connector_name
                == connector
            )

            data_stmt = data_stmt.where(
                QuarantinedRecord.connector_name
                == connector
            )

        total = session.scalar(
            count_stmt
        ) or 0

        rows = session.scalars(
            data_stmt
            .order_by(
                QuarantinedRecord.id.desc()
            )
            .offset(offset)
            .limit(limit)
        ).all()

    items = []

    for row in rows:

        raw = row.raw_record or ""

        if len(raw) > 1000:
            preview = (
                raw[:1000]
                + "..."
            )
        else:
            preview = raw

        items.append(
            {
                "id": row.id,
                "connector": (
                    row.connector_name
                ),
                "record_index": (
                    row.record_index
                ),
                "error": row.error,
                "raw_record_preview": (
                    preview
                ),
                "quarantined_at": (
                    row.quarantined_at
                ),
            }
        )

    return {
        "items": items,
        "pagination": {
            "total": total,
            "offset": offset,
            "limit": limit,
            "returned": len(items),
        },
        "filters": {
            "connector": connector,
        },
    }


@router.get("/quarantine/summary")
def quarantine_summary(
    user: AppUser = Depends(
        require_roles(
            "viewer",
            "operator",
            "admin",
        )
    ),
):
    with SessionLocal() as session:

        total = session.scalar(
            select(
                func.count(
                    QuarantinedRecord.id
                )
            )
        ) or 0

        grouped = session.execute(
            select(
                QuarantinedRecord.connector_name,
                func.count(
                    QuarantinedRecord.id
                ),
            )
            .group_by(
                QuarantinedRecord.connector_name
            )
            .order_by(
                func.count(
                    QuarantinedRecord.id
                ).desc()
            )
        ).all()

    return {
        "total": total,
        "connectors": [
            {
                "connector": connector,
                "count": count,
            }
            for connector, count
            in grouped
        ],
    }


# ==================================================
# RELIABILITY LAB
# ==================================================

@router.get("/reliability/fixtures")
def reliability_fixtures(
    user: AppUser = Depends(
        require_roles(
            "viewer",
            "operator",
            "admin",
        )
    ),
):
    fixtures = (
        _fixture_inventory()
    )

    return {
        "fixture_count": len(
            fixtures
        ),
        "fixtures": fixtures,
    }


@router.post(
    "/reliability/bad-record-test/"
    "{connector_name}"
)
def bad_record_test(
    connector_name: str,
    request: Request,
    user: AppUser = Depends(
        require_roles(
            "operator",
            "admin",
        )
    ),
):
    """
    Process one repo-local malformed-record fixture
    using CyberForge's normal parser and mapper.

    Valid records are NOT persisted by the lab.
    Quarantined failures ARE persisted so they can be
    inspected through the Quarantine UI.
    """

    config_path = (
        find_connector_config(
            connector_name
        )
    )

    if config_path is None:
        raise HTTPException(
            status_code=404,
            detail="Connector not found",
        )

    try:
        config = (
            validate_connector_config(
                config_path
            )
        )

        fixture = (
            _fixture_for_config(
                config
            )
        )

        content = fixture.read_text(
            encoding="utf-8"
        )

        parsed = parse_response(
            content,
            config.response.format,
        )

        records = _extract_records(
            parsed,
            config.response.records_path,
        )

        processed = process_records(
            records,
            config.mapping,
            config.name,
        )

    except ResponseParseError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "error_type": (
                    "FIXTURE_PARSE_ERROR"
                ),
                "message": str(exc),
            },
        ) from exc

    except ReliabilityLabError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "error_type": (
                    "RELIABILITY_LAB_ERROR"
                ),
                "message": str(exc),
            },
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Reliability test failed safely"
            ),
        ) from exc


    # --------------------------------------------------
    # Persist quarantine ONLY.
    #
    # Normalized records from intentionally malformed
    # fixtures are never written into production common
    # schema tables by Reliability Lab.
    # --------------------------------------------------

    persisted_quarantine = 0

    if processed[
        "quarantined"
    ]:

        with SessionLocal() as session:

            for item in processed[
                "quarantined"
            ]:

                session.add(
                    QuarantinedRecord(
                        connector_name=(
                            config.name
                        ),
                        record_index=(
                            item[
                                "record_index"
                            ]
                        ),
                        error=(
                            item["error"]
                        ),
                        raw_record=(
                            json.dumps(
                                item[
                                    "raw_record"
                                ],
                                default=str,
                            )
                        ),
                    )
                )

                persisted_quarantine += 1

            session.commit()


    write_security_audit(
        action=(
            "reliability.bad_record_test"
        ),
        outcome="success",
        username=user.username,
        actor_user_id=user.id,
        client_ip=_client_ip(
            request
        ),
        detail=(
            "Bad-record reliability test: "
            + config.name[:180]
            + " quarantined="
            + str(
                processed[
                    "quarantined_count"
                ]
            )
        ),
    )


    issues = [
        {
            "record_index": (
                item["record_index"]
            ),
            "error": (
                item["error"]
            ),
        }
        for item in processed[
            "quarantined"
        ]
    ]


    return {
        "success": True,
        "lab_mode": True,
        "connector": config.name,
        "entity": (
            config.mapping.entity
        ),
        "fixture": fixture.name,
        "fixture_format": (
            config.response.format
        ),
        "records_received": (
            processed[
                "total_received"
            ]
        ),
        "records_normalized": (
            processed[
                "normalized_count"
            ]
        ),
        "records_quarantined": (
            processed[
                "quarantined_count"
            ]
        ),
        "connector_crashed": False,
        "valid_records_persisted": False,
        "quarantine_records_persisted": (
            persisted_quarantine
        ),
        "issues": issues,
    }
