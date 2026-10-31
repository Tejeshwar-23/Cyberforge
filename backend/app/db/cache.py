import redis

from backend.app.core.config import settings


redis_client = redis.Redis.from_url(
    settings.redis_url,
    decode_responses=True,
    socket_connect_timeout=3,
    socket_timeout=3,
)


def check_redis() -> bool:
    return bool(redis_client.ping())
