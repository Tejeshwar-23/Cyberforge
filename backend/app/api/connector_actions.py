from fastapi import APIRouter, Depends, HTTPException

from backend.app.security.auth import require_roles

from backend.app.connectors.test_connection import (
    find_connector_config,
    test_connector_connection,
)


router = APIRouter(
    prefix="/api/connectors",
    tags=["Connectors"],
    dependencies=[
        Depends(
            require_roles(
                "operator",
                "admin",
            )
        )
    ],
)


@router.post("/{connector_name}/test")
def test_connection(
    connector_name: str,
):
    config_path = find_connector_config(
        connector_name
    )

    if config_path is None:
        raise HTTPException(
            status_code=404,
            detail="Connector not found",
        )

    return test_connector_connection(
        config_path
    )
