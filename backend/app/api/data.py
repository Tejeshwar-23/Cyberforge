from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    Query,
)
from sqlalchemy import (
    func,
    or_,
    select,
)

from backend.app.db.database import (
    SessionLocal,
)
from backend.app.db.models import (
    NormalizedDevice,
    NormalizedEvent,
    NormalizedUser,
)
from backend.app.security.auth import (
    require_roles,
)


router = APIRouter(
    prefix="/api/data",
    tags=["Normalized Data"],
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


def _pagination(
    *,
    total: int,
    offset: int,
    limit: int,
    returned: int,
) -> dict[str, int]:
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "returned": returned,
    }


def _filters(
    *,
    source: str | None,
    q: str | None,
) -> dict[str, str | None]:
    return {
        "source": source,
        "q": q,
    }


@router.get("/summary")
def normalized_data_summary():
    """
    Return normalized common-schema record counts.
    """

    with SessionLocal() as session:

        users = session.scalar(
            select(
                func.count(
                    NormalizedUser.id
                )
            )
        ) or 0

        devices = session.scalar(
            select(
                func.count(
                    NormalizedDevice.id
                )
            )
        ) or 0

        events = session.scalar(
            select(
                func.count(
                    NormalizedEvent.id
                )
            )
        ) or 0

        user_sources = session.execute(
            select(
                NormalizedUser.source,
                func.count(
                    NormalizedUser.id
                ),
            )
            .group_by(
                NormalizedUser.source
            )
            .order_by(
                NormalizedUser.source
            )
        ).all()

        device_sources = session.execute(
            select(
                NormalizedDevice.source,
                func.count(
                    NormalizedDevice.id
                ),
            )
            .group_by(
                NormalizedDevice.source
            )
            .order_by(
                NormalizedDevice.source
            )
        ).all()

        event_sources = session.execute(
            select(
                NormalizedEvent.source,
                func.count(
                    NormalizedEvent.id
                ),
            )
            .group_by(
                NormalizedEvent.source
            )
            .order_by(
                NormalizedEvent.source
            )
        ).all()

    return {
        "counts": {
            "users": users,
            "devices": devices,
            "events": events,
            "total": (
                users
                + devices
                + events
            ),
        },
        "source_breakdown": {
            "users": [
                {
                    "source": source,
                    "count": count,
                }
                for source, count
                in user_sources
            ],
            "devices": [
                {
                    "source": source,
                    "count": count,
                }
                for source, count
                in device_sources
            ],
            "events": [
                {
                    "source": source,
                    "count": count,
                }
                for source, count
                in event_sources
            ],
        },
        "common_schema": {
            "user": [
                "id",
                "name",
                "email",
                "status",
                "source",
                "last_login",
            ],
            "device": [
                "id",
                "hostname",
                "ip",
                "os",
                "owner",
                "source",
                "last_seen",
            ],
            "event": [
                "id",
                "type",
                "severity",
                "timestamp",
                "description",
                "source",
            ],
        },
    }


@router.get("/users")
def normalized_users(
    source: str | None = Query(
        default=None,
        min_length=1,
        max_length=200,
    ),
    q: str | None = Query(
        default=None,
        min_length=1,
        max_length=200,
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
):
    filters: list[Any] = []

    if source:
        filters.append(
            NormalizedUser.source
            == source
        )

    if q:
        term = f"%{q}%"

        filters.append(
            or_(
                NormalizedUser.id.ilike(
                    term
                ),
                NormalizedUser.name.ilike(
                    term
                ),
                NormalizedUser.email.ilike(
                    term
                ),
                NormalizedUser.status.ilike(
                    term
                ),
                NormalizedUser.source.ilike(
                    term
                ),
            )
        )

    with SessionLocal() as session:

        count_stmt = select(
            func.count(
                NormalizedUser.id
            )
        )

        data_stmt = select(
            NormalizedUser
        )

        if filters:
            count_stmt = count_stmt.where(
                *filters
            )

            data_stmt = data_stmt.where(
                *filters
            )

        total = session.scalar(
            count_stmt
        ) or 0

        rows = session.scalars(
            data_stmt
            .order_by(
                NormalizedUser.source,
                NormalizedUser.id,
            )
            .offset(offset)
            .limit(limit)
        ).all()

    items = [
        {
            "id": row.id,
            "name": row.name,
            "email": row.email,
            "status": row.status,
            "source": row.source,
            "last_login": row.last_login,
        }
        for row in rows
    ]

    return {
        "items": items,
        "pagination": _pagination(
            total=total,
            offset=offset,
            limit=limit,
            returned=len(items),
        ),
        "filters": _filters(
            source=source,
            q=q,
        ),
    }


@router.get("/devices")
def normalized_devices(
    source: str | None = Query(
        default=None,
        min_length=1,
        max_length=200,
    ),
    q: str | None = Query(
        default=None,
        min_length=1,
        max_length=200,
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
):
    filters: list[Any] = []

    if source:
        filters.append(
            NormalizedDevice.source
            == source
        )

    if q:
        term = f"%{q}%"

        filters.append(
            or_(
                NormalizedDevice.id.ilike(
                    term
                ),
                NormalizedDevice.hostname.ilike(
                    term
                ),
                NormalizedDevice.ip.ilike(
                    term
                ),
                NormalizedDevice.os.ilike(
                    term
                ),
                NormalizedDevice.owner.ilike(
                    term
                ),
                NormalizedDevice.source.ilike(
                    term
                ),
            )
        )

    with SessionLocal() as session:

        count_stmt = select(
            func.count(
                NormalizedDevice.id
            )
        )

        data_stmt = select(
            NormalizedDevice
        )

        if filters:
            count_stmt = count_stmt.where(
                *filters
            )

            data_stmt = data_stmt.where(
                *filters
            )

        total = session.scalar(
            count_stmt
        ) or 0

        rows = session.scalars(
            data_stmt
            .order_by(
                NormalizedDevice.source,
                NormalizedDevice.id,
            )
            .offset(offset)
            .limit(limit)
        ).all()

    items = [
        {
            "id": row.id,
            "hostname": row.hostname,
            "ip": row.ip,
            "os": row.os,
            "owner": row.owner,
            "source": row.source,
            "last_seen": row.last_seen,
        }
        for row in rows
    ]

    return {
        "items": items,
        "pagination": _pagination(
            total=total,
            offset=offset,
            limit=limit,
            returned=len(items),
        ),
        "filters": _filters(
            source=source,
            q=q,
        ),
    }


@router.get("/events")
def normalized_events(
    source: str | None = Query(
        default=None,
        min_length=1,
        max_length=200,
    ),
    q: str | None = Query(
        default=None,
        min_length=1,
        max_length=200,
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
):
    filters: list[Any] = []

    if source:
        filters.append(
            NormalizedEvent.source
            == source
        )

    if q:
        term = f"%{q}%"

        filters.append(
            or_(
                NormalizedEvent.id.ilike(
                    term
                ),
                NormalizedEvent.type.ilike(
                    term
                ),
                NormalizedEvent.severity.ilike(
                    term
                ),
                NormalizedEvent.description.ilike(
                    term
                ),
                NormalizedEvent.source.ilike(
                    term
                ),
            )
        )

    with SessionLocal() as session:

        count_stmt = select(
            func.count(
                NormalizedEvent.id
            )
        )

        data_stmt = select(
            NormalizedEvent
        )

        if filters:
            count_stmt = count_stmt.where(
                *filters
            )

            data_stmt = data_stmt.where(
                *filters
            )

        total = session.scalar(
            count_stmt
        ) or 0

        rows = session.scalars(
            data_stmt
            .order_by(
                NormalizedEvent.source,
                NormalizedEvent.id,
            )
            .offset(offset)
            .limit(limit)
        ).all()

    items = [
        {
            "id": row.id,
            "type": row.type,
            "severity": row.severity,
            "timestamp": row.timestamp,
            "description": row.description,
            "source": row.source,
        }
        for row in rows
    ]

    return {
        "items": items,
        "pagination": _pagination(
            total=total,
            offset=offset,
            limit=limit,
            returned=len(items),
        ),
        "filters": _filters(
            source=source,
            q=q,
        ),
    }
