from typing import Any

from pydantic import ValidationError

from backend.app.connectors.common_schema import NORMALIZED_MODELS
from backend.app.connectors.schema import MappingConfig


class MappingError(Exception):
    """Raised when vendor data cannot be mapped to the common schema."""


def extract_path(data: Any, path: str) -> Any:
    if path in {"", "."}:
        return data

    current = data

    for part in path.split("."):
        if isinstance(current, dict):
            if part not in current:
                raise MappingError(
                    f"Required source field not found: {path}"
                )

            current = current[part]

        elif isinstance(current, list) and part.isdigit():
            index = int(part)

            if index >= len(current):
                raise MappingError(
                    f"List index out of range while reading: {path}"
                )

            current = current[index]

        else:
            raise MappingError(
                f"Cannot resolve source path: {path}"
            )

    return current


def extract_records(
    parsed_data: Any,
    records_path: str | None = None,
) -> list[dict[str, Any]]:
    data = (
        extract_path(parsed_data, records_path)
        if records_path
        else parsed_data
    )

    if isinstance(data, list):
        records = data

    elif isinstance(data, dict):
        records = [data]

    else:
        raise MappingError(
            "Configured records_path does not point to an object or list"
        )

    for record in records:
        if not isinstance(record, dict):
            raise MappingError(
                "Every source record must be an object"
            )

    return records


def map_record(
    raw_record: dict[str, Any],
    mapping: MappingConfig,
    source: str,
):
    output: dict[str, Any] = {}

    for target_field, source_path in mapping.fields.items():
        output[target_field] = extract_path(
            raw_record,
            source_path,
        )

    output.update(mapping.constants)

    # Source is always attached by CyberForge.
    output["source"] = source

    model_class = NORMALIZED_MODELS[mapping.entity]

    try:
        return model_class.model_validate(output)

    except ValidationError as exc:
        raise MappingError(
            f"Record failed common-schema validation:\n{exc}"
        ) from exc
