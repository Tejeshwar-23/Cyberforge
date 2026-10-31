import logging
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler

from backend.app.connectors.loader import (
    ConfigLoadError,
    validate_connector_config,
)
from backend.app.connectors.runner import (
    ConnectorRunError,
    run_connector,
)


logger = logging.getLogger(__name__)

CONNECTOR_CONFIG_DIRECTORY = Path(
    "configs/connectors"
)

scheduler = BackgroundScheduler(
    timezone="UTC"
)


def run_scheduled_connector(
    config_path: str,
) -> None:
    try:
        result = run_connector(
            config_path,
            persist=True,
        )

        logger.info(
            "Scheduled connector completed: %s "
            "received=%s normalized=%s quarantined=%s",
            result["connector"],
            result["total_received"],
            result["normalized_count"],
            result["quarantined_count"],
        )

    except ConnectorRunError as exc:
        logger.error(
            "Scheduled connector failed: %s",
            exc,
        )


def register_connector_jobs() -> list[str]:
    registered: list[str] = []

    for config_path in sorted(
        CONNECTOR_CONFIG_DIRECTORY.glob("*.yaml")
    ):
        try:
            config = validate_connector_config(
                config_path
            )

        except ConfigLoadError as exc:
            logger.warning(
                "Skipping invalid connector config %s: %s",
                config_path.name,
                exc,
            )
            continue

        if not config.enabled:
            continue

        job_id = f"connector:{config.name}"

        scheduler.add_job(
            run_scheduled_connector,
            trigger="interval",
            minutes=config.schedule.every_minutes,
            args=[str(config_path)],
            id=job_id,
            name=config.name,
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=60,
        )

        registered.append(job_id)

    return registered


def start_scheduler() -> None:
    if scheduler.running:
        return

    register_connector_jobs()
    scheduler.start()


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(
            wait=False
        )


def get_scheduled_jobs() -> list[dict]:
    return [
        {
            "id": job.id,
            "connector": job.name,
            "next_run_time": job.next_run_time,
        }
        for job in scheduler.get_jobs()
    ]
