from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy import (
    func,
    select,
)

from backend.app.connectors.loader import (
    validate_connector_config,
)
from backend.app.db.database import (
    SessionLocal,
)
from backend.app.db.models import (
    AppUser,
    ConnectorRun,
    NormalizedDevice,
    NormalizedEvent,
    NormalizedUser,
    QuarantinedRecord,
    SecurityAuditLog,
)
from backend.app.security.auth import (
    require_roles,
)


router = APIRouter(
    tags=["Overview"],
)


PROJECT_ROOT = (
    Path(__file__).resolve().parents[3]
)

CONNECTOR_ROOT = (
    PROJECT_ROOT
    / "configs"
    / "connectors"
)

CATALOG_CONFIG_ROOT = (
    PROJECT_ROOT
    / "mock-services"
    / "generated-integrations"
    / "deployment-configs"
)


def _catalog_summary() -> dict:

    files = sorted(
        CATALOG_CONFIG_ROOT.glob(
            "*.yaml"
        )
    )

    source_ids = set()

    for path in files:

        stem = path.stem

        for suffix in (
            "-users",
            "-devices",
            "-events",
        ):

            if stem.endswith(
                suffix
            ):
                source_ids.add(
                    stem[
                        :-len(suffix)
                    ]
                )
                break

    return {
        "sources": len(
            source_ids
        ),
        "connector_templates": len(
            files
        ),
    }


def _configured_connectors() -> dict:

    paths = sorted(
        list(
            CONNECTOR_ROOT.glob(
                "*.yaml"
            )
        )
        + list(
            CONNECTOR_ROOT.glob(
                "*.yml"
            )
        )
    )

    valid = 0
    invalid = 0
    enabled = 0
    disabled = 0

    entity_counts = Counter()

    for path in paths:

        try:
            config = (
                validate_connector_config(
                    path
                )
            )

        except Exception:
            invalid += 1
            continue

        valid += 1

        if config.enabled:
            enabled += 1
        else:
            disabled += 1

        entity_counts[
            config.mapping.entity
        ] += 1


    return {
        "total_files": len(
            paths
        ),
        "valid": valid,
        "invalid": invalid,
        "enabled": enabled,
        "disabled": disabled,
        "entity_counts": dict(
            entity_counts
        ),
    }


def _run_item(
    run: ConnectorRun,
) -> dict:

    duration = None

    if (
        run.started_at
        and run.completed_at
    ):

        duration = max(
            (
                run.completed_at
                - run.started_at
            ).total_seconds(),
            0.0,
        )


    return {
        "run_id": run.id,
        "connector": (
            run.connector_name
        ),
        "status": run.status,
        "started_at": (
            run.started_at
        ),
        "completed_at": (
            run.completed_at
        ),
        "duration_seconds": (
            round(
                duration,
                3,
            )
            if duration
            is not None
            else None
        ),
        "http_status": (
            run.http_status
        ),
        "records_received": (
            run.records_received
        ),
        "records_normalized": (
            run.records_normalized
        ),
        "records_quarantined": (
            run.records_quarantined
        ),
        "page_count": (
            run.page_count
        ),
        "error_type": (
            run.error_type
        ),
    }


@router.get("/api/overview")
def overview(
    user: AppUser = Depends(
        require_roles(
            "viewer",
            "operator",
            "admin",
        )
    ),
):

    with SessionLocal() as session:

        # --------------------------------------
        # Normalized data
        # --------------------------------------

        users = (
            session.scalar(
                select(
                    func.count(
                        NormalizedUser.id
                    )
                )
            )
            or 0
        )

        devices = (
            session.scalar(
                select(
                    func.count(
                        NormalizedDevice.id
                    )
                )
            )
            or 0
        )

        events = (
            session.scalar(
                select(
                    func.count(
                        NormalizedEvent.id
                    )
                )
            )
            or 0
        )

        quarantine = (
            session.scalar(
                select(
                    func.count(
                        QuarantinedRecord.id
                    )
                )
            )
            or 0
        )


        # --------------------------------------
        # Run history
        # --------------------------------------

        runs = list(
            session.scalars(
                select(
                    ConnectorRun
                )
                .order_by(
                    ConnectorRun.id
                )
            ).all()
        )


        recent_runs = list(
            reversed(
                runs[-8:]
            )
        )


        # Latest run per connector.
        latest_by_connector = {}

        for run in runs:

            latest_by_connector[
                run.connector_name
            ] = run


        latest_runs = list(
            latest_by_connector.values()
        )


        latest_health = Counter(
            run.status
            for run in latest_runs
        )


        # --------------------------------------
        # ML readiness
        # --------------------------------------

        healthy_runs = [
            run
            for run in runs
            if run.status == "healthy"
        ]


        idle_samples = sum(
            1
            for run in healthy_runs
            if (
                run.records_received
                or 0
            )
            == 0
        )


        sync_samples = sum(
            1
            for run in healthy_runs
            if (
                run.records_received
                or 0
            )
            > 0
        )


        minimum_samples = 15

        idle_available = (
            idle_samples
            >= minimum_samples
        )

        sync_available = (
            sync_samples
            >= minimum_samples
        )


        # --------------------------------------
        # Self-heal
        # --------------------------------------

        heal_rows = list(
            session.scalars(
                select(
                    SecurityAuditLog
                )
                .where(
                    SecurityAuditLog.action
                    == "self_heal.auto"
                )
                .order_by(
                    SecurityAuditLog.id
                )
            ).all()
        )


        heal_counts = Counter(
            row.outcome
            for row in heal_rows
        )


        latest_heal = (
            heal_rows[-1]
            if heal_rows
            else None
        )


    catalog = (
        _catalog_summary()
    )

    configured = (
        _configured_connectors()
    )


    return {
        "generated_at": (
            datetime.now(
                timezone.utc
            )
        ),

        "catalog": {
            "sources": (
                catalog[
                    "sources"
                ]
            ),
            "connector_templates": (
                catalog[
                    "connector_templates"
                ]
            ),
        },

        "configured_connectors": (
            configured
        ),

        "data": {
            "users": users,
            "devices": devices,
            "events": events,
            "normalized_total": (
                users
                + devices
                + events
            ),
            "quarantine": (
                quarantine
            ),
        },

        "runs": {
            "total": len(
                runs
            ),
            "healthy": sum(
                1
                for run in runs
                if run.status
                == "healthy"
            ),
            "failed": sum(
                1
                for run in runs
                if run.status
                == "failed"
            ),
            "connectors_with_history": (
                len(
                    latest_by_connector
                )
            ),
            "latest_health": {
                "healthy": (
                    latest_health.get(
                        "healthy",
                        0,
                    )
                ),
                "failed": (
                    latest_health.get(
                        "failed",
                        0,
                    )
                ),
                "other": (
                    len(
                        latest_runs
                    )
                    - latest_health.get(
                        "healthy",
                        0,
                    )
                    - latest_health.get(
                        "failed",
                        0,
                    )
                ),
            },
            "recent": [
                _run_item(
                    run
                )
                for run
                in recent_runs
            ],
        },

        "self_heal": {
            "audit_events": (
                len(
                    heal_rows
                )
            ),
            "applied": (
                heal_counts.get(
                    "applied",
                    0,
                )
            ),
            "verified": (
                heal_counts.get(
                    "verified",
                    0,
                )
            ),
            "rolled_back": (
                heal_counts.get(
                    "rolled_back",
                    0,
                )
            ),
            "not_applied": (
                heal_counts.get(
                    "not_applied",
                    0,
                )
            ),
            "latest_event_at": (
                latest_heal.occurred_at
                if latest_heal
                else None
            ),
        },

        "intelligence": {
            "operational_risk": {
                "available": (
                    len(runs) > 0
                ),
                "endpoint": (
                    "/api/risk/summary"
                ),
            },
            "ml_anomaly": {
                "strategy": (
                    "regime_aware_"
                    "isolation_forest"
                ),
                "minimum_samples_per_regime": (
                    minimum_samples
                ),
                "idle_incremental": {
                    "available": (
                        idle_available
                    ),
                    "healthy_samples": (
                        idle_samples
                    ),
                },
                "data_sync": {
                    "available": (
                        sync_available
                    ),
                    "healthy_samples": (
                        sync_samples
                    ),
                },
                "fully_available": (
                    idle_available
                    and sync_available
                ),
                "endpoint": (
                    "/api/risk/summary"
                ),
            },
        },

        "links": {
            "catalog": (
                "/api/catalog/sources"
            ),
            "health": (
                "/api/connectors/health"
            ),
            "runs": (
                "/api/connectors/runs"
            ),
            "quarantine": (
                "/api/quarantine"
            ),
            "self_heal": (
                "/api/self-heal/summary"
            ),
            "risk": (
                "/api/risk/summary"
            ),
        },
    }
