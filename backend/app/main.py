import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import settings
from backend.app.db.database import check_database
from backend.app.db.cache import check_redis
from backend.app.connectors.scheduler import (
    start_scheduler,
    shutdown_scheduler,
)


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cyberforge")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CyberForge connector scheduler")

    start_scheduler()

    try:
        yield
    finally:
        logger.info("Shutting down CyberForge connector scheduler")
        shutdown_scheduler()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Config-driven security integration platform",
    lifespan=lifespan,
)

cors_origins = [
    origin.strip()
    for origin in settings.cors_allowed_origins.split(",")
    if origin.strip()
]

if "*" in cors_origins:
    raise RuntimeError(
        "Wildcard CORS origins are forbidden"
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
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

    # Do not expose infrastructure details publicly.
    payload = {
        "status": "healthy" if healthy else "degraded",
    }

    if healthy:
        return payload

    return JSONResponse(
        status_code=503,
        content=payload,
    )

from backend.app.api.auth import router as auth_router

app.include_router(auth_router)

from backend.app.api.connector_health import router as connector_health_router

app.include_router(connector_health_router)

from backend.app.api.connector_actions import router as connector_actions_router

app.include_router(connector_actions_router)

from backend.app.api.secrets import router as secrets_router

app.include_router(secrets_router)

from backend.app.api.catalog import router as catalog_router

app.include_router(catalog_router)



from backend.app.api.data import router as data_router

app.include_router(data_router)


from backend.app.api.reliability import router as reliability_router

app.include_router(reliability_router)


from backend.app.api.run_timeline import router as run_timeline_router

app.include_router(run_timeline_router)


from backend.app.api.self_heal import router as self_heal_router

app.include_router(self_heal_router)


from backend.app.api.risk import router as risk_router

app.include_router(risk_router)


from backend.app.api.overview import router as overview_router

app.include_router(overview_router)

from backend.app.api.copilot import router as copilot_router

app.include_router(copilot_router)
