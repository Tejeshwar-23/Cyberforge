from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.db.database import SessionLocal
from backend.app.db.models import AppUser


JWT_ALGORITHM = "HS256"

password_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
)

bearer_scheme = HTTPBearer(
    auto_error=False,
)


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(
    password: str,
    password_hash: str,
) -> bool:
    return password_context.verify(
        password,
        password_hash,
    )


def authenticate_user(
    username: str,
    password: str,
) -> AppUser | None:

    with SessionLocal() as session:
        user = session.scalar(
            select(AppUser).where(
                AppUser.username == username
            )
        )

        if user is None:
            return None

        if not user.is_active:
            return None

        if not verify_password(
            password,
            user.password_hash,
        ):
            return None

        session.expunge(user)
        return user


def create_access_token(
    user: AppUser,
) -> str:

    now = datetime.now(timezone.utc)

    expires = now + timedelta(
        minutes=settings.jwt_access_minutes
    )

    payload = {
        "sub": str(user.id),
        "username": user.username,
        "iat": int(now.timestamp()),
        "exp": expires,
        "jti": str(uuid4()),
    }

    return jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=JWT_ALGORITHM,
    )


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={
            "WWW-Authenticate": "Bearer",
        },
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
) -> AppUser:

    if credentials is None:
        raise _unauthorized()

    if credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[JWT_ALGORITHM],
        )

        subject = payload.get("sub")

        if subject is None:
            raise _unauthorized()

        user_id = int(subject)

    except (
        JWTError,
        ValueError,
        TypeError,
    ):
        raise _unauthorized()

    with SessionLocal() as session:
        user = session.get(
            AppUser,
            user_id,
        )

        if (
            user is None
            or not user.is_active
        ):
            raise _unauthorized()

        session.expunge(user)
        return user


def require_roles(*allowed_roles: str):

    allowed = set(allowed_roles)

    def dependency(
        user: AppUser = Depends(
            get_current_user
        ),
    ) -> AppUser:

        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

        return user

    return dependency
