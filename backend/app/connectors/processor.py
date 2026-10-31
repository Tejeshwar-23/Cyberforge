from typing import Any

from backend.app.connectors.mapper import MappingError, map_record
from backend.app.connectors.schema import MappingConfig


def process_records(
    raw_records: list[dict[str, Any]],
    mapping: MappingConfig,
    source: str,
) -> dict[str, Any]:
    """
    Normalize all valid records and quarantine invalid ones
    without stopping the complete connector run.
    """

    normalized: list[Any] = []
    quarantined: list[dict[str, Any]] = []

    for index, raw_record in enumerate(raw_records):
        try:
            record = map_record(
                raw_record,
                mapping,
                source,
            )

            normalized.append(record)

        except MappingError as exc:
            quarantined.append(
                {
                    "record_index": index,
                    "source": source,
                    "error": str(exc),
                    "raw_record": raw_record,
                }
            )

    return {
        "total_received": len(raw_records),
        "normalized_count": len(normalized),
        "quarantined_count": len(quarantined),
        "normalized": normalized,
        "quarantined": quarantined,
    }
