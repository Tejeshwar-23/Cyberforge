import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin

import httpx

from backend.app.connectors.auth import prepare_authentication
from backend.app.connectors.schema import ConnectorConfig
from backend.app.connectors.secrets import SecretResolver
from backend.app.security.outbound import validate_outbound_url


class ConnectorRequestError(Exception):
    """Raised when a connector HTTP request ultimately fails."""

    def __init__(
        self,
        message: str,
        *,
        error_type: str,
        status_code: int | None = None,
    ):
        super().__init__(message)
        self.error_type = error_type
        self.status_code = status_code


def _retry_after_seconds(value: str | None) -> float:
    if not value:
        return 1.0

    value = value.strip()

    if value.isdigit():
        return max(float(value), 0.0)

    try:
        retry_time = parsedate_to_datetime(value)

        if retry_time.tzinfo is None:
            retry_time = retry_time.replace(
                tzinfo=timezone.utc
            )

        now = datetime.now(timezone.utc)

        return max(
            (retry_time - now).total_seconds(),
            0.0,
        )

    except Exception:
        return 1.0


def execute_request(
    config: ConnectorConfig,
    resolver: SecretResolver | None = None,
    *,
    max_attempts: int = 4,
    timeout_seconds: float = 20.0,
    params_override: dict | None = None,
) -> httpx.Response:

    resolver = resolver or SecretResolver()

    prepared_auth = prepare_authentication(
        config.auth,
        resolver,
    )

    url = urljoin(
        str(config.base_url).rstrip("/") + "/",
        config.endpoint.path.lstrip("/"),
    )

    # Validate the final URL, not only base_url.
    # This also prevents an absolute endpoint.path from
    # silently redirecting requests to another host.
    validate_outbound_url(url)

    headers = dict(config.endpoint.headers)
    headers.update(prepared_auth.headers)

    params = dict(config.endpoint.query_params)

    if params_override:
        params.update(params_override)

    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            with httpx.Client(
                timeout=timeout_seconds,
                follow_redirects=False,
            ) as client:

                response = client.request(
                    method=config.endpoint.method,
                    url=url,
                    params=params,
                    headers=headers,
                    auth=prepared_auth.httpx_auth,
                )

            if response.status_code == 429:
                if attempt == max_attempts:
                    raise ConnectorRequestError(
                        "Rate limit exceeded after maximum retries",
                        error_type="RATE_LIMITED",
                        status_code=429,
                    )

                wait_seconds = _retry_after_seconds(
                    response.headers.get("Retry-After")
                )

                time.sleep(wait_seconds)
                continue

            if 500 <= response.status_code <= 599:
                if attempt == max_attempts:
                    raise ConnectorRequestError(
                        f"Server error after maximum retries: "
                        f"HTTP {response.status_code}",
                        error_type="SOURCE_SERVER_ERROR",
                        status_code=response.status_code,
                    )

                time.sleep(
                    2 ** (attempt - 1)
                )
                continue

            if response.status_code >= 400:
                status = response.status_code

                error_map = {
                    400: "BAD_REQUEST",
                    401: "AUTHENTICATION_ERROR",
                    403: "PERMISSION_ERROR",
                    404: "ENDPOINT_NOT_FOUND",
                    408: "TIMEOUT_ERROR",
                }

                raise ConnectorRequestError(
                    f"Connector request failed: HTTP {status}",
                    error_type=error_map.get(
                        status,
                        "CLIENT_ERROR",
                    ),
                    status_code=status,
                )

            return response

        except httpx.TimeoutException as exc:
            last_error = exc

            if attempt == max_attempts:
                raise ConnectorRequestError(
                    "Connector request timed out after retry attempts",
                    error_type="TIMEOUT_ERROR",
                ) from exc

            time.sleep(
                2 ** (attempt - 1)
            )

        except httpx.TransportError as exc:
            last_error = exc

            if attempt == max_attempts:
                raise ConnectorRequestError(
                    "Connector network request failed after retry attempts",
                    error_type="NETWORK_ERROR",
                ) from exc

            time.sleep(
                2 ** (attempt - 1)
            )

    raise ConnectorRequestError(
        "Connector request failed after retry attempts",
        error_type="NETWORK_ERROR",
    ) from last_error
