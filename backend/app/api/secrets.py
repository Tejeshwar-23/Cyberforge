from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)
from pydantic import BaseModel, SecretStr

from backend.app.db.models import AppUser
from backend.app.security.audit import (
    write_security_audit,
)
from backend.app.security.auth import (
    require_roles,
)
from backend.app.security.vault import (
    VaultError,
    list_secret_metadata,
    store_secret,
)


router = APIRouter(
    prefix="/api/secrets",
    tags=["Secrets"],
)


class SecretWriteRequest(BaseModel):
    value: SecretStr


def _client_ip(
    request: Request,
) -> str:
    if request.client is None:
        return "unknown"

    return request.client.host[:64]


@router.get("")
def list_secrets(
    user: AppUser = Depends(
        require_roles(
            "operator",
            "admin",
        )
    ),
):
    rows = list_secret_metadata()

    return [
        {
            "name": row.name,
            "version": row.version,
            "algorithm": row.algorithm,
            "fingerprint": (
                row.fingerprint[:12]
                + "..."
            ),
            "created_at": (
                row.created_at
            ),
            "rotated_at": (
                row.rotated_at
            ),
        }
        for row in rows
    ]


@router.put("/{secret_name}")
def create_or_rotate_secret(
    secret_name: str,
    payload: SecretWriteRequest,
    request: Request,
    user: AppUser = Depends(
        require_roles("admin")
    ),
):
    try:
        metadata = store_secret(
            name=secret_name,
            value=(
                payload.value
                .get_secret_value()
            ),
            updated_by_user_id=(
                user.id
            ),
        )

    except VaultError as exc:
        write_security_audit(
            action="secret.write",
            outcome="failure",
            username=user.username,
            actor_user_id=user.id,
            client_ip=_client_ip(
                request
            ),
            detail=(
                "Secret write rejected: "
                + secret_name[:128]
            ),
        )

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    write_security_audit(
        action="secret.write",
        outcome="success",
        username=user.username,
        actor_user_id=user.id,
        client_ip=_client_ip(
            request
        ),
        detail=(
            "Secret created or rotated: "
            + metadata.name
        ),
    )

    # Deliberately return metadata only.
    # There is no plaintext secret read API.
    return {
        "name": metadata.name,
        "version": metadata.version,
        "algorithm": metadata.algorithm,
        "fingerprint": (
            metadata.fingerprint[:12]
            + "..."
        ),
        "created_at": metadata.created_at,
        "rotated_at": metadata.rotated_at,
        "message": (
            "Secret encrypted and stored"
        ),
    }
