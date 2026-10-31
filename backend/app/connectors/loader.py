from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from backend.app.connectors.schema import ConnectorConfig


class ConfigLoadError(Exception):
    """Raised when a connector configuration cannot be loaded or validated."""


def load_yaml_file(path: str | Path) -> dict[str, Any]:
    config_path = Path(path)

    if not config_path.exists():
        raise ConfigLoadError(
            f"Config file does not exist: {config_path}"
        )

    if config_path.suffix.lower() not in {".yaml", ".yml"}:
        raise ConfigLoadError(
            "Connector config must use .yaml or .yml"
        )

    try:
        with config_path.open("r", encoding="utf-8") as file:
            data = yaml.safe_load(file)
    except yaml.YAMLError as exc:
        raise ConfigLoadError(
            f"Invalid YAML syntax: {exc}"
        ) from exc

    if not isinstance(data, dict):
        raise ConfigLoadError(
            "Connector config must contain a YAML object"
        )

    return data


def validate_connector_config(
    path: str | Path,
) -> ConnectorConfig:
    raw_config = load_yaml_file(path)

    try:
        return ConnectorConfig.model_validate(raw_config)
    except ValidationError as exc:
        raise ConfigLoadError(
            f"Connector configuration is invalid:\n{exc}"
        ) from exc
