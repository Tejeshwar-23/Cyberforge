from getpass import getpass
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import select

from backend.app.db.database import SessionLocal
from backend.app.db.models import AppUser
from backend.app.security.auth import hash_password


username = input(
    "Admin username [admin]: "
).strip() or "admin"

password = getpass(
    "Admin password: "
)

confirmation = getpass(
    "Confirm password: "
)

if password != confirmation:
    raise SystemExit(
        "Passwords do not match"
    )

if len(password) < 14:
    raise SystemExit(
        "Password must be at least 14 characters"
    )

with SessionLocal() as session:
    existing = session.scalar(
        select(AppUser).where(
            AppUser.username == username
        )
    )

    if existing is not None:
        raise SystemExit(
            "That username already exists"
        )

    user = AppUser(
        username=username,
        password_hash=hash_password(
            password
        ),
        role="admin",
        is_active=True,
    )

    session.add(user)
    session.commit()
    session.refresh(user)

    print()
    print("[PASS] Admin account created")
    print("USER ID:", user.id)
    print("USERNAME:", user.username)
    print("ROLE:", user.role)
    print(
        "PASSWORD STORAGE: Argon2 hash only"
    )
