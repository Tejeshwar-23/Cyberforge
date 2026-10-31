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
from backend.app.db.persistence import (
    persist_failed_run,
    persist_successful_run,
    start_connector_run,
)


class ConnectorRunError(Exception):
    """Raised when a complete connector run cannot be completed."""


def run_connector(
    config_path: str,
    resolver: SecretResolver | None = None,
    *,
    persist: bool = True,
) -> dict[str, Any]:

    resolver = resolver or SecretResolver()

    config = validate_connector_config(
        config_path
    )

    run_id = None

    if persist:
        run_id = start_connector_run(
            config.name
        )

    try:
        page_count = 1

        if config.pagination.type == "offset":
            pagination_result = fetch_offset_pages(
                config,
                resolver,
            )

            raw_records = pagination_result[
                "records"
            ]

            http_status = pagination_result[
                "http_status"
            ]

            page_count = pagination_result[
                "page_count"
            ]

        elif config.pagination.type == "page":
            pagination_result = (
                fetch_page_number_pages(
                    config,
                    resolver,
                )
            )

            raw_records = pagination_result[
                "records"
            ]

            http_status = pagination_result[
                "http_status"
            ]

            page_count = pagination_result[
                "page_count"
            ]

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

        processed = process_records(
            raw_records,
            config.mapping,
            config.name,
        )

        result = {
            "run_id": run_id,
            "connector": config.name,
            "status": "success",
            "http_status": http_status,
            "entity": config.mapping.entity,
            "response_format": config.response.format,
            "pagination_type": config.pagination.type,
            "page_count": page_count,
            "total_received": processed[
                "total_received"
            ],
            "normalized_count": processed[
                "normalized_count"
            ],
            "quarantined_count": processed[
                "quarantined_count"
            ],
            "normalized": processed[
                "normalized"
            ],
            "quarantined": processed[
                "quarantined"
            ],
        }

        if persist and run_id is not None:
            persist_successful_run(
                run_id,
                result,
            )

        return result

    except (
        ConnectorRequestError,
        ResponseParseError,
        SecretResolutionError,
        PaginationError,
    ) as exc:

        message = (
            f"Connector '{config.name}' "
            f"failed: {exc}"
        )

        if persist and run_id is not None:
            persist_failed_run(
                run_id,
                message,
            )

        raise ConnectorRunError(
            message
        ) from exc
