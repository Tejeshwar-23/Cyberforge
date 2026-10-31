from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.app.connectors.schema import ConnectorConfig
from backend.app.connectors.secrets import SecretResolver
from backend.app.connectors.self_heal import (
    FieldRepairCandidate,
    RepairValidation,
    suggest_mapping_repairs,
    validate_mapping_repair,
)
from backend.app.connectors.self_heal_apply import (
    RepairApplyResult,
    apply_validated_mapping_repair,
)


@dataclass(frozen=True)
class AutoHealDecision:
    attempted: bool
    applied: bool
    reason: str
    candidate: FieldRepairCandidate | None = None
    validation: RepairValidation | None = None
    apply_result: RepairApplyResult | None = None


def attempt_automatic_mapping_repair(
    *,
    config_path: str | Path,
    config: ConnectorConfig,
    raw_records: list[dict[str, Any]],
    processed: dict[str, Any],
    resolver: SecretResolver,
) -> AutoHealDecision:

    total = processed[
        "total_received"
    ]

    quarantined = processed[
        "quarantined_count"
    ]

    normalized = processed[
        "normalized_count"
    ]

    # Never infer drift from an empty response.
    if total == 0:
        return AutoHealDecision(
            attempted=False,
            applied=False,
            reason=(
                "No records were returned, so "
                "mapping drift cannot be inferred"
            ),
        )

    # Conservative trigger:
    # auto-healing only starts if the entire batch
    # suddenly fails normalization.
    if not (
        normalized == 0
        and quarantined == total
    ):
        return AutoHealDecision(
            attempted=False,
            applied=False,
            reason=(
                "Automatic repair requires all "
                "records in the batch to fail mapping"
            ),
        )

    repairs = suggest_mapping_repairs(
        config.mapping.fields,
        raw_records[0],
    )

    # Multiple missing fields are ambiguous and
    # require human review.
    if len(repairs) != 1:
        return AutoHealDecision(
            attempted=True,
            applied=False,
            reason=(
                "Automatic repair requires exactly "
                "one unambiguous mapping candidate"
            ),
        )

    candidate = repairs[0]

    validation = (
        validate_mapping_repair(
            mapping=config.mapping,
            source_name=config.name,
            records=raw_records,
            candidate=candidate,
        )
    )

    if not validation.auto_patch_eligible:
        return AutoHealDecision(
            attempted=True,
            applied=False,
            reason=(
                "Candidate did not pass the "
                "LOW-risk automatic repair gate"
            ),
            candidate=candidate,
            validation=validation,
        )

    try:
        apply_result = (
            apply_validated_mapping_repair(
                config_path=config_path,
                candidate=candidate,
                validation=validation,
                resolver=resolver,
            )
        )
    except (
        ValueError,
        OSError,
    ) as exc:
        return AutoHealDecision(
            attempted=True,
            applied=False,
            reason=(
                "Candidate passed validation but "
                "could not be safely applied: "
                + str(exc)
            ),
            candidate=candidate,
            validation=validation,
        )

    return AutoHealDecision(
        attempted=True,
        applied=apply_result.applied,
        reason=apply_result.message,
        candidate=candidate,
        validation=validation,
        apply_result=apply_result,
    )
