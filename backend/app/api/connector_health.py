from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from backend.app.db.database import SessionLocal
from backend.app.db.models import ConnectorRun
from backend.app.security.auth import require_roles


router = APIRouter(
    prefix="/api/connectors",
    tags=["Connectors"],
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


@router.get("/health")
def connector_health():
    """
    Return the latest health state for every connector.
    """

    with SessionLocal() as session:
        runs = session.scalars(
            select(ConnectorRun).order_by(
                ConnectorRun.started_at.desc()
            )
        ).all()

        latest = {}

        for run in runs:
            if run.connector_name not in latest:
                latest[run.connector_name] = run

        return [
            {
                "connector": run.connector_name,
                "status": run.status,
                "last_run": run.started_at,
                "completed_at": run.completed_at,
                "records_pulled": run.records_received,
                "records_normalized": run.records_normalized,
                "records_quarantined": run.records_quarantined,
                "http_status": run.http_status,
                "pagination_type": run.pagination_type,
                "page_count": run.page_count,
                "error_type": run.error_type,
                "last_error": run.last_error,
            }
            for run in latest.values()
        ]


@router.get("/runs")
def connector_runs(
    limit: int = Query(
        default=50,
        ge=1,
        le=500,
    ),
):
    """
    Return recent connector execution history.
    """

    with SessionLocal() as session:
        runs = session.scalars(
            select(ConnectorRun)
            .order_by(
                ConnectorRun.started_at.desc()
            )
            .limit(limit)
        ).all()

        return [
            {
                "run_id": run.id,
                "connector": run.connector_name,
                "status": run.status,
                "started_at": run.started_at,
                "completed_at": run.completed_at,
                "records_received": run.records_received,
                "records_normalized": run.records_normalized,
                "records_quarantined": run.records_quarantined,
                "http_status": run.http_status,
                "pagination_type": run.pagination_type,
                "page_count": run.page_count,
                "error_type": run.error_type,
                "last_error": run.last_error,
            }
            for run in runs
        ]
