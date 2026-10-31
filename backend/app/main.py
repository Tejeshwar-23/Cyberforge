import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from backend.app.core.config import settings
from backend.app.db.database import check_database
from backend.app.db.cache import check_redis


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cyberforge")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Config-driven security integration platform",
)


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "status": "running",
    }


@app.get("/health")
def health():
    database_status = "connected"
    redis_status = "connected"

    try:
        check_database()
    except Exception:
        logger.exception("Database health check failed")
        database_status = "unavailable"

    try:
        check_redis()
    except Exception:
        logger.exception("Redis health check failed")
        redis_status = "unavailable"

    healthy = (
        database_status == "connected"
        and redis_status == "connected"
    )

    payload = {
        "status": "healthy" if healthy else "degraded",
        "database": database_status,
        "redis": redis_status,
    }

    if healthy:
        return payload

    return JSONResponse(
        status_code=503,
        content=payload,
    )

from backend.app.api.connector_health import router as connector_health_router

app.include_router(connector_health_router)
