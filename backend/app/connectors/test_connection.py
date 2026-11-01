# Production connector utility, not a pytest test module.
__test__ = False

from pathlib import Path
from typing import Any

from backend.app.connectors.executor import (
    ConnectorRequestError,
    execute_request,
)
from backend.app.connectors.loader import (
    ConfigLoadError,
    validate_connector_config,
)
from backend.app.connectors.mapper import (
    MappingError,
    extract_records,
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
from backend.app.security.outbound import OutboundPolicyError


CONNECTOR_DIRECTORY = Path("configs/connectors")


def find_connector_config(
    connector_name: str,
) -> Path | None:
    """
    Find a connector by its configured name.

    We search known connector files instead of accepting an arbitrary
    filesystem path from the API.
    """

    matches: list[Path] = []

    paths = list(
        CONNECTOR_DIRECTORY.glob("*.yaml")
    ) + list(
        CONNECTOR_DIRECTORY.glob("*.yml")
    )

    for path in paths:
        try:
            config = validate_connector_config(path)
        except ConfigLoadError:
            continue

        if config.name == connector_name:
            matches.append(path)

    if len(matches) == 1:
        return matches[0]

    return None


def _first_page_params(config) -> dict[str, Any]:
    pagination = config.pagination

    if pagination.type == "offset":
        return {
            pagination.offset_param: 0,
            pagination.limit_param: pagination.page_size,
        }

    if pagination.type == "page":
        params: dict[str, Any] = {
            pagination.page_param: pagination.start_page,
        }

        if (
            pagination.limit_param
            and pagination.page_size
        ):
            params[pagination.limit_param] = (
                pagination.page_size
            )

        return params

    return {}


def test_connector_connection(
    config_path: str | Path,
    resolver: SecretResolver | None = None,
) -> dict[str, Any]:
    """
    Validate and test one connector without ingesting or
    persisting its records.
    """

    resolver = resolver or SecretResolver()

    try:
        config = validate_connector_config(
            config_path
        )

        response = execute_request(
            config,
            resolver,
            max_attempts=2,
            timeout_seconds=10.0,
            params_override=_first_page_params(
                config
            ),
        )

        parsed = parse_response(
            response.text,
            config.response.format,
        )

        records = extract_records(
            parsed,
            config.response.records_path,
        )

        processed = process_records(
            records,
            config.mapping,
            config.name,
        )

        if (
            records
            and processed["quarantined_count"] > 0
        ):
            return {
                "success": False,
                "connector": config.name,
                "http_status": response.status_code,
                "response_format": config.response.format,
                "pagination_type": config.pagination.type,
                "sample_records_detected": len(records),
                "sample_records_normalized": processed[
                    "normalized_count"
                ],
                "sample_records_quarantined": processed[
                    "quarantined_count"
                ],
                "message": (
                    "Connection succeeded but mapping "
                    "validation failed"
                ),
            }

        return {
            "success": True,
            "connector": config.name,
            "http_status": response.status_code,
            "response_format": config.response.format,
            "pagination_type": config.pagination.type,
            "sample_records_detected": len(records),
            "sample_records_normalized": processed[
                "normalized_count"
            ],
            "sample_records_quarantined": processed[
                "quarantined_count"
            ],
            "message": "Connection test successful",
        }

    except (
        ConfigLoadError,
        ConnectorRequestError,
        SecretResolutionError,
        ResponseParseError,
        MappingError,
        OutboundPolicyError,
    ) as exc:
        return {
            "success": False,
            "connector": str(config_path),
            "http_status": None,
            "message": str(exc),
        }
