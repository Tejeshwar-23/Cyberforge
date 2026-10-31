from typing import Any

from backend.app.connectors.executor import (
    ConnectorRequestError,
    execute_request,
)
from backend.app.connectors.loader import validate_connector_config
from backend.app.connectors.mapper import extract_records
from backend.app.connectors.pagination import (
    PaginationError,
    fetch_offset_pages,
    fetch_page_number_pages,
)
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

    resolver = resolver or SecretResolver()

    config = validate_connector_config(config_path)

    try:
        page_count = 1

        if config.pagination.type == "offset":
            pagination_result = fetch_offset_pages(
                config,
                resolver,
            )

            raw_records = pagination_result["records"]
            http_status = pagination_result["http_status"]
            page_count = pagination_result["page_count"]

        elif config.pagination.type == "page":
            pagination_result = fetch_page_number_pages(
                config,
                resolver,
            )

            raw_records = pagination_result["records"]
            http_status = pagination_result["http_status"]
            page_count = pagination_result["page_count"]

        else:
            response = execute_request(
                config,
                resolver,
            )

            http_status = response.status_code

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
            "http_status": http_status,
            "entity": config.mapping.entity,
            "response_format": config.response.format,
            "pagination_type": config.pagination.type,
            "page_count": page_count,
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
        PaginationError,
    ) as exc:
        raise ConnectorRunError(
            f"Connector '{config.name}' failed: {exc}"
        ) from exc
