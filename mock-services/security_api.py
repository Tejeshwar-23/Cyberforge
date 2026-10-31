from fastapi import FastAPI, Header, Response
from fastapi.responses import JSONResponse


app = FastAPI(
    title="CyberForge Mock Security API",
    version="1.0.0",
)


state = {
    "flaky_calls": 0,
    "rate_limit_calls": 0,
}


@app.get("/events")
def events():
    return {
        "events": [
            {
                "eventId": "M001",
                "priority": "high",
                "createdAt": "2026-10-31T10:30:00Z",
                "message": "Mock suspicious login",
            },
            {
                "eventId": "M002",
                "priority": "medium",
                "createdAt": "2026-10-31T10:31:00Z",
                "message": "Mock endpoint alert",
            },
        ]
    }


@app.get("/flaky")
def flaky():
    state["flaky_calls"] += 1

    if state["flaky_calls"] <= 2:
        return JSONResponse(
            status_code=500,
            content={
                "error": "Temporary server failure",
                "attempt": state["flaky_calls"],
            },
        )

    return {
        "status": "recovered",
        "attempt": state["flaky_calls"],
    }


@app.get("/rate-limit")
def rate_limit():
    state["rate_limit_calls"] += 1

    if state["rate_limit_calls"] == 1:
        return JSONResponse(
            status_code=429,
            headers={
                "Retry-After": "1"
            },
            content={
                "error": "Rate limit exceeded"
            },
        )

    return {
        "status": "rate-limit-recovered"
    }


@app.get("/protected")
def protected(
    x_api_key: str | None = Header(
        default=None,
        alias="X-API-Key",
    ),
):
    if x_api_key != "mock-valid-key":
        return JSONResponse(
            status_code=401,
            content={
                "error": "Invalid API key"
            },
        )

    return {
        "status": "authenticated"
    }


@app.post("/reset")
def reset():
    state["flaky_calls"] = 0
    state["rate_limit_calls"] = 0

    return {
        "status": "reset"
    }

PAGINATED_EVENTS = [
    {
        "eventId": "P001",
        "priority": "high",
        "createdAt": "2026-10-31T11:00:00Z",
        "message": "Paginated alert 1",
    },
    {
        "eventId": "P002",
        "priority": "medium",
        "createdAt": "2026-10-31T11:01:00Z",
        "message": "Paginated alert 2",
    },
    {
        "eventId": "P003",
        "priority": "critical",
        "createdAt": "2026-10-31T11:02:00Z",
        "message": "Paginated alert 3",
    },
    {
        "eventId": "P004",
        "priority": "low",
        "createdAt": "2026-10-31T11:03:00Z",
        "message": "Paginated alert 4",
    },
    {
        "eventId": "P005",
        "priority": "high",
        "createdAt": "2026-10-31T11:04:00Z",
        "message": "Paginated alert 5",
    },
]


@app.get("/paginated-events")
def paginated_events(
    offset: int = 0,
    limit: int = 2,
):
    return {
        "events": PAGINATED_EVENTS[
            offset:offset + limit
        ]
    }

@app.get("/page-events")
def page_events(
    page: int = 1,
    limit: int = 2,
):
    if page < 1:
        page = 1

    start = (page - 1) * limit
    end = start + limit

    return {
        "events": PAGINATED_EVENTS[start:end]
    }

@app.get("/sophos/events")
def sophos_events(
    page: int = 1,
    limit: int = 20,
    since: str | None = None,
):
    import json
    from datetime import datetime, timezone
    from pathlib import Path
    from fastapi import HTTPException

    if page < 1:
        raise HTTPException(
            status_code=400,
            detail="page must be >= 1",
        )

    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 100",
        )

    data_path = (
        Path(__file__).resolve().parent
        / "data"
        / "sophos_mock.json"
    )

    if not data_path.exists():
        raise HTTPException(
            status_code=500,
            detail="Sophos mock dataset not found",
        )

    payload = json.loads(
        data_path.read_text(encoding="utf-8")
    )

    items = payload.get("items", [])

    def parse_timestamp(value: str):
        candidate = value

        if candidate.endswith("Z"):
            candidate = candidate[:-1] + "+00:00"

        parsed = datetime.fromisoformat(candidate)

        if parsed.tzinfo is None:
            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

        return parsed

    if since:
        try:
            cutoff = parse_timestamp(since)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="since must be a valid ISO timestamp",
            ) from exc

        filtered_items = []

        for item in items:
            raised_at = item.get("raisedAt")

            if not raised_at:
                continue

            try:
                item_time = parse_timestamp(
                    str(raised_at)
                )
            except ValueError:
                continue

            if item_time > cutoff:
                filtered_items.append(item)

        items = filtered_items

    total_records = len(items)

    total_pages = (
        (total_records + limit - 1) // limit
        if total_records
        else 0
    )

    start = (page - 1) * limit
    end = start + limit

    page_items = items[start:end]

    return {
        "items": page_items,
        "has_more": page < total_pages,
        "pages": total_pages,
        "page": page,
        "limit": limit,
        "total": total_records,
        "since": since,
    }


@app.get("/sophos-drift/events")
def sophos_drift_events(
    page: int = 1,
    limit: int = 20,
    since: str | None = None,
):
    import json
    from copy import deepcopy
    from datetime import datetime, timezone
    from pathlib import Path
    from fastapi import HTTPException

    if page < 1:
        raise HTTPException(
            status_code=400,
            detail="page must be >= 1",
        )

    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 100",
        )

    data_path = (
        Path(__file__).resolve().parent
        / "data"
        / "sophos_mock.json"
    )

    payload = json.loads(
        data_path.read_text(encoding="utf-8")
    )

    items = []

    for original in payload.get("items", []):
        item = deepcopy(original)

        if "raisedAt" in item:
            item["createdAt"] = item.pop("raisedAt")

        items.append(item)

    def parse_timestamp(value: str):
        candidate = value

        if candidate.endswith("Z"):
            candidate = candidate[:-1] + "+00:00"

        parsed = datetime.fromisoformat(candidate)

        if parsed.tzinfo is None:
            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

        return parsed

    if since:
        try:
            cutoff = parse_timestamp(since)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="since must be a valid ISO timestamp",
            ) from exc

        filtered = []

        for item in items:
            created_at = item.get("createdAt")

            if not created_at:
                continue

            try:
                item_time = parse_timestamp(
                    str(created_at)
                )
            except ValueError:
                continue

            if item_time > cutoff:
                filtered.append(item)

        items = filtered

    total_records = len(items)

    total_pages = (
        (total_records + limit - 1) // limit
        if total_records
        else 0
    )

    start = (page - 1) * limit
    end = start + limit

    return {
        "items": items[start:end],
        "has_more": page < total_pages,
        "pages": total_pages,
        "page": page,
        "limit": limit,
        "total": total_records,
        "since": since,
    }

