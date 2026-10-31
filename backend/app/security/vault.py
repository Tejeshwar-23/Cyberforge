import base64
import hashlib
import hmac
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.db.database import SessionLocal
from backend.app.db.models import EncryptedSecret


SECRET_NAME_PATTERN = re.compile(
    r"^[A-Z][A-Z0-9_]{2,127}$"
)


class VaultError(Exception):
    """Raised when encrypted secret storage fails safely."""


@dataclass(frozen=True)
class SecretMetadata:
    name: str
    version: int
    algorithm: str
    fingerprint: str
    created_at: datetime
    rotated_at: datetime | None


def _validate_secret_name(
    name: str,
) -> str:

    normalized = name.strip()

    if not SECRET_NAME_PATTERN.fullmatch(
        normalized
    ):
        raise VaultError(
            "Secret names must use uppercase letters, "
            "numbers and underscores"
        )

    return normalized


def _derive_key(
    purpose: bytes,
) -> bytes:

    master = (
        settings.master_encryption_key
        .encode("utf-8")
    )

    if len(master) < 32:
        raise VaultError(
            "Master encryption key is too short"
        )

    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"cyberforge-vault-v1",
        info=purpose,
    ).derive(master)


def _encryption_key() -> bytes:
    return _derive_key(
        b"vendor-secret-encryption"
    )


def _fingerprint_key() -> bytes:
    return _derive_key(
        b"vendor-secret-fingerprint"
    )


def _associated_data(
    name: str,
    version: int,
) -> bytes:

    return (
        f"CyberForge|{name}|v{version}"
        .encode("utf-8")
    )


def _fingerprint(
    value: str,
) -> str:

    return hmac.new(
        _fingerprint_key(),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def encrypt_secret_value(
    *,
    name: str,
    value: str,
    version: int,
) -> tuple[str, str, str]:

    name = _validate_secret_name(name)

    if not value:
        raise VaultError(
            "Secret value cannot be empty"
        )

    nonce = os.urandom(12)

    aes = AESGCM(
        _encryption_key()
    )

    ciphertext = aes.encrypt(
        nonce,
        value.encode("utf-8"),
        _associated_data(
            name,
            version,
        ),
    )

    return (
        base64.urlsafe_b64encode(
            ciphertext
        ).decode("ascii"),
        base64.urlsafe_b64encode(
            nonce
        ).decode("ascii"),
        _fingerprint(value),
    )


def decrypt_secret_value(
    *,
    name: str,
    ciphertext: str,
    nonce: str,
    version: int,
) -> str:

    name = _validate_secret_name(name)

    try:
        encrypted_bytes = (
            base64.urlsafe_b64decode(
                ciphertext.encode("ascii")
            )
        )

        nonce_bytes = (
            base64.urlsafe_b64decode(
                nonce.encode("ascii")
            )
        )

        aes = AESGCM(
            _encryption_key()
        )

        plaintext = aes.decrypt(
            nonce_bytes,
            encrypted_bytes,
            _associated_data(
                name,
                version,
            ),
        )

        return plaintext.decode(
            "utf-8"
        )

    except Exception as exc:
        raise VaultError(
            "Encrypted secret could not be decrypted"
        ) from exc


def store_secret(
    *,
    name: str,
    value: str,
    updated_by_user_id: int | None = None,
) -> SecretMetadata:

    name = _validate_secret_name(name)

    if not value or value == "CHANGE_ME":
        raise VaultError(
            "Secret value is invalid"
        )

    now = datetime.now(
        timezone.utc
    )

    with SessionLocal() as session:
        existing = session.scalar(
            select(EncryptedSecret).where(
                EncryptedSecret.name == name
            )
        )

        if existing is None:
            version = 1
        else:
            version = (
                existing.version + 1
            )

        (
            ciphertext,
            nonce,
            fingerprint,
        ) = encrypt_secret_value(
            name=name,
            value=value,
            version=version,
        )

        if existing is None:
            secret = EncryptedSecret(
                name=name,
                ciphertext=ciphertext,
                nonce=nonce,
                fingerprint=fingerprint,
                algorithm="AES-256-GCM",
                version=version,
                created_at=now,
                rotated_at=None,
                updated_by_user_id=(
                    updated_by_user_id
                ),
            )

            session.add(secret)

        else:
            existing.ciphertext = (
                ciphertext
            )
            existing.nonce = nonce
            existing.fingerprint = (
                fingerprint
            )
            existing.algorithm = (
                "AES-256-GCM"
            )
            existing.version = version
            existing.rotated_at = now
            existing.updated_by_user_id = (
                updated_by_user_id
            )

            secret = existing

        session.commit()
        session.refresh(secret)

        return SecretMetadata(
            name=secret.name,
            version=secret.version,
            algorithm=secret.algorithm,
            fingerprint=secret.fingerprint,
            created_at=secret.created_at,
            rotated_at=secret.rotated_at,
        )


def resolve_vault_secret(
    name: str,
) -> str | None:

    name = _validate_secret_name(name)

    with SessionLocal() as session:
        secret = session.scalar(
            select(EncryptedSecret).where(
                EncryptedSecret.name == name
            )
        )

        if secret is None:
            return None

        return decrypt_secret_value(
            name=secret.name,
            ciphertext=secret.ciphertext,
            nonce=secret.nonce,
            version=secret.version,
        )


def list_secret_metadata(
) -> list[SecretMetadata]:

    with SessionLocal() as session:
        rows = session.scalars(
            select(EncryptedSecret)
            .order_by(
                EncryptedSecret.name
            )
        ).all()

        return [
            SecretMetadata(
                name=row.name,
                version=row.version,
                algorithm=row.algorithm,
                fingerprint=(
                    row.fingerprint
                ),
                created_at=row.created_at,
                rotated_at=row.rotated_at,
            )
            for row in rows
        ]
