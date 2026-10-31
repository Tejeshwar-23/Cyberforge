from dataclasses import dataclass


@dataclass(frozen=True)
class DriftAssessment:
    suspected_drift: bool
    drift_type: str | None
    repairability: str
    auto_patch_allowed: bool
    reason: str


def assess_connector_failure(
    error_type: str | None,
    *,
    previously_healthy: bool = False,
) -> DriftAssessment:

    if error_type == "ENDPOINT_NOT_FOUND":
        return DriftAssessment(
            suspected_drift=True,
            drift_type="ENDPOINT_DRIFT",
            repairability=(
                "candidate_discovery_required"
                if previously_healthy
                else "manual_verification_required"
            ),
            auto_patch_allowed=False,
            reason=(
                "The configured endpoint returned HTTP 404. "
                "If this connector worked previously, the vendor "
                "may have changed the endpoint path or API version."
            ),
        )

    if error_type == "RESPONSE_FORMAT_ERROR":
        return DriftAssessment(
            suspected_drift=True,
            drift_type="RESPONSE_FORMAT_DRIFT",
            repairability="candidate_patch_possible",
            auto_patch_allowed=False,
            reason=(
                "The source responded but the configured response "
                "format could not be parsed."
            ),
        )

    if error_type == "PAGINATION_ERROR":
        return DriftAssessment(
            suspected_drift=True,
            drift_type="PAGINATION_DRIFT",
            repairability="candidate_patch_possible",
            auto_patch_allowed=False,
            reason=(
                "The pagination contract may have changed, such as "
                "a renamed cursor, page field, or has-more field."
            ),
        )

    if error_type == "INCREMENTAL_SYNC_ERROR":
        return DriftAssessment(
            suspected_drift=True,
            drift_type="SCHEMA_DRIFT",
            repairability="candidate_patch_possible",
            auto_patch_allowed=False,
            reason=(
                "The configured incremental source field is missing "
                "or no longer contains the expected timestamp."
            ),
        )

    if error_type in {
        "AUTHENTICATION_ERROR",
        "PERMISSION_ERROR",
        "SECRET_ERROR",
    }:
        return DriftAssessment(
            suspected_drift=False,
            drift_type=None,
            repairability="security_sensitive",
            auto_patch_allowed=False,
            reason=(
                "Authentication, permission, or secret failures "
                "must never be automatically repaired."
            ),
        )

    if error_type in {
        "RATE_LIMITED",
        "SOURCE_SERVER_ERROR",
        "NETWORK_ERROR",
        "TIMEOUT_ERROR",
    }:
        return DriftAssessment(
            suspected_drift=False,
            drift_type=None,
            repairability="retry_or_recovery",
            auto_patch_allowed=False,
            reason=(
                "This failure is operational rather than evidence "
                "of configuration drift."
            ),
        )

    return DriftAssessment(
        suspected_drift=False,
        drift_type=None,
        repairability="unknown",
        auto_patch_allowed=False,
        reason="No safe drift conclusion can be made.",
    )
