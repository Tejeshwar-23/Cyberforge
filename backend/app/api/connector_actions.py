from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
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
