from typing import Any

from backend.app.connectors.executor import execute_request
from backend.app.connectors.mapper import extract_records
from backend.app.connectors.parser import parse_response
from backend.app.connectors.schema import ConnectorConfig
from backend.app.connectors.secrets import SecretResolver


class PaginationError(Exception):
    """Raised when connector pagination cannot be completed."""


def _parse_page_records(
    config: ConnectorConfig,
    response,
) -> list[dict[str, Any]]:
    parsed = parse_response(
        response.text,
        config.response.format,
    )

    return extract_records(
        parsed,
        config.response.records_path,
    )


def fetch_offset_pages(
    config: ConnectorConfig,
    resolver: SecretResolver | None = None,
    *,
    max_pages: int = 1000,
) -> dict[str, Any]:

    pagination = config.pagination

    if pagination.type != "offset":
        raise PaginationError(
            "Connector is not configured for offset pagination"
        )

    page_size = pagination.page_size

    if page_size is None:
        raise PaginationError(
            "Offset pagination requires page_size"
        )

    offset = 0
    all_records: list[dict[str, Any]] = []
    page_count = 0
    last_status = None

    while page_count < max_pages:
        response = execute_request(
            config,
            resolver,
            params_override={
                pagination.offset_param: offset,
                pagination.limit_param: page_size,
            },
        )

        last_status = response.status_code

        page_records = _parse_page_records(
            config,
            response,
        )

        page_count += 1
        all_records.extend(page_records)

        if len(page_records) < page_size:
            break

        offset += page_size

    else:
        raise PaginationError(
            f"Maximum page limit reached: {max_pages}"
        )

    return {
        "records": all_records,
        "page_count": page_count,
        "http_status": last_status,
    }


def fetch_page_number_pages(
    config: ConnectorConfig,
    resolver: SecretResolver | None = None,
    *,
    max_pages: int = 1000,
) -> dict[str, Any]:

    pagination = config.pagination

    if pagination.type != "page":
        raise PaginationError(
            "Connector is not configured for page-number pagination"
        )

    if not pagination.page_param:
        raise PaginationError(
            "Page pagination requires page_param"
        )

    page = pagination.start_page
    page_size = pagination.page_size

    all_records: list[dict[str, Any]] = []
    page_count = 0
    last_status = None

    while page_count < max_pages:
        params = {
            pagination.page_param: page,
        }

        if (
            pagination.limit_param
            and page_size is not None
        ):
            params[pagination.limit_param] = page_size

        response = execute_request(
            config,
            resolver,
            params_override=params,
        )

        last_status = response.status_code

        page_records = _parse_page_records(
            config,
            response,
        )

        page_count += 1
        all_records.extend(page_records)

        if not page_records:
            break

        if (
            page_size is not None
            and len(page_records) < page_size
        ):
            break

        page += 1

    else:
        raise PaginationError(
            f"Maximum page limit reached: {max_pages}"
        )

    return {
        "records": all_records,
        "page_count": page_count,
        "http_status": last_status,
    }
