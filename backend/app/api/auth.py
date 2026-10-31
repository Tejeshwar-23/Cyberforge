from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, SecretStr

from backend.app.db.models import AppUser
from backend.app.security.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
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


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(payload: LoginRequest):

    user = authenticate_user(
        payload.username,
        payload.password.get_secret_value(),
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    from backend.app.core.config import settings

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
