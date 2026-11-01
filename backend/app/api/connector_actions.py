import os
import re
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
)

import yaml
from pydantic import BaseModel

from backend.app.connectors.loader import (
    validate_connector_config,
)
from backend.app.connectors.runner import (
    ConnectorRunError,
    run_connector,
)
from backend.app.connectors.schema import (
    ConnectorConfig,
)

from backend.app.connectors.test_connection import (
    find_connector_config,
    test_connector_connection,
)
from backend.app.db.models import AppUser
from backend.app.security.audit import (
    write_security_audit,
)
from backend.app.security.auth import (
    require_roles,
)


router = APIRouter(
    prefix="/api/connectors",
    tags=["Connectors"],
)


@router.post("/{connector_name}/test")
def test_connection(
    connector_name: str,
    request: Request,
    user: AppUser = Depends(
        require_roles(
            "operator",
            "admin",
        )
    ),
):
    config_path = find_connector_config(
        connector_name
    )

    client_ip = (
        request.client.host[:64]
        if request.client
        else "unknown"
    )

    if config_path is None:
        write_security_audit(
            action="connector.test",
            outcome="not_found",
            username=user.username,
            actor_user_id=user.id,
            client_ip=client_ip,
            detail=(
                "Connector not found: "
                + connector_name[:200]
            ),
        )

        raise HTTPException(
            status_code=404,
            detail="Connector not found",
        )

    result = test_connector_connection(
        config_path
    )

    write_security_audit(
        action="connector.test",
        outcome=(
            "success"
            if result.get("success")
            else "failure"
        ),
        username=user.username,
        actor_user_id=user.id,
        client_ip=client_ip,
        detail=(
            "Connector tested: "
            + connector_name[:200]
        ),
    )

    return result



# ==================================================
# STAGE 4: CONNECTOR LIFECYCLE
# ==================================================

PROJECT_ROOT = Path(__file__).resolve().parents[3]

ACTIVE_CONNECTOR_DIRECTORY = (
    PROJECT_ROOT
    / "configs"
    / "connectors"
)

CONNECTOR_BACKUP_DIRECTORY = (
    PROJECT_ROOT
    / "backups"
    / "connector-config-api"
)

MAX_CONFIG_BYTES = 256 * 1024

SAFE_CONNECTOR_NAME = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$"
)


class ConnectorActivationRequest(BaseModel):
    enabled: bool


def _client_ip_stage4(
    request: Request,
) -> str:
    if request.client is None:
        return "unknown"

    return request.client.host[:64]


def _validate_connector_name(
    connector_name: str,
) -> None:
    if not SAFE_CONNECTOR_NAME.fullmatch(
        connector_name
    ):
        raise HTTPException(
            status_code=422,
            detail="Invalid connector name",
        )


def _backup_connector_file(
    path: Path,
) -> str | None:

    if not path.exists():
        return None

    CONNECTOR_BACKUP_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    stamp = datetime.now().strftime(
        "%Y%m%d-%H%M%S-%f"
    )

    backup = (
        CONNECTOR_BACKUP_DIRECTORY
        / (
            path.stem
            + "-"
            + stamp
            + path.suffix
        )
    )

    shutil.copy2(
        path,
        backup,
    )

    return str(backup)


def _atomic_write_config(
    target: Path,
    payload: dict,
) -> None:

    target.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    rendered = yaml.safe_dump(
        payload,
        sort_keys=False,
        allow_unicode=True,
    )

    fd, temp_name = tempfile.mkstemp(
        prefix=".cyberforge-",
        suffix=".yaml",
        dir=str(target.parent),
        text=True,
    )

    temp_path = Path(temp_name)

    try:
        with os.fdopen(
            fd,
            "w",
            encoding="utf-8",
            newline="\n",
        ) as handle:
            handle.write(rendered)

        # Validate the exact file that will be promoted.
        validate_connector_config(
            temp_path
        )

        os.replace(
            temp_path,
            target,
        )

    except Exception:
        try:
            temp_path.unlink(
                missing_ok=True
            )
        except Exception:
            pass

        raise


def _safe_connector_metadata(
    config: ConnectorConfig,
    path: Path,
) -> dict:

    return {
        "connector": config.name,
        "entity": config.mapping.entity,
        "enabled": config.enabled,
        "auth_type": config.auth.type,
        "response_format": (
            config.response.format
        ),
        "pagination_type": (
            config.pagination.type
        ),
        "schedule_every_minutes": (
            config.schedule.every_minutes
        ),
        "incremental_enabled": (
            config.incremental.enabled
        ),
        "config_file": path.name,
    }


@router.get("/configs")
def list_installed_connectors(
    user: AppUser = Depends(
        require_roles(
            "viewer",
            "operator",
            "admin",
        )
    ),
):
    """
    Return safe metadata for installed connector
    configurations.

    Secret values and mapping payloads are not
    returned.
    """

    rows = []

    for path in sorted(
        list(
            ACTIVE_CONNECTOR_DIRECTORY.glob(
                "*.yaml"
            )
        )
        + list(
            ACTIVE_CONNECTOR_DIRECTORY.glob(
                "*.yml"
            )
        )
    ):
        try:
            config = (
                validate_connector_config(
                    path
                )
            )

        except Exception:
            continue

        rows.append(
            _safe_connector_metadata(
                config,
                path,
            )
        )

    return rows


@router.post(
    "/{connector_name}/config"
)
async def install_or_update_config(
    connector_name: str,
    request: Request,
    file: UploadFile = File(...),
    user: AppUser = Depends(
        require_roles("admin")
    ),
):
    """
    Install or update one connector configuration.

    The uploaded configuration is revalidated.

    It is always saved DISABLED so that configuration
    installation cannot accidentally activate a
    connector.
    """

    _validate_connector_name(
        connector_name
    )

    filename = (
        file.filename
        or "connector.yaml"
    )

    suffix = Path(
        filename
    ).suffix.lower()

    if suffix not in {
        ".yaml",
        ".yml",
    }:
        raise HTTPException(
            status_code=415,
            detail=(
                "Connector configuration must "
                "be .yaml or .yml"
            ),
        )


    raw = await file.read(
        MAX_CONFIG_BYTES + 1
    )

    if not raw:
        raise HTTPException(
            status_code=422,
            detail="Uploaded config is empty",
        )

    if len(raw) > MAX_CONFIG_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                "Connector configuration exceeds "
                "256 KiB"
            ),
        )


    try:
        text = raw.decode(
            "utf-8"
        )

    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail="Configuration must be UTF-8",
        ) from exc


    try:
        payload = yaml.safe_load(
            text
        )

    except yaml.YAMLError as exc:
        raise HTTPException(
            status_code=422,
            detail="Invalid YAML configuration",
        ) from exc


    if not isinstance(
        payload,
        dict,
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "Configuration must be "
                "a YAML object"
            ),
        )


    try:
        config = (
            ConnectorConfig.model_validate(
                payload
            )
        )

    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                "Connector configuration "
                "failed schema validation"
            ),
        ) from exc


    if config.name != connector_name:
        raise HTTPException(
            status_code=409,
            detail=(
                "Uploaded configuration name "
                "does not match requested "
                "connector"
            ),
        )


    # Installation and activation are deliberately
    # separate operations.
    payload["enabled"] = False


    existing_path = find_connector_config(
        connector_name
    )

    if existing_path is not None:
        target = Path(
            existing_path
        )

    else:
        target = (
            ACTIVE_CONNECTOR_DIRECTORY
            / f"{connector_name}.yaml"
        )


    backup_path = (
        _backup_connector_file(
            target
        )
    )


    try:
        _atomic_write_config(
            target,
            payload,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Connector configuration "
                "could not be safely saved"
            ),
        ) from exc


    saved = validate_connector_config(
        target
    )


    write_security_audit(
        action="connector.config_save",
        outcome="success",
        username=user.username,
        actor_user_id=user.id,
        client_ip=(
            _client_ip_stage4(
                request
            )
        ),
        detail=(
            "Connector configuration saved: "
            + connector_name[:200]
        ),
    )


    return {
        "saved": True,
        "connector": saved.name,
        "enabled": saved.enabled,
        "entity": saved.mapping.entity,
        "config_file": target.name,
        "backup_created": (
            backup_path is not None
        ),
        "message": (
            "Configuration saved safely "
            "in disabled state"
        ),
    }


@router.patch(
    "/{connector_name}/activation"
)
def set_connector_activation(
    connector_name: str,
    payload: ConnectorActivationRequest,
    request: Request,
    user: AppUser = Depends(
        require_roles("admin")
    ),
):
    """
    Enable or disable a connector configuration.

    This changes the persisted YAML state.

    The current FastAPI application does not
    dynamically register scheduler jobs, so manual
    Run Now is immediate while scheduler reload is
    handled separately.
    """

    _validate_connector_name(
        connector_name
    )

    config_path = find_connector_config(
        connector_name
    )

    if config_path is None:
        raise HTTPException(
            status_code=404,
            detail="Connector not found",
        )

    path = Path(
        config_path
    )


    try:
        raw_payload = yaml.safe_load(
            path.read_text(
                encoding="utf-8"
            )
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to read connector "
                "configuration"
            ),
        ) from exc


    if not isinstance(
        raw_payload,
        dict,
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "Stored connector configuration "
                "is invalid"
            ),
        )


    backup_path = (
        _backup_connector_file(
            path
        )
    )

    raw_payload["enabled"] = (
        payload.enabled
    )


    try:
        _atomic_write_config(
            path,
            raw_payload,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Connector activation state "
                "could not be updated"
            ),
        ) from exc


    updated = validate_connector_config(
        path
    )


    write_security_audit(
        action="connector.activation",
        outcome="success",
        username=user.username,
        actor_user_id=user.id,
        client_ip=(
            _client_ip_stage4(
                request
            )
        ),
        detail=(
            f"Connector {connector_name[:160]} "
            f"enabled={updated.enabled}"
        ),
    )


    return {
        "connector": updated.name,
        "enabled": updated.enabled,
        "backup_created": (
            backup_path is not None
        ),
        "manual_run_available": True,
        "scheduler_dynamic_reload": False,
        "scheduler_note": (
            "Activation state is saved. "
            "The current FastAPI process does not "
            "dynamically register or remove "
            "scheduled jobs."
        ),
    }


@router.post(
    "/{connector_name}/run"
)
def run_connector_now(
    connector_name: str,
    request: Request,
    user: AppUser = Depends(
        require_roles(
            "operator",
            "admin",
        )
    ),
):
    """
    Execute one enabled connector immediately using
    the production CyberForge generic runner and
    persist its results.
    """

    _validate_connector_name(
        connector_name
    )

    config_path = find_connector_config(
        connector_name
    )

    if config_path is None:
        raise HTTPException(
            status_code=404,
            detail="Connector not found",
        )


    config = validate_connector_config(
        config_path
    )

    if not config.enabled:
        raise HTTPException(
            status_code=409,
            detail=(
                "Connector is disabled. "
                "Activate it before Run Now."
            ),
        )


    try:
        result = run_connector(
            config_path,
            persist=True,
        )

    except ConnectorRunError as exc:

        write_security_audit(
            action="connector.run_now",
            outcome="failure",
            username=user.username,
            actor_user_id=user.id,
            client_ip=(
                _client_ip_stage4(
                    request
                )
            ),
            detail=(
                "Manual connector run failed: "
                + connector_name[:180]
            ),
        )

        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc


    write_security_audit(
        action="connector.run_now",
        outcome="success",
        username=user.username,
        actor_user_id=user.id,
        client_ip=(
            _client_ip_stage4(
                request
            )
        ),
        detail=(
            "Manual connector run completed: "
            + connector_name[:180]
        ),
    )


    # Deliberately return a summary, not every
    # normalized/raw source record.
    return {
        "run_id": result.get("run_id"),
        "connector": result.get(
            "connector"
        ),
        "status": result.get(
            "status"
        ),
        "entity": result.get(
            "entity"
        ),
        "http_status": result.get(
            "http_status"
        ),
        "pagination_type": result.get(
            "pagination_type"
        ),
        "page_count": result.get(
            "page_count"
        ),
        "records_received": result.get(
            "total_received"
        ),
        "records_normalized": result.get(
            "normalized_count"
        ),
        "records_quarantined": result.get(
            "quarantined_count"
        ),
        "incremental_enabled": result.get(
            "incremental_enabled"
        ),
        "checkpoint_before": result.get(
            "checkpoint_before"
        ),
        "checkpoint_after": result.get(
            "checkpoint_after"
        ),
    }
