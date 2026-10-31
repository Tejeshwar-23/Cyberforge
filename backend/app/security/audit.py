from backend.app.db.database import SessionLocal
from backend.app.db.models import SecurityAuditLog


def write_security_audit(
    *,
    action: str,
    outcome: str,
    username: str | None = None,
    actor_user_id: int | None = None,
    client_ip: str | None = None,
    detail: str | None = None,
) -> None:

    safe_detail = (
        detail[:500]
        if detail is not None
        else None
    )

    with SessionLocal() as session:
        entry = SecurityAuditLog(
            actor_user_id=actor_user_id,
            username=username,
            action=action,
            outcome=outcome,
            client_ip=client_ip,
            detail=safe_detail,
        )

        session.add(entry)
        session.commit()
