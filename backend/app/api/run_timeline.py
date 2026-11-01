import json

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy import select

from backend.app.db.database import (
    SessionLocal,
)
from backend.app.db.models import (
    ConnectorRun,
    ConnectorRunEvent,
)
from backend.app.security.auth import (
    require_roles,
)


router = APIRouter(
    prefix="/api/connectors/runs",
    tags=["Connector Run Timeline"],
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


def _run_summary(run: ConnectorRun) -> dict:
    return {
        "run_id": run.id,
        "connector": run.connector_name,
        "status": run.status,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "http_status": run.http_status,
        "pagination_type": (
            run.pagination_type
        ),
        "page_count": run.page_count,
        "records_received": (
            run.records_received
        ),
        "records_normalized": (
            run.records_normalized
        ),
        "records_quarantined": (
            run.records_quarantined
        ),
        "error_type": run.error_type,
        "last_error": run.last_error,
    }


@router.get("/{run_id}")
def connector_run_detail(
    run_id: int,
):
    with SessionLocal() as session:
        run = session.get(
            ConnectorRun,
            run_id,
        )

        if run is None:
            raise HTTPException(
                status_code=404,
                detail="Connector run not found",
            )

        return _run_summary(run)


@router.get("/{run_id}/timeline")
def connector_run_timeline(
    run_id: int,
):
    with SessionLocal() as session:
        run = session.get(
            ConnectorRun,
            run_id,
        )

        if run is None:
            raise HTTPException(
                status_code=404,
                detail="Connector run not found",
            )

        events = session.scalars(
            select(
                ConnectorRunEvent
            )
            .where(
                ConnectorRunEvent.run_id
                == run_id
            )
            .order_by(
                ConnectorRunEvent.id
            )
        ).all()

        items = []

        for event in events:

            details = None

            if event.details_json:
                try:
                    details = json.loads(
                        event.details_json
                    )
                except Exception:
                    details = None

            items.append(
                {
                    "event_id": event.id,
                    "stage": event.stage,
                    "status": event.status,
                    "message": event.message,
                    "details": details,
                    "occurred_at": (
                        event.occurred_at
                    ),
                }
            )

        return {
            "run": _run_summary(
                run
            ),
            "events": items,
            "event_count": len(
                items
            ),
        }
