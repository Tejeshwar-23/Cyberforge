from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)
from pydantic import BaseModel, Field, SecretStr

from backend.app.connectors.secrets import (
    SecretResolutionError,
    SecretResolver,
)
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



# ==================================================
# STAGE 3: SECRET READINESS
# ==================================================

class SecretStatusRequest(BaseModel):
    names: list[str] = Field(
        min_length=1,
        max_length=50,
    )


@router.post("/status")
def secret_status(
    payload: SecretStatusRequest,
    user: AppUser = Depends(
        require_roles(
            "operator",
            "admin",
        )
    ),
):
    """
    Return whether requested secret references are
    ready for connector execution.

    Secret values are resolved internally only.
    No plaintext or ciphertext is returned.
    """

    names = []

    for raw_name in payload.names:
        name = raw_name.strip()

        if not name:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Secret reference names "
                    "cannot be empty"
                ),
            )

        if len(name) > 128:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Secret reference name "
                    "is too long"
                ),
            )

        names.append(name)

    # Preserve order while removing duplicates.
    names = list(
        dict.fromkeys(names)
    )

    metadata_rows = (
        list_secret_metadata()
    )

    metadata_by_name = {
        row.name: row
        for row in metadata_rows
    }

    resolver = SecretResolver()

    results = []

    for name in names:
        configured = False

        try:
            # Deliberately discard the resolved value.
            resolver.resolve(name)
            configured = True

        except SecretResolutionError:
            configured = False

        metadata = metadata_by_name.get(
            name
        )

        item = {
            "name": name,
            "configured": configured,
            "vault_stored": (
                metadata is not None
            ),
            "version": None,
            "algorithm": None,
            "fingerprint": None,
            "created_at": None,
            "rotated_at": None,
        }

        if metadata is not None:
            item.update(
                {
                    "version": (
                        metadata.version
                    ),
                    "algorithm": (
                        metadata.algorithm
                    ),
                    "fingerprint": (
                        metadata.fingerprint[
                            :12
                        ]
                        + "..."
                    ),
                    "created_at": (
                        metadata.created_at
                    ),
                    "rotated_at": (
                        metadata.rotated_at
                    ),
                }
            )

        results.append(item)

    configured_count = sum(
        1
        for item in results
        if item["configured"]
    )

    return {
        "all_configured": (
            configured_count
            == len(results)
        ),
        "required_count": len(
            results
        ),
        "configured_count": (
            configured_count
        ),
        "missing_count": (
            len(results)
            - configured_count
        ),
        "secrets": results,
    }
