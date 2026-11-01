import os
import re
from pathlib import Path
from uuid import uuid4

import yaml
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
)
from sqlalchemy import (
    func,
    select,
)

from backend.app.connectors.loader import (
    validate_connector_config,
)
from backend.app.connectors.runner import (
    ConnectorRunError,
    run_connector,
)
from backend.app.db.database import (
    SessionLocal,
)
from backend.app.db.models import (
    AppUser,
    SecurityAuditLog,
)
from backend.app.security.audit import (
    write_security_audit,
)
from backend.app.security.auth import (
    require_roles,
)


router = APIRouter(
    tags=["Self Healing"],
)


PROJECT_ROOT = (
    Path(__file__).resolve().parents[3]
)

CONNECTOR_ROOT = (
    PROJECT_ROOT
    / "configs"
    / "connectors"
)

DRIFT_ROOT = (
    PROJECT_ROOT
    / "mock-services"
    / "generated-integrations"
    / "cyberforge_mock_security_integrations"
    / "schema-drift-tests"
)

DEMO_TEMPLATE = (
    CONNECTOR_ROOT
    / "sophos-auto-heal-demo.yaml"
)

LIVE_SCENARIO_ID = (
    "sophos-intercept-x-events"
)


def _client_ip(
    request: Request,
) -> str:

    if request.client is None:
        return "unknown"

    return request.client.host[:64]


def _parse_audit(
    row: SecurityAuditLog,
) -> dict:

    detail = row.detail or ""

    connector = None
    message = detail

    match = re.match(
        r"^Connector ([^:]+):\s*(.*)$",
        detail,
    )

    if match:
        connector = match.group(1)
        message = match.group(2)

    old_path = None
    new_path = None

    arrow = re.search(
        r"([A-Za-z0-9_.-]+)"
        r"\s*->\s*"
        r"([A-Za-z0-9_.-]+)",
        message,
    )

    if arrow:
        old_path = arrow.group(1)
        new_path = arrow.group(2)

    risk_level = None

    if "low-risk" in message.lower():
        risk_level = "LOW"

    return {
        "audit_id": row.id,
        "connector": connector,
        "outcome": row.outcome,
        "old_source_path": old_path,
        "new_source_path": new_path,
        "risk_level": risk_level,
        "message": message,
        "occurred_at": row.occurred_at,
    }


def _load_scenarios() -> list[dict]:

    if not DRIFT_ROOT.exists():
        raise RuntimeError(
            "Schema drift definition directory "
            "does not exist"
        )

    scenarios = []

    files = sorted(
        DRIFT_ROOT.glob("*.yaml")
    )

    for path in files:

        raw = yaml.safe_load(
            path.read_text(
                encoding="utf-8"
            )
        )

        if not isinstance(raw, dict):
            raise RuntimeError(
                "Invalid drift definition: "
                + path.name
            )

        vendor = raw.get(
            "vendor",
            path.stem,
        )

        for entity_name in (
            "users",
            "devices",
            "events",
        ):

            spec = raw.get(
                entity_name
            )

            if not isinstance(
                spec,
                dict,
            ):
                raise RuntimeError(
                    "Missing drift scenario "
                    f"{entity_name} in "
                    f"{path.name}"
                )

            scenario_id = (
                f"{path.stem}-"
                f"{entity_name}"
            )

            scenarios.append(
                {
                    "scenario_id": (
                        scenario_id
                    ),
                    "source_id": (
                        path.stem
                    ),
                    "vendor": vendor,
                    "entity": (
                        entity_name[:-1]
                    ),
                    "connector": (
                        scenario_id
                    ),
                    "drift_type": (
                        spec.get(
                            "drift_type"
                        )
                    ),
                    "old_path": (
                        spec.get(
                            "old_path"
                        )
                    ),
                    "new_path": (
                        spec.get(
                            "new_path"
                        )
                    ),
                    "expected_risk": (
                        spec.get(
                            "expected_risk"
                        )
                    ),
                    "live_demo_available": (
                        scenario_id
                        == LIVE_SCENARIO_ID
                    ),
                }
            )

    return scenarios


def _find_scenario(
    scenario_id: str,
) -> dict | None:

    for scenario in _load_scenarios():
        if (
            scenario["scenario_id"]
            == scenario_id
        ):
            return scenario

    return None


# ==================================================
# SELF-HEAL HISTORY
# ==================================================

@router.get("/api/self-heal/summary")
def self_heal_summary(
    user: AppUser = Depends(
        require_roles(
            "viewer",
            "operator",
            "admin",
        )
    ),
):

    with SessionLocal() as session:

        grouped = session.execute(
            select(
                SecurityAuditLog.outcome,
                func.count(
                    SecurityAuditLog.id
                ),
            )
            .where(
                SecurityAuditLog.action
                == "self_heal.auto"
            )
            .group_by(
                SecurityAuditLog.outcome
            )
        ).all()

        latest = session.scalar(
            select(
                func.max(
                    SecurityAuditLog.occurred_at
                )
            )
            .where(
                SecurityAuditLog.action
                == "self_heal.auto"
            )
        )

    counts = {
        outcome: count
        for outcome, count
        in grouped
    }

    return {
        "audit_events": sum(
            counts.values()
        ),
        "applied": counts.get(
            "applied",
            0,
        ),
        "verified": counts.get(
            "verified",
            0,
        ),
        "rolled_back": counts.get(
            "rolled_back",
            0,
        ),
        "not_applied": counts.get(
            "not_applied",
            0,
        ),
        "latest_event_at": latest,
    }


@router.get("/api/self-heal/history")
def self_heal_history(
    outcome: str | None = Query(
        default=None,
        max_length=50,
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
    ),
    user: AppUser = Depends(
        require_roles(
            "viewer",
            "operator",
            "admin",
        )
    ),
):

    stmt = (
        select(
            SecurityAuditLog
        )
        .where(
            SecurityAuditLog.action
            == "self_heal.auto"
        )
    )

    if outcome:
        stmt = stmt.where(
            SecurityAuditLog.outcome
            == outcome
        )

    stmt = (
        stmt
        .order_by(
            SecurityAuditLog.id.desc()
        )
        .limit(limit)
    )

    with SessionLocal() as session:
        rows = session.scalars(
            stmt
        ).all()

    return {
        "items": [
            _parse_audit(row)
            for row in rows
        ],
        "returned": len(rows),
        "outcome_filter": outcome,
    }


@router.get(
    "/api/self-heal/history/{audit_id}"
)
def self_heal_history_detail(
    audit_id: int,
    user: AppUser = Depends(
        require_roles(
            "viewer",
            "operator",
            "admin",
        )
    ),
):

    with SessionLocal() as session:

        row = session.get(
            SecurityAuditLog,
            audit_id,
        )

        if (
            row is None
            or row.action
            != "self_heal.auto"
        ):
            raise HTTPException(
                status_code=404,
                detail=(
                    "Self-heal audit event "
                    "not found"
                ),
            )

        return _parse_audit(
            row
        )


# ==================================================
# DRIFT SCENARIOS
# ==================================================

@router.get(
    "/api/reliability/schema-drift-scenarios"
)
def schema_drift_scenarios(
    user: AppUser = Depends(
        require_roles(
            "viewer",
            "operator",
            "admin",
        )
    ),
):

    try:
        scenarios = (
            _load_scenarios()
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to load schema "
                "drift definitions"
            ),
        ) from exc

    return {
        "scenario_count": len(
            scenarios
        ),
        "live_demo_count": sum(
            1
            for scenario
            in scenarios
            if scenario[
                "live_demo_available"
            ]
        ),
        "scenarios": scenarios,
    }


# ==================================================
# REAL SELF-HEAL DEMO
# ==================================================

@router.post(
    "/api/reliability/"
    "schema-drift-test/{scenario_id}"
)
def schema_drift_test(
    scenario_id: str,
    request: Request,
    user: AppUser = Depends(
        require_roles(
            "operator",
            "admin",
        )
    ),
):

    scenario = _find_scenario(
        scenario_id
    )

    if scenario is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Schema drift scenario "
                "not found"
            ),
        )

    if (
        scenario_id
        != LIVE_SCENARIO_ID
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "error_type": (
                    "LIVE_DEMO_NOT_AVAILABLE"
                ),
                "message": (
                    "This scenario is currently "
                    "a validated drift definition "
                    "only. The live executable "
                    "demo is "
                    "sophos-intercept-x-events."
                ),
            },
        )

    if not DEMO_TEMPLATE.exists():
        raise HTTPException(
            status_code=500,
            detail=(
                "Sophos self-heal demo "
                "template is missing"
            ),
        )

    temp_path = None

    try:

        raw = yaml.safe_load(
            DEMO_TEMPLATE.read_text(
                encoding="utf-8"
            )
        )

        if not isinstance(
            raw,
            dict,
        ):
            raise RuntimeError(
                "Demo template is invalid"
            )

        endpoint = raw.get(
            "endpoint"
        )

        mapping = raw.get(
            "mapping"
        )

        incremental = raw.get(
            "incremental"
        )

        if not isinstance(
            endpoint,
            dict,
        ):
            raise RuntimeError(
                "Demo endpoint config missing"
            )

        if (
            endpoint.get("path")
            != "/sophos-drift/events"
        ):
            raise RuntimeError(
                "Unexpected demo endpoint"
            )

        if not isinstance(
            mapping,
            dict,
        ):
            raise RuntimeError(
                "Demo mapping missing"
            )

        fields = mapping.get(
            "fields"
        )

        if not isinstance(
            fields,
            dict,
        ):
            raise RuntimeError(
                "Demo mapping fields missing"
            )

        if not isinstance(
            incremental,
            dict,
        ):
            raise RuntimeError(
                "Demo incremental config missing"
            )


        # ------------------------------------------
        # Build an isolated temporary connector.
        #
        # Unique name means no previous incremental
        # checkpoint can affect this demonstration.
        # persist=False means no normalized/quarantine
        # business data is written.
        # ------------------------------------------

        demo_name = (
            "sophos-auto-heal-live-demo-"
            + uuid4().hex[:8]
        )

        raw["name"] = demo_name
        raw["enabled"] = False

        old_path = scenario[
            "old_path"
        ]

        new_path = scenario[
            "new_path"
        ]

        fields["timestamp"] = (
            old_path
        )

        incremental["enabled"] = True
        incremental["source_field"] = (
            old_path
        )

        temp_path = (
            CONNECTOR_ROOT
            / f"{demo_name}.yaml"
        )

        staging_path = (
            CONNECTOR_ROOT
            / f".{demo_name}.tmp"
        )

        with staging_path.open(
            "w",
            encoding="utf-8",
        ) as handle:
            yaml.safe_dump(
                raw,
                handle,
                sort_keys=False,
                allow_unicode=True,
            )

        os.replace(
            staging_path,
            temp_path,
        )

        validate_connector_config(
            temp_path
        )


        # ------------------------------------------
        # Execute the REAL generic runner.
        #
        # The temporary config deliberately expects
        # raisedAt while the drift mock returns
        # createdAt.
        # ------------------------------------------

        try:
            result = run_connector(
                str(temp_path),
                persist=False,
            )

        except ConnectorRunError as exc:

            write_security_audit(
                action=(
                    "reliability."
                    "schema_drift_test"
                ),
                outcome="failed",
                username=user.username,
                actor_user_id=user.id,
                client_ip=_client_ip(
                    request
                ),
                detail=(
                    "Sophos live schema-drift "
                    "demo failed safely"
                ),
            )

            raise HTTPException(
                status_code=502,
                detail={
                    "error_type": (
                        "SELF_HEAL_DEMO_FAILED"
                    ),
                    "message": str(exc),
                },
            ) from exc


        heal = (
            result.get(
                "self_heal"
            )
            or {}
        )

        if not (
            heal.get("attempted")
            and heal.get("applied")
        ):
            raise HTTPException(
                status_code=502,
                detail={
                    "error_type": (
                        "SELF_HEAL_NOT_TRIGGERED"
                    ),
                    "message": (
                        "Drift was exercised but "
                        "automatic repair was not "
                        "successfully applied"
                    ),
                },
            )


        # ------------------------------------------
        # Inspect the patched temp YAML before
        # deleting it.
        # ------------------------------------------

        healed_raw = yaml.safe_load(
            temp_path.read_text(
                encoding="utf-8"
            )
        )

        healed_mapping = (
            healed_raw
            .get(
                "mapping",
                {},
            )
            .get(
                "fields",
                {},
            )
            .get(
                "timestamp"
            )
        )

        healed_incremental = (
            healed_raw
            .get(
                "incremental",
                {},
            )
            .get(
                "source_field"
            )
        )

        verified = (
            healed_mapping
            == new_path
            and healed_incremental
            == new_path
            and result.get(
                "normalized_count",
                0,
            )
            == result.get(
                "total_received",
                0,
            )
            and result.get(
                "quarantined_count",
                0,
            )
            == 0
            and result.get(
                "total_received",
                0,
            )
            > 0
        )

        if not verified:
            raise HTTPException(
                status_code=502,
                detail={
                    "error_type": (
                        "SELF_HEAL_VERIFICATION_FAILED"
                    ),
                    "message": (
                        "Repair returned success but "
                        "the final mapping/rerun proof "
                        "did not satisfy verification"
                    ),
                },
            )


        # Remove temporary connector after proof.
        temp_path.unlink()

        temp_removed = (
            not temp_path.exists()
        )


        write_security_audit(
            action=(
                "reliability."
                "schema_drift_test"
            ),
            outcome="success",
            username=user.username,
            actor_user_id=user.id,
            client_ip=_client_ip(
                request
            ),
            detail=(
                "Executed real Sophos events "
                "schema-drift self-heal demo"
            ),
        )


        return {
            "success": True,
            "lab_mode": True,
            "scenario_id": (
                scenario_id
            ),
            "vendor": (
                scenario["vendor"]
            ),
            "entity": (
                scenario["entity"]
            ),
            "drift_type": (
                scenario[
                    "drift_type"
                ]
            ),
            "expected_risk": (
                scenario[
                    "expected_risk"
                ]
            ),
            "demo_connector": (
                demo_name
            ),
            "drift": {
                "old_path": (
                    old_path
                ),
                "new_path": (
                    new_path
                ),
            },
            "records_received": (
                result.get(
                    "total_received"
                )
            ),
            "records_normalized": (
                result.get(
                    "normalized_count"
                )
            ),
            "records_quarantined": (
                result.get(
                    "quarantined_count"
                )
            ),
            "self_heal": heal,
            "final_mapping": {
                "timestamp": (
                    healed_mapping
                ),
                "incremental_source_field": (
                    healed_incremental
                ),
            },
            "full_rerun_verified": True,
            "persisted_to_normalized_tables": False,
            "quarantine_rows_persisted": False,
            "temporary_config_removed": (
                temp_removed
            ),
            "timeline": [
                {
                    "stage": (
                        "DRIFT_INJECTED"
                    ),
                    "status": "success",
                    "message": (
                        old_path
                        + " expected while source "
                        "returns "
                        + new_path
                    ),
                },
                {
                    "stage": (
                        "MAPPING_FAILURE_DETECTED"
                    ),
                    "status": "success",
                    "message": (
                        "Complete mapping failure "
                        "triggered conservative "
                        "repair analysis"
                    ),
                },
                {
                    "stage": (
                        "CANDIDATE_VALIDATED"
                    ),
                    "status": "success",
                    "message": (
                        f"{old_path} -> "
                        f"{new_path}"
                    ),
                },
                {
                    "stage": (
                        "REPAIR_APPLIED"
                    ),
                    "status": "success",
                    "message": (
                        "Low-risk mapping repair "
                        "was applied by the real "
                        "self-heal engine"
                    ),
                },
                {
                    "stage": (
                        "FULL_RERUN_VERIFIED"
                    ),
                    "status": "success",
                    "message": (
                        "Complete connector rerun "
                        "passed after repair"
                    ),
                },
            ],
        }


    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "error_type": (
                    "SELF_HEAL_DEMO_ERROR"
                ),
                "message": (
                    "Schema-drift demo failed "
                    "safely"
                ),
            },
        ) from exc

    finally:

        if (
            temp_path is not None
            and temp_path.exists()
        ):
            try:
                temp_path.unlink()
            except OSError:
                pass
