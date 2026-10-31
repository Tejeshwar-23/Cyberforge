import os
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import yaml

from backend.app.connectors.loader import (
    ConfigLoadError,
    load_yaml_file,
    validate_connector_config,
)
from backend.app.connectors.secrets import SecretResolver
from backend.app.connectors.self_heal import (
    FieldRepairCandidate,
    RepairValidation,
)
from backend.app.connectors.test_connection import (
    test_connector_connection,
)


CONNECTOR_ROOT = Path(
    "configs/connectors"
).resolve()

RUNTIME_ROOT = Path(
    "runtime/self-heal"
).resolve()


@dataclass(frozen=True)
class RepairApplyResult:
    applied: bool
    connector: str | None
    backup_path: str | None
    old_source_path: str
    new_source_path: str
    message: str


def _ensure_safe_connector_path(
    config_path: str | Path,
) -> Path:

    path = Path(config_path).resolve()

    if not path.is_relative_to(
        CONNECTOR_ROOT
    ):
        raise ValueError(
            "Self-heal may only modify connector "
            "files inside configs/connectors"
        )

    if path.suffix.lower() not in {
        ".yaml",
        ".yml",
    }:
        raise ValueError(
            "Self-heal only supports YAML "
            "connector configurations"
        )

    return path


def apply_validated_mapping_repair(
    *,
    config_path: str | Path,
    candidate: FieldRepairCandidate,
    validation: RepairValidation,
    resolver: SecretResolver | None = None,
) -> RepairApplyResult:

    resolver = resolver or SecretResolver()

    path = _ensure_safe_connector_path(
        config_path
    )

    if not validation.valid:
        return RepairApplyResult(
            applied=False,
            connector=None,
            backup_path=None,
            old_source_path=(
                candidate.old_source_path
            ),
            new_source_path=(
                candidate.new_source_path
            ),
            message=(
                "Repair was not applied because "
                "validation failed"
            ),
        )

    if not validation.auto_patch_eligible:
        return RepairApplyResult(
            applied=False,
            connector=None,
            backup_path=None,
            old_source_path=(
                candidate.old_source_path
            ),
            new_source_path=(
                candidate.new_source_path
            ),
            message=(
                "Repair requires manual approval"
            ),
        )

    raw = load_yaml_file(path)

    mapping = raw.get("mapping")

    if not isinstance(mapping, dict):
        raise ConfigLoadError(
            "Connector mapping is missing"
        )

    fields = mapping.get("fields")

    if not isinstance(fields, dict):
        raise ConfigLoadError(
            "Connector mapping.fields "
            "is missing"
        )

    current_value = fields.get(
        candidate.target_field
    )

    # Important safety condition:
    # never overwrite a mapping that has
    # already changed since detection.
    if current_value != (
        candidate.old_source_path
    ):
        return RepairApplyResult(
            applied=False,
            connector=None,
            backup_path=None,
            old_source_path=(
                candidate.old_source_path
            ),
            new_source_path=(
                candidate.new_source_path
            ),
            message=(
                "Repair aborted because the "
                "connector mapping changed after "
                "the candidate was generated"
            ),
        )

    fields[
        candidate.target_field
    ] = candidate.new_source_path

    # If the repaired mapping is the timestamp used by
    # incremental sync, update that linked field too.
    # This is only allowed when it still exactly matches
    # the old source path detected by the healer.
    incremental = raw.get("incremental")

    if (
        candidate.target_field == "timestamp"
        and isinstance(incremental, dict)
        and incremental.get("enabled") is True
        and incremental.get("source_field")
        == candidate.old_source_path
    ):
        incremental["source_field"] = (
            candidate.new_source_path
        )

    RUNTIME_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )

    staging_dir = (
        RUNTIME_ROOT / "staging"
    )

    backup_dir = (
        RUNTIME_ROOT / "backups"
    )

    staging_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    backup_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    timestamp = (
        datetime.now(timezone.utc)
        .strftime("%Y%m%dT%H%M%S%fZ")
    )

    staged_path = (
        staging_dir
        / f"{path.stem}.{timestamp}.yaml"
    )

    with staged_path.open(
        "w",
        encoding="utf-8",
    ) as file:
        yaml.safe_dump(
            raw,
            file,
            sort_keys=False,
            allow_unicode=True,
        )

    try:
        staged_config = (
            validate_connector_config(
                staged_path
            )
        )
    except Exception:
        staged_path.unlink(
            missing_ok=True
        )
        raise

    connection_result = (
        test_connector_connection(
            staged_path,
            resolver,
        )
    )

    if not connection_result.get(
        "success"
    ):
        staged_path.unlink(
            missing_ok=True
        )

        return RepairApplyResult(
            applied=False,
            connector=staged_config.name,
            backup_path=None,
            old_source_path=(
                candidate.old_source_path
            ),
            new_source_path=(
                candidate.new_source_path
            ),
            message=(
                "Candidate patch failed live "
                "Test Connection and was not "
                "applied"
            ),
        )

    backup_path = (
        backup_dir
        / f"{path.stem}.{timestamp}.yaml"
    )

    shutil.copy2(
        path,
        backup_path,
    )

    try:
        # Atomic promotion on the same filesystem.
        os.replace(
            staged_path,
            path,
        )

        # Final validation after promotion.
        final_config = (
            validate_connector_config(
                path
            )
        )

    except Exception:
        shutil.copy2(
            backup_path,
            path,
        )

        staged_path.unlink(
            missing_ok=True
        )

        raise

    return RepairApplyResult(
        applied=True,
        connector=final_config.name,
        backup_path=str(
            backup_path
        ),
        old_source_path=(
            candidate.old_source_path
        ),
        new_source_path=(
            candidate.new_source_path
        ),
        message=(
            "Low-risk mapping repair "
            "validated and applied successfully"
        ),
    )


def rollback_mapping_repair(
    *,
    config_path: str | Path,
    backup_path: str | Path,
) -> None:

    path = _ensure_safe_connector_path(
        config_path
    )

    backup = Path(
        backup_path
    ).resolve()

    allowed_backup_root = (
        RUNTIME_ROOT
        / "backups"
    ).resolve()

    if not backup.is_relative_to(
        allowed_backup_root
    ):
        raise ValueError(
            "Rollback backup is outside the "
            "approved self-heal backup directory"
        )

    if not backup.exists():
        raise FileNotFoundError(
            "Self-heal rollback backup "
            "does not exist"
        )

    shutil.copy2(
        backup,
        path,
    )

    # Refuse to consider rollback complete
    # unless the restored YAML still validates.
    validate_connector_config(
        path
    )

