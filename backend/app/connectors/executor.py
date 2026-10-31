import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin

import httpx

from backend.app.connectors.auth import prepare_authentication
from backend.app.connectors.schema import ConnectorConfig
from backend.app.connectors.secrets import SecretResolver


class ConnectorRequestError(Exception):
    """Raised when a connector HTTP request ultimately fails."""


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

    headers = dict(config.endpoint.headers)
    headers.update(prepared_auth.headers)

    params = dict(config.endpoint.query_params)

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
                        "Rate limit exceeded after maximum retries"
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
                        f"HTTP {response.status_code}"
                    )

                time.sleep(
                    2 ** (attempt - 1)
                )
                continue

            if response.status_code >= 400:
                raise ConnectorRequestError(
                    f"Connector request failed: "
                    f"HTTP {response.status_code}"
                )

            return response

        except (
            httpx.TimeoutException,
            httpx.TransportError,
        ) as exc:

            last_error = exc

            if attempt == max_attempts:
                break

            time.sleep(
                2 ** (attempt - 1)
            )

    raise ConnectorRequestError(
        "Connector request failed after retry attempts"
    ) from last_error
