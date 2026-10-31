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
