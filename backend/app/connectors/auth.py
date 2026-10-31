from dataclasses import dataclass

import httpx

from backend.app.connectors.schema import (
    ApiKeyAuthConfig,
    BasicAuthConfig,
    BearerAuthConfig,
    CustomHeadersAuthConfig,
    NoAuthConfig,
)
from backend.app.connectors.secrets import SecretResolver


class AuthenticationError(Exception):
    """Raised when connector authentication cannot be prepared."""


@dataclass
class PreparedAuthentication:
    headers: dict[str, str]
    httpx_auth: httpx.Auth | None = None


def _check_header(name: str, value: str) -> None:
    if "\r" in name or "\n" in name:
        raise AuthenticationError(
            "Invalid authentication header name"
        )

    if "\r" in value or "\n" in value:
        raise AuthenticationError(
            "Invalid authentication header value"
        )


def prepare_authentication(
    auth_config,
    resolver: SecretResolver,
) -> PreparedAuthentication:

    if isinstance(auth_config, NoAuthConfig):
        return PreparedAuthentication(headers={})

    if isinstance(auth_config, ApiKeyAuthConfig):
        secret = resolver.resolve(
            auth_config.secret_ref
        )

        _check_header(
            auth_config.header,
            secret,
        )

        return PreparedAuthentication(
            headers={
                auth_config.header: secret
            }
        )

    if isinstance(auth_config, BearerAuthConfig):
        secret = resolver.resolve(
            auth_config.secret_ref
        )

        value = f"Bearer {secret}"

        _check_header(
            "Authorization",
            value,
        )

        return PreparedAuthentication(
            headers={
                "Authorization": value
            }
        )

    if isinstance(auth_config, BasicAuthConfig):
        username = resolver.resolve(
            auth_config.username_ref
        )

        password = resolver.resolve(
            auth_config.password_ref
        )

        return PreparedAuthentication(
            headers={},
            httpx_auth=httpx.BasicAuth(
                username,
                password,
            ),
        )

    if isinstance(
        auth_config,
        CustomHeadersAuthConfig,
    ):
        headers: dict[str, str] = {}

        for header_name, secret_ref in (
            auth_config.secret_headers.items()
        ):
            secret = resolver.resolve(
                secret_ref
            )

            _check_header(
                header_name,
                secret,
            )

            headers[header_name] = secret

        return PreparedAuthentication(
            headers=headers
        )

    raise AuthenticationError(
        "Unsupported authentication configuration"
    )
