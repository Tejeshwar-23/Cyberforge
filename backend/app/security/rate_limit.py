import hashlib

import redis

from backend.app.core.config import settings
from backend.app.db.cache import redis_client


class RateLimitBackendUnavailable(RuntimeError):
    pass


def _login_key(
    username: str,
    client_ip: str,
) -> str:

    material = (
        username.strip().lower()
        + "|"
        + client_ip
    ).encode("utf-8")

    digest = hashlib.sha256(
        material
    ).hexdigest()

    return (
        "cyberforge:"
        "auth:"
        "login:"
        + digest
    )


def login_rate_limit_status(
    username: str,
    client_ip: str,
) -> tuple[bool, int]:

    key = _login_key(
        username,
        client_ip,
    )

    try:
        value = redis_client.get(key)
        ttl = redis_client.ttl(key)

    except redis.RedisError as exc:
        raise RateLimitBackendUnavailable(
            "Login protection unavailable"
        ) from exc

    failures = int(value or 0)

    retry_after = (
        ttl
        if ttl and ttl > 0
        else settings.login_window_seconds
    )

    return (
        failures
        >= settings.login_max_failures,
        retry_after,
    )


def record_failed_login(
    username: str,
    client_ip: str,
) -> int:

    key = _login_key(
        username,
        client_ip,
    )

    try:
        pipeline = redis_client.pipeline(
            transaction=True
        )

        pipeline.incr(key)

        # Sliding 5-minute protection window.
        pipeline.expire(
            key,
            settings.login_window_seconds,
        )

        results = pipeline.execute()

    except redis.RedisError as exc:
        raise RateLimitBackendUnavailable(
            "Login protection unavailable"
        ) from exc

    return int(results[0])


def clear_failed_logins(
    username: str,
    client_ip: str,
) -> None:

    key = _login_key(
        username,
        client_ip,
    )

    try:
        redis_client.delete(key)

    except redis.RedisError as exc:
        raise RateLimitBackendUnavailable(
            "Login protection unavailable"
        ) from exc
