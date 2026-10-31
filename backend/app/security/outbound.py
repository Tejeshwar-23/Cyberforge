import ipaddress
import socket
from urllib.parse import urlsplit

from backend.app.core.config import settings


class OutboundPolicyError(Exception):
    """Raised when an outbound connector URL violates security policy."""


BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "metadata",
}


def _is_blocked_ip(
    address: str,
) -> bool:

    ip = ipaddress.ip_address(
        address
    )

    return any(
        (
            ip.is_private,
            ip.is_loopback,
            ip.is_link_local,
            ip.is_multicast,
            ip.is_reserved,
            ip.is_unspecified,
        )
    )


def _development_mock_allowed(
    hostname: str,
    port: int | None,
) -> bool:

    if settings.app_env.lower() != "development":
        return False

    # Exact local mock exception only.
    return (
        hostname.lower()
        in {
            "localhost",
            "127.0.0.1",
            "::1",
        }
        and port == 9001
    )


def validate_outbound_url(
    url: str,
) -> None:

    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError as exc:
        raise OutboundPolicyError(
            "Outbound URL contains an invalid port"
        ) from exc

    if parsed.scheme not in {
        "http",
        "https",
    }:
        raise OutboundPolicyError(
            "Only HTTP and HTTPS connector URLs are allowed"
        )

    if (
        parsed.username is not None
        or parsed.password is not None
    ):
        raise OutboundPolicyError(
            "Credentials must not be embedded in connector URLs"
        )

    hostname = parsed.hostname

    if not hostname:
        raise OutboundPolicyError(
            "Outbound URL must contain a hostname"
        )

    hostname = hostname.lower().rstrip(".")

    if _development_mock_allowed(
        hostname,
        port,
    ):
        return

    if settings.app_env.lower() != "development":
        if parsed.scheme != "https":
            raise OutboundPolicyError(
                "Production connector URLs must use HTTPS"
            )

    if (
        hostname in BLOCKED_HOSTNAMES
        or hostname.endswith(".localhost")
    ):
        raise OutboundPolicyError(
            "Outbound destination is blocked by security policy"
        )

    effective_port = (
        port
        if port is not None
        else (
            443
            if parsed.scheme == "https"
            else 80
        )
    )

    # Literal IP address.
    try:
        literal_ip = ipaddress.ip_address(
            hostname
        )
    except ValueError:
        literal_ip = None

    if literal_ip is not None:
        if _is_blocked_ip(
            str(literal_ip)
        ):
            raise OutboundPolicyError(
                "Private, loopback, link-local, reserved, "
                "or otherwise unsafe IP destinations are blocked"
            )

        return

    # Resolve DNS before allowing the request.
    # Every resolved address must be publicly routable.
    try:
        results = socket.getaddrinfo(
            hostname,
            effective_port,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise OutboundPolicyError(
            "Outbound hostname could not be safely resolved"
        ) from exc

    if not results:
        raise OutboundPolicyError(
            "Outbound hostname did not resolve"
        )

    addresses = {
        item[4][0]
        for item in results
    }

    for address in addresses:
        if _is_blocked_ip(
            address
        ):
            raise OutboundPolicyError(
                "Outbound hostname resolves to a blocked "
                "private or internal network address"
            )
