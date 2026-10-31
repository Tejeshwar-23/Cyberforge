import os
from pathlib import Path

from dotenv import dotenv_values


class SecretResolutionError(Exception):
    """Raised when a referenced secret cannot be resolved safely."""


class SecretResolver:
    def __init__(
        self,
        env_path: str | Path = ".env",
    ):
        self.env_path = Path(
            env_path
        )

        if self.env_path.exists():
            self._file_values = (
                dotenv_values(
                    self.env_path
                )
            )
        else:
            self._file_values = {}

    def resolve(
        self,
        secret_ref: str,
    ) -> str:
        """
        Resolve a secret safely.

        Priority:
        1. Process environment
        2. Encrypted CyberForge vault
        3. Local .env fallback for development

        Secret values are never included in errors.
        """

        if (
            not secret_ref
            or not secret_ref.strip()
        ):
            raise SecretResolutionError(
                "Secret reference cannot be empty"
            )

        secret_ref = (
            secret_ref.strip()
        )

        # Deployment environment may explicitly
        # override the encrypted vault.
        value = os.getenv(
            secret_ref
        )

        if isinstance(value, str):
            value = value.strip()

            if (
                value
                and value != "CHANGE_ME"
            ):
                return value

        # Resolve encrypted-at-rest application secret.
        try:
            from backend.app.security.vault import (
                VaultError,
                resolve_vault_secret,
            )

            value = resolve_vault_secret(
                secret_ref
            )

        except VaultError as exc:
            raise SecretResolutionError(
                f"Secret '{secret_ref}' "
                "could not be resolved"
            ) from exc

        except Exception as exc:
            raise SecretResolutionError(
                "Encrypted secret store "
                "is unavailable"
            ) from exc

        if isinstance(value, str):
            value = value.strip()

            if value:
                return value

        # Development compatibility fallback.
        value = self._file_values.get(
            secret_ref
        )

        if not isinstance(
            value,
            str,
        ):
            raise SecretResolutionError(
                f"Secret '{secret_ref}' "
                "is not configured"
            )

        value = value.strip()

        if (
            not value
            or value == "CHANGE_ME"
        ):
            raise SecretResolutionError(
                f"Secret '{secret_ref}' "
                "is not configured"
            )

        return value
