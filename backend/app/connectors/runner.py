from typing import Any

from backend.app.connectors.executor import (
    ConnectorRequestError,
    execute_request,
)
from backend.app.connectors.loader import validate_connector_config
from backend.app.connectors.mapper import extract_records
from backend.app.connectors.parser import (
    ResponseParseError,
    parse_response,
)
from backend.app.connectors.processor import process_records
from backend.app.connectors.secrets import (
    SecretResolutionError,
    SecretResolver,
)


class ConnectorRunError(Exception):
    """Raised when a complete connector run cannot be completed."""


def run_connector(
    config_path: str,
    resolver: SecretResolver | None = None,
) -> dict[str, Any]:
    """
    Execute one complete config-driven connector run.
    """

    resolver = resolver or SecretResolver()

    config = validate_connector_config(config_path)

    try:
        response = execute_request(
            config,
            resolver,
        )

        parsed = parse_response(
            response.text,
            config.response.format,
        )

        raw_records = extract_records(
            parsed,
            config.response.records_path,
        )

        result = process_records(
            raw_records,
            config.mapping,
            config.name,
        )

        return {
            "connector": config.name,
            "status": "success",
            "http_status": response.status_code,
            "entity": config.mapping.entity,
            "response_format": config.response.format,
            "total_received": result["total_received"],
            "normalized_count": result["normalized_count"],
            "quarantined_count": result["quarantined_count"],
            "normalized": result["normalized"],
            "quarantined": result["quarantined"],
        }

    except (
        ConnectorRequestError,
        ResponseParseError,
        SecretResolutionError,
    ) as exc:
        raise ConnectorRunError(
            f"Connector '{config.name}' failed: {exc}"
        ) from exc
