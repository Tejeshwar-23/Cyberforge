import os
from pathlib import Path

from dotenv import dotenv_values


class SecretResolutionError(Exception):
    """Raised when a referenced secret cannot be resolved safely."""


class SecretResolver:
    def __init__(self, env_path: str | Path = ".env"):
        self.env_path = Path(env_path)

        if self.env_path.exists():
            self._file_values = dotenv_values(self.env_path)
        else:
            self._file_values = {}

    def resolve(self, secret_ref: str) -> str:
        """
        Resolve a secret using its reference name.

        Priority:
        1. Process environment
        2. Local .env file

        The secret value is never included in errors.
        """

        if not secret_ref or not secret_ref.strip():
            raise SecretResolutionError(
                "Secret reference cannot be empty"
            )

        value = os.getenv(secret_ref)

        if value is None:
            value = self._file_values.get(secret_ref)

        if not isinstance(value, str):
            raise SecretResolutionError(
                f"Secret '{secret_ref}' is not configured"
            )

        value = value.strip()

        if not value or value == "CHANGE_ME":
            raise SecretResolutionError(
                f"Secret '{secret_ref}' is not configured"
            )

        return value
