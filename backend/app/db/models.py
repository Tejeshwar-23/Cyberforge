from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class ConnectorRun(Base):
    __tablename__ = "connector_runs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    connector_name: Mapped[str] = mapped_column(
        String(255),
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        index=True,
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    http_status: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    pagination_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    page_count: Mapped[int] = mapped_column(
        Integer,
        default=1,
    )

    records_received: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    records_normalized: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    records_quarantined: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    last_error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    error_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )


class ConnectorSyncState(Base):
    __tablename__ = "connector_sync_state"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    connector_name: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
    )

    last_value: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )


class NormalizedUser(Base):
    __tablename__ = "normalized_users"

    __table_args__ = (
        UniqueConstraint(
            "source",
            "id",
            name="uq_normalized_users_source_id",
        ),
    )

    pk: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    id: Mapped[str] = mapped_column(
        String(255),
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(320))
    status: Mapped[str] = mapped_column(String(100))
    source: Mapped[str] = mapped_column(String(255), index=True)

    last_login: Mapped[datetime] = mapped_column(
        DateTime(timezone=True)
    )

    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )


class NormalizedDevice(Base):
    __tablename__ = "normalized_devices"

    __table_args__ = (
        UniqueConstraint(
            "source",
            "id",
            name="uq_normalized_devices_source_id",
        ),
    )

    pk: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    id: Mapped[str] = mapped_column(
        String(255),
        index=True,
    )

    hostname: Mapped[str] = mapped_column(String(255))
    ip: Mapped[str] = mapped_column(String(100))
    os: Mapped[str] = mapped_column(String(255))
    owner: Mapped[str] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(255), index=True)

    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True)
    )

    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )


class NormalizedEvent(Base):
    __tablename__ = "normalized_events"

    __table_args__ = (
        UniqueConstraint(
            "source",
            "id",
            name="uq_normalized_events_source_id",
        ),
    )

    pk: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    id: Mapped[str] = mapped_column(
        String(255),
        index=True,
    )

    type: Mapped[str] = mapped_column(String(255))
    severity: Mapped[str] = mapped_column(String(100))

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True)
    )

    description: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(255), index=True)

    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )


class QuarantinedRecord(Base):
    __tablename__ = "quarantined_records"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    connector_name: Mapped[str] = mapped_column(
        String(255),
        index=True,
    )

    record_index: Mapped[int] = mapped_column(Integer)

    error: Mapped[str] = mapped_column(Text)

    raw_record: Mapped[str] = mapped_column(Text)

    quarantined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )


class AppUser(Base):
    __tablename__ = "app_users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    username: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="viewer",
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )


class SecurityAuditLog(Base):
    __tablename__ = "security_audit_logs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    actor_user_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )

    username: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    outcome: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    client_ip: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    detail: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )


class EncryptedSecret(Base):
    __tablename__ = "encrypted_secrets"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    name: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        index=True,
        nullable=False,
    )

    ciphertext: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    nonce: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    fingerprint: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    algorithm: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="AES-256-GCM",
    )

    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    rotated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    updated_by_user_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

