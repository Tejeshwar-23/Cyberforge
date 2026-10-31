import re
from dataclasses import dataclass
from datetime import datetime
from difflib import SequenceMatcher
from typing import Any

from backend.app.connectors.mapper import extract_path


@dataclass(frozen=True)
class FieldRepairCandidate:
    target_field: str
    old_source_path: str
    new_source_path: str
    confidence: float
    auto_patch_allowed: bool
    reason: str


def _flatten_leaf_paths(
    value: Any,
    prefix: str = "",
) -> list[tuple[str, Any]]:

    results: list[tuple[str, Any]] = []

    if isinstance(value, dict):
        for key, child in value.items():
            path = f"{prefix}.{key}" if prefix else key
            results.extend(
                _flatten_leaf_paths(child, path)
            )
        return results

    results.append((prefix, value))
    return results


def _split_name(value: str) -> list[str]:
    value = re.sub(
        r"([a-z0-9])([A-Z])",
        r"\1 \2",
        value,
    )

    value = re.sub(
        r"[^A-Za-z0-9]+",
        " ",
        value,
    )

    return [
        token.lower()
        for token in value.split()
        if token
    ]


def _name_similarity(
    old_path: str,
    new_path: str,
) -> float:

    old_name = old_path.split(".")[-1]
    new_name = new_path.split(".")[-1]

    sequence = SequenceMatcher(
        None,
        old_name.lower(),
        new_name.lower(),
    ).ratio()

    old_tokens = set(_split_name(old_name))
    new_tokens = set(_split_name(new_name))

    if old_tokens or new_tokens:
        overlap = len(
            old_tokens & new_tokens
        ) / max(
            len(old_tokens | new_tokens),
            1,
        )
    else:
        overlap = 0.0

    return max(sequence, overlap)


def _looks_like_iso_timestamp(value: Any) -> bool:
    if not isinstance(value, str):
        return False

    candidate = value

    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"

    try:
        datetime.fromisoformat(candidate)
        return True
    except ValueError:
        return False


def _target_bonus(
    target_field: str,
    path: str,
    value: Any,
) -> tuple[float, str]:

    target = target_field.lower()
    leaf = path.split(".")[-1].lower()

    if target in {
        "timestamp",
        "last_seen",
        "last_login",
    }:
        if _looks_like_iso_timestamp(value):
            return (
                0.35,
                "candidate contains a valid ISO timestamp",
            )

    if target == "id":
        if leaf == "id" or leaf.endswith("id"):
            return (
                0.30,
                "candidate name looks like an identifier",
            )

    if target == "severity":
        if (
            isinstance(value, str)
            and value.lower()
            in {
                "low",
                "medium",
                "high",
                "critical",
                "info",
                "warning",
            }
        ):
            return (
                0.35,
                "candidate value looks like a severity",
            )

    if target == "description":
        if (
            isinstance(value, str)
            and len(value.strip()) >= 10
        ):
            return (
                0.15,
                "candidate value looks like descriptive text",
            )

    return (0.0, "")


def suggest_field_repair(
    *,
    target_field: str,
    old_source_path: str,
    sample_record: dict[str, Any],
) -> FieldRepairCandidate | None:

    candidates = _flatten_leaf_paths(
        sample_record
    )

    best: FieldRepairCandidate | None = None

    for path, value in candidates:
        similarity = _name_similarity(
            old_source_path,
            path,
        )

        bonus, bonus_reason = _target_bonus(
            target_field,
            path,
            value,
        )

        confidence = min(
            similarity + bonus,
            0.99,
        )

        if confidence < 0.55:
            continue

        reason_parts = [
            (
                f"name similarity="
                f"{similarity:.2f}"
            )
        ]

        if bonus_reason:
            reason_parts.append(
                bonus_reason
            )

        candidate = FieldRepairCandidate(
            target_field=target_field,
            old_source_path=old_source_path,
            new_source_path=path,
            confidence=round(
                confidence,
                3,
            ),
            auto_patch_allowed=False,
            reason="; ".join(
                reason_parts
            ),
        )

        if (
            best is None
            or candidate.confidence
            > best.confidence
        ):
            best = candidate

    return best


def suggest_mapping_repairs(
    mapping_fields: dict[str, str],
    sample_record: dict[str, Any],
) -> list[FieldRepairCandidate]:

    repairs: list[
        FieldRepairCandidate
    ] = []

    for target_field, source_path in (
        mapping_fields.items()
    ):
        try:
            extract_path(
                sample_record,
                source_path,
            )
            continue
        except Exception:
            pass

        candidate = suggest_field_repair(
            target_field=target_field,
            old_source_path=source_path,
            sample_record=sample_record,
        )

        if candidate is not None:
            repairs.append(candidate)

    return repairs


@dataclass(frozen=True)
class RepairValidation:
    valid: bool
    total_records: int
    normalized_records: int
    quarantined_records: int
    risk_level: str
    auto_patch_eligible: bool
    reason: str


def validate_mapping_repair(
    *,
    mapping,
    source_name: str,
    records: list[dict[str, Any]],
    candidate: FieldRepairCandidate,
) -> RepairValidation:

    from backend.app.connectors.processor import (
        process_records,
    )

    patched_fields = dict(mapping.fields)

    patched_fields[
        candidate.target_field
    ] = candidate.new_source_path

    patched_mapping = mapping.model_copy(
        update={
            "fields": patched_fields,
        },
        deep=True,
    )

    processed = process_records(
        records,
        patched_mapping,
        source_name,
    )

    total = processed["total_received"]
    normalized = processed["normalized_count"]
    quarantined = processed[
        "quarantined_count"
    ]

    fully_valid = (
        total > 0
        and normalized == total
        and quarantined == 0
    )

    # Mapping-only field changes are considered
    # low risk if confidence is very high and every
    # sampled record validates successfully.
    low_risk = (
        candidate.confidence >= 0.95
        and fully_valid
    )

    if low_risk:
        return RepairValidation(
            valid=True,
            total_records=total,
            normalized_records=normalized,
            quarantined_records=quarantined,
            risk_level="LOW",
            auto_patch_eligible=True,
            reason=(
                "High-confidence mapping-only repair "
                "validated successfully against all "
                "sample records."
            ),
        )

    if fully_valid:
        return RepairValidation(
            valid=True,
            total_records=total,
            normalized_records=normalized,
            quarantined_records=quarantined,
            risk_level="MEDIUM",
            auto_patch_eligible=False,
            reason=(
                "Repair validates successfully but "
                "confidence is below the automatic "
                "patch threshold."
            ),
        )

    return RepairValidation(
        valid=False,
        total_records=total,
        normalized_records=normalized,
        quarantined_records=quarantined,
        risk_level="HIGH",
        auto_patch_eligible=False,
        reason=(
            "Candidate repair failed schema validation "
            "for one or more sample records."
        ),
    )

