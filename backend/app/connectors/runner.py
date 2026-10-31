from datetime import datetime, timezone
from typing import Any

from backend.app.connectors.executor import (
    ConnectorRequestError,
    execute_request,
)
from backend.app.connectors.loader import validate_connector_config
from backend.app.connectors.mapper import extract_path, extract_records
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
    get_connector_sync_state,
    persist_failed_run,
    persist_successful_run,
    start_connector_run,
)


class ConnectorRunError(Exception):
    """Raised when a complete connector run cannot be completed."""


class IncrementalSyncError(Exception):
    """Raised when an incremental checkpoint cannot be computed."""


def _compute_timestamp_checkpoint(
    records: list[dict[str, Any]],
    source_field: str,
    current_value: str | None,
) -> str | None:

    if not records:
        return current_value

    latest_dt: datetime | None = None
    latest_value: str | None = None

    for index, record in enumerate(records):
        try:
            value = extract_path(
                record,
                source_field,
            )
        except Exception as exc:
            raise IncrementalSyncError(
                f"Incremental source field "
                f"'{source_field}' is missing "
                f"from record {index}"
            ) from exc

        if value is None:
            raise IncrementalSyncError(
                f"Incremental source field "
                f"'{source_field}' is empty "
                f"in record {index}"
            )

        raw_value = str(value)

        candidate = raw_value

        if candidate.endswith("Z"):
            candidate = candidate[:-1] + "+00:00"

        try:
            parsed = datetime.fromisoformat(
                candidate
            )
        except ValueError as exc:
            raise IncrementalSyncError(
                f"Incremental source field "
                f"'{source_field}' is not a valid "
                f"ISO timestamp in record {index}"
            ) from exc

        if parsed.tzinfo is None:
            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

        if (
            latest_dt is None
            or parsed > latest_dt
        ):
            latest_dt = parsed
            latest_value = raw_value

    return latest_value


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

    checkpoint_before = None
    incremental_params: dict[str, Any] = {}

    if config.incremental.enabled:
        checkpoint_before = (
            get_connector_sync_state(
                config.name
            )
        )

        if checkpoint_before is not None:
            request_param = (
                config.incremental.request_param
            )

            if request_param is None:
                raise IncrementalSyncError(
                    "Incremental request_param "
                    "is not configured"
                )

            incremental_params[
                request_param
            ] = checkpoint_before

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
                base_params=incremental_params,
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
                    base_params=incremental_params,
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
                params_override=(
                    incremental_params or None
                ),
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

        checkpoint_after = checkpoint_before

        if config.incremental.enabled:
            source_field = (
                config.incremental.source_field
            )

            if source_field is None:
                raise IncrementalSyncError(
                    "Incremental source_field "
                    "is not configured"
                )

            checkpoint_after = (
                _compute_timestamp_checkpoint(
                    raw_records,
                    source_field,
                    checkpoint_before,
                )
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
            "incremental_enabled": (
                config.incremental.enabled
            ),
            "checkpoint_before": (
                checkpoint_before
            ),
            "checkpoint_after": (
                checkpoint_after
            ),
        }

        if persist and run_id is not None:
            persist_successful_run(
                run_id,
                result,
                checkpoint_value=(
                    checkpoint_after
                    if config.incremental.enabled
                    else None
                ),
            )

        return result

    except (
        ConnectorRequestError,
        ResponseParseError,
        SecretResolutionError,
        PaginationError,
        IncrementalSyncError,
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
