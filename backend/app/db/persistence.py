import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from backend.app.connectors.common_schema import (
    DeviceRecord,
    EventRecord,
    UserRecord,
)
from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    ConnectorRun,
    ConnectorSyncState,
    NormalizedDevice,
    NormalizedEvent,
    NormalizedUser,
    QuarantinedRecord,
)


def utc_now():
    return datetime.now(timezone.utc)


def get_connector_sync_state(
    connector_name: str,
) -> str | None:
    with SessionLocal() as session:
        state = session.scalar(
            select(ConnectorSyncState).where(
                ConnectorSyncState.connector_name == connector_name
            )
        )

        if state is None:
            return None

        return state.last_value


def start_connector_run(
    connector_name: str,
) -> int:
    with SessionLocal() as session:
        run = ConnectorRun(
            connector_name=connector_name,
            status="running",
        )

        session.add(run)
        session.commit()
        session.refresh(run)

        return run.id


def _upsert_user(session, record: UserRecord) -> None:
    existing = session.scalar(
        select(NormalizedUser).where(
            NormalizedUser.source == record.source,
            NormalizedUser.id == record.id,
        )
    )

    if existing:
        existing.name = record.name
        existing.email = record.email
        existing.status = record.status
        existing.last_login = record.last_login
        existing.fetched_at = utc_now()
        return

    session.add(
        NormalizedUser(
            id=record.id,
            name=record.name,
            email=record.email,
            status=record.status,
            source=record.source,
            last_login=record.last_login,
        )
    )


def _upsert_device(
    session,
    record: DeviceRecord,
) -> None:
    existing = session.scalar(
        select(NormalizedDevice).where(
            NormalizedDevice.source == record.source,
            NormalizedDevice.id == record.id,
        )
    )

    if existing:
        existing.hostname = record.hostname
        existing.ip = record.ip
        existing.os = record.os
        existing.owner = record.owner
        existing.last_seen = record.last_seen
        existing.fetched_at = utc_now()
        return

    session.add(
        NormalizedDevice(
            id=record.id,
            hostname=record.hostname,
            ip=record.ip,
            os=record.os,
            owner=record.owner,
            source=record.source,
            last_seen=record.last_seen,
        )
    )


def _upsert_event(
    session,
    record: EventRecord,
) -> None:
    existing = session.scalar(
        select(NormalizedEvent).where(
            NormalizedEvent.source == record.source,
            NormalizedEvent.id == record.id,
        )
    )

    if existing:
        existing.type = record.type
        existing.severity = record.severity
        existing.timestamp = record.timestamp
        existing.description = record.description
        existing.fetched_at = utc_now()
        return

    session.add(
        NormalizedEvent(
            id=record.id,
            type=record.type,
            severity=record.severity,
            timestamp=record.timestamp,
            description=record.description,
            source=record.source,
        )
    )


def persist_successful_run(
    run_id: int,
    result: dict[str, Any],
    checkpoint_value: str | None = None,
) -> None:
    with SessionLocal() as session:
        run = session.get(
            ConnectorRun,
            run_id,
        )

        if run is None:
            raise RuntimeError(
                f"Connector run {run_id} does not exist"
            )

        for record in result["normalized"]:
            if isinstance(record, UserRecord):
                _upsert_user(
                    session,
                    record,
                )

            elif isinstance(record, DeviceRecord):
                _upsert_device(
                    session,
                    record,
                )

            elif isinstance(record, EventRecord):
                _upsert_event(
                    session,
                    record,
                )

            else:
                raise RuntimeError(
                    "Unknown normalized record type"
                )

        for item in result["quarantined"]:
            session.add(
                QuarantinedRecord(
                    connector_name=result["connector"],
                    record_index=item["record_index"],
                    error=item["error"],
                    raw_record=json.dumps(
                        item["raw_record"],
                        default=str,
                    ),
                )
            )

        run.status = "healthy"
        run.completed_at = utc_now()
        run.http_status = result["http_status"]
        run.pagination_type = result[
            "pagination_type"
        ]
        run.page_count = result["page_count"]
        run.records_received = result[
            "total_received"
        ]
        run.records_normalized = result[
            "normalized_count"
        ]
        run.records_quarantined = result[
            "quarantined_count"
        ]
        run.last_error = None
        run.error_type = None

        if checkpoint_value is not None:
            state = session.scalar(
                select(ConnectorSyncState).where(
                    ConnectorSyncState.connector_name
                    == result["connector"]
                )
            )

            if state is None:
                session.add(
                    ConnectorSyncState(
                        connector_name=result["connector"],
                        last_value=checkpoint_value,
                        updated_at=utc_now(),
                    )
                )

            elif state.last_value != checkpoint_value:
                state.last_value = checkpoint_value
                state.updated_at = utc_now()

        session.commit()


def persist_failed_run(
    run_id: int,
    error_message: str,
    *,
    error_type: str | None = None,
    http_status: int | None = None,
) -> None:
    with SessionLocal() as session:
        run = session.get(
            ConnectorRun,
            run_id,
        )

        if run is None:
            return

        run.status = "failed"
        run.completed_at = utc_now()
        run.last_error = error_message
        run.error_type = error_type
        run.http_status = http_status

        session.commit()
