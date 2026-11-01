from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)
from pydantic import BaseModel, Field

from backend.app.copilot.sarvam import (
    SarvamCopilotError,
    generate_connector_draft,
)
from backend.app.connectors.secrets import (
    SecretResolutionError,
)
from backend.app.db.models import AppUser
from backend.app.security.audit import (
    write_security_audit,
)
from backend.app.security.auth import (
    require_roles,
)


router = APIRouter(
    prefix="/api/copilot",
    tags=["Connector Copilot"],
)


class GenerateConnectorRequest(BaseModel):
    source_name: str = Field(
        min_length=2,
        max_length=120,
    )

    entity: Literal[
        "user",
        "device",
        "event",
    ]

    api_details: str = Field(
        min_length=10,
        max_length=20000,
    )

    sample_payload: str | None = Field(
        default=None,
        max_length=30000,
    )

    secret_ref_hint: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
    )


def _client_ip(
    request: Request,
) -> str:

    if request.client is None:
        return "unknown"

    return request.client.host[:64]


@router.post("/generate-config")
def generate_config(
    payload: GenerateConnectorRequest,
    request: Request,
    user: AppUser = Depends(
        require_roles(
            "operator",
            "admin",
        )
    ),
):
    try:
        result = generate_connector_draft(
            source_name=payload.source_name,
            entity=payload.entity,
            api_details=payload.api_details,
            sample_payload=payload.sample_payload,
            secret_ref_hint=payload.secret_ref_hint,
        )

    except SecretResolutionError as exc:
        write_security_audit(
            action="copilot.generate",
            outcome="failure",
            username=user.username,
            actor_user_id=user.id,
            client_ip=_client_ip(request),
            detail=(
                "Connector Copilot secret "
                "resolution failed"
            ),
        )

        raise HTTPException(
            status_code=503,
            detail={
                "error_type": "COPILOT_SECRET_ERROR",
                "message": (
                    "Sarvam Copilot credential "
                    "is unavailable."
                ),
            },
        ) from exc

    except SarvamCopilotError as exc:
        write_security_audit(
            action="copilot.generate",
            outcome="failure",
            username=user.username,
            actor_user_id=user.id,
            client_ip=_client_ip(request),
            detail=(
                "Connector Copilot generation "
                f"failed for entity "
                f"{payload.entity}: "
                f"{exc.error_type}"
            ),
        )

        status = 502

        if exc.error_type == "COPILOT_RATE_LIMITED":
            status = 429

        if exc.error_type in {
            "COPILOT_SCHEMA_VALIDATION_FAILED",
            "COPILOT_ENTITY_MISMATCH",
        }:
            status = 422

        raise HTTPException(
            status_code=status,
            detail={
                "error_type": exc.error_type,
                "message": str(exc),
            },
        ) from exc

    write_security_audit(
        action="copilot.generate",
        outcome="success",
        username=user.username,
        actor_user_id=user.id,
        client_ip=_client_ip(request),
        detail=(
            "Generated validated disabled "
            "connector draft for "
            f"{payload.source_name[:100]} "
            f"({payload.entity})"
        ),
    )

    return {
        "success": True,
        "provider": "sarvam",
        "model": result.model,
        "validation": {
            "passed": True,
            "schema": "ConnectorConfig",
        },
        "safety": {
            "persisted": False,
            "activated": False,
            "enabled": False,
            "secret_values_returned": False,
        },
        "connector": result.connector,
        "yaml_preview": result.yaml_preview,
        "usage": result.usage,
    }
