from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from pydantic import BaseModel, Field, SecretStr

from backend.app.core.config import settings
from backend.app.db.models import AppUser
from backend.app.security.audit import (
    write_security_audit,
)
from backend.app.security.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
)
from backend.app.security.rate_limit import (
    RateLimitBackendUnavailable,
    clear_failed_logins,
    login_rate_limit_status,
    record_failed_login,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


class LoginRequest(BaseModel):
    username: str = Field(
        min_length=1,
        max_length=100,
    )

    password: SecretStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


def _client_ip(
    request: Request,
) -> str:
    # Do NOT trust X-Forwarded-For until a trusted
    # reverse-proxy configuration is explicitly added.
    if request.client is None:
        return "unknown"

    return request.client.host[:64]


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    payload: LoginRequest,
    request: Request,
):

    username = payload.username.strip()
    client_ip = _client_ip(request)

    try:
        limited, retry_after = (
            login_rate_limit_status(
                username,
                client_ip,
            )
        )

    except RateLimitBackendUnavailable:
        raise HTTPException(
            status_code=503,
            detail=(
                "Authentication protection "
                "temporarily unavailable"
            ),
        )

    if limited:
        write_security_audit(
            action="auth.login",
            outcome="rate_limited",
            username=username,
            client_ip=client_ip,
            detail="Login blocked by rate limit",
        )

        raise HTTPException(
            status_code=429,
            detail="Too many login attempts",
            headers={
                "Retry-After": str(
                    retry_after
                )
            },
        )

    user = authenticate_user(
        username,
        payload.password.get_secret_value(),
    )

    if user is None:
        try:
            failures = record_failed_login(
                username,
                client_ip,
            )
        except RateLimitBackendUnavailable:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Authentication protection "
                    "temporarily unavailable"
                ),
            )

        write_security_audit(
            action="auth.login",
            outcome="failure",
            username=username,
            client_ip=client_ip,
            detail="Invalid credentials",
        )

        if (
            failures
            >= settings.login_max_failures
        ):
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts",
                headers={
                    "Retry-After": str(
                        settings.login_window_seconds
                    )
                },
            )

        # Same response whether username exists or not.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Invalid username or password"
            ),
        )

    try:
        clear_failed_logins(
            username,
            client_ip,
        )
    except RateLimitBackendUnavailable:
        raise HTTPException(
            status_code=503,
            detail=(
                "Authentication protection "
                "temporarily unavailable"
            ),
        )

    write_security_audit(
        action="auth.login",
        outcome="success",
        username=user.username,
        actor_user_id=user.id,
        client_ip=client_ip,
        detail="Authentication successful",
    )

    return TokenResponse(
        access_token=create_access_token(
            user
        ),
        expires_in_minutes=(
            settings.jwt_access_minutes
        ),
    )


@router.get("/me")
def current_user(
    user: AppUser = Depends(
        get_current_user
    ),
):
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
    }
