import math
from collections import Counter
from statistics import median
from threading import Lock

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy import select
from sklearn.ensemble import IsolationForest

from backend.app.db.database import SessionLocal
from backend.app.db.models import ConnectorRun
from backend.app.security.auth import require_roles


router = APIRouter(
    prefix="/api/risk",
    tags=["Risk Intelligence"],
    dependencies=[
        Depends(
            require_roles(
                "viewer",
                "operator",
                "admin",
            )
        )
    ],
)


IDLE_REGIME = "IDLE_INCREMENTAL"
SYNC_REGIME = "DATA_SYNC"

MIN_REGIME_SAMPLES = 15


# ==================================================
# BASIC RUN HELPERS
# ==================================================

def _duration_seconds(
    run: ConnectorRun,
) -> float | None:

    if (
        run.started_at is None
        or run.completed_at is None
    ):
        return None

    return max(
        (
            run.completed_at
            - run.started_at
        ).total_seconds(),
        0.0,
    )


def _behavior_regime(
    run: ConnectorRun,
) -> str:

    if (
        run.records_received or 0
    ) > 0:
        return SYNC_REGIME

    return IDLE_REGIME


def _run_base(
    run: ConnectorRun,
) -> dict:

    return {
        "run_id": run.id,
        "connector": run.connector_name,
        "status": run.status,
        "behavior_regime": (
            _behavior_regime(run)
        ),
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "duration_seconds": (
            _duration_seconds(run)
        ),
        "http_status": run.http_status,
        "pagination_type": (
            run.pagination_type
        ),
        "page_count": run.page_count,
        "records_received": (
            run.records_received
        ),
        "records_normalized": (
            run.records_normalized
        ),
        "records_quarantined": (
            run.records_quarantined
        ),
        "error_type": run.error_type,
    }


# ==================================================
# EXPLAINABLE OPERATIONAL RISK
# ==================================================

ERROR_WEIGHTS = {
    "AUTHENTICATION_ERROR": 35,
    "SECRET_ERROR": 35,
    "PERMISSION_ERROR": 35,
    "OUTBOUND_POLICY_BLOCKED": 40,
    "SELF_HEAL_RERUN_FAILED": 40,

    "RESPONSE_FORMAT_ERROR": 30,
    "PAGINATION_ERROR": 30,
    "INCREMENTAL_SYNC_ERROR": 30,

    "NETWORK_ERROR": 25,
    "TIMEOUT_ERROR": 25,
    "SOURCE_SERVER_ERROR": 25,
    "ENDPOINT_NOT_FOUND": 25,

    "RATE_LIMITED": 20,
    "BAD_REQUEST": 20,
}


def _risk_level(
    score: int,
) -> str:

    if score >= 75:
        return "CRITICAL"

    if score >= 50:
        return "HIGH"

    if score >= 25:
        return "MODERATE"

    return "LOW"


def _operational_risk(
    run: ConnectorRun,
    history: list[ConnectorRun],
) -> dict:

    score = 0
    signals = []


    if run.status == "failed":

        score += 45

        signals.append(
            {
                "signal": "RUN_FAILED",
                "weight": 45,
                "message": (
                    "Connector execution failed"
                ),
            }
        )


    if run.error_type:

        weight = ERROR_WEIGHTS.get(
            run.error_type,
            25,
        )

        score += weight

        signals.append(
            {
                "signal": run.error_type,
                "weight": weight,
                "message": (
                    "Classified connector "
                    "failure detected"
                ),
            }
        )


    status = run.http_status

    if status == 429:

        score += 20

        signals.append(
            {
                "signal": "HTTP_429",
                "weight": 20,
                "message": (
                    "Source rate limiting "
                    "was encountered"
                ),
            }
        )

    elif (
        status is not None
        and 500 <= status <= 599
    ):

        score += 25

        signals.append(
            {
                "signal": "HTTP_5XX",
                "weight": 25,
                "message": (
                    "Source server failure"
                ),
            }
        )

    elif (
        status is not None
        and 400 <= status <= 499
    ):

        score += 20

        signals.append(
            {
                "signal": "HTTP_4XX",
                "weight": 20,
                "message": (
                    "Source request was rejected"
                ),
            }
        )


    received = (
        run.records_received or 0
    )

    normalized = (
        run.records_normalized or 0
    )

    quarantined = (
        run.records_quarantined or 0
    )


    if received > 0:

        quarantine_ratio = (
            quarantined / received
        )

        if quarantine_ratio > 0:

            weight = min(
                40,
                max(
                    5,
                    round(
                        quarantine_ratio
                        * 40
                    ),
                ),
            )

            score += weight

            signals.append(
                {
                    "signal": (
                        "QUARANTINE_RATIO"
                    ),
                    "weight": weight,
                    "value": round(
                        quarantine_ratio,
                        4,
                    ),
                    "message": (
                        "One or more source "
                        "records were quarantined"
                    ),
                }
            )


        accounted = (
            normalized
            + quarantined
        )

        if accounted < received:

            missing_ratio = (
                received - accounted
            ) / received

            weight = min(
                30,
                max(
                    5,
                    round(
                        missing_ratio
                        * 30
                    ),
                ),
            )

            score += weight

            signals.append(
                {
                    "signal": (
                        "UNACCOUNTED_RECORDS"
                    ),
                    "weight": weight,
                    "value": round(
                        missing_ratio,
                        4,
                    ),
                    "message": (
                        "Some received records "
                        "were neither normalized "
                        "nor quarantined"
                    ),
                }
            )


    eligible = [
        item
        for item in history
        if item.id <= run.id
    ]

    recent = sorted(
        eligible,
        key=lambda item: item.id,
        reverse=True,
    )[:3]

    consecutive_failures = 0

    for item in recent:

        if item.status == "failed":
            consecutive_failures += 1
        else:
            break


    if consecutive_failures >= 2:

        score += 15

        signals.append(
            {
                "signal": (
                    "REPEATED_FAILURE"
                ),
                "weight": 15,
                "value": (
                    consecutive_failures
                ),
                "message": (
                    "Connector has repeated "
                    "consecutive failures"
                ),
            }
        )


    score = min(
        int(score),
        100,
    )

    return {
        "score": score,
        "level": _risk_level(score),
        "signals": signals,
        "explainable": True,
    }


# ==================================================
# REGIME-AWARE ML
# ==================================================

def _ml_vector(
    run: ConnectorRun,
    regime: str,
) -> list[float] | None:

    duration = _duration_seconds(
        run
    )

    if duration is None:
        return None


    page_count = max(
        run.page_count or 0,
        0,
    )


    if regime == IDLE_REGIME:

        # Idle incremental syncs normally have
        # no records. Duration is the strongest
        # useful behavioral signal; page count
        # remains available as a secondary signal.
        return [
            math.log1p(duration),
            math.log1p(page_count),
        ]


    received = max(
        run.records_received or 0,
        0,
    )

    normalized = max(
        run.records_normalized or 0,
        0,
    )

    quarantined = max(
        run.records_quarantined or 0,
        0,
    )


    normalization_rate = (
        normalized / received
        if received > 0
        else 1.0
    )

    quarantine_rate = (
        quarantined / received
        if received > 0
        else 0.0
    )


    return [
        math.log1p(duration),
        math.log1p(page_count),
        math.log1p(received),
        min(
            normalization_rate,
            1.0,
        ),
        min(
            quarantine_rate,
            1.0,
        ),
    ]


_REGIME_MODEL_CACHE: dict[tuple, dict] = {}
_REGIME_MODEL_CACHE_LOCK = Lock()
_PUBLIC_STATUS_CACHE: dict[tuple, dict] = {}
_PUBLIC_STATUS_CACHE_LOCK = Lock()


def _regime_training_signature(
    eligible: list[ConnectorRun],
) -> tuple:
    """
    Deterministic signature representing the full ML-relevant state of eligible runs.
    Includes ID, status, duration, page count, and record counts so any data change
    safely invalidates the cached model.
    """
    return tuple(
        (
            run.id,
            run.status,
            round(_duration_seconds(run) or 0, 4),
            run.page_count or 0,
            run.records_received or 0,
            run.records_normalized or 0,
            run.records_quarantined or 0,
        )
        for run in eligible
    )


def _build_regime_model(
    runs: list[ConnectorRun],
    regime: str,
    *,
    before_run_id: int | None = None,
) -> dict:

    eligible = []

    vectors = []


    for run in runs:

        if run.status != "healthy":
            continue

        if (
            before_run_id is not None
            and run.id >= before_run_id
        ):
            continue

        if (
            _behavior_regime(run)
            != regime
        ):
            continue

        vector = _ml_vector(
            run,
            regime,
        )

        if vector is None:
            continue

        eligible.append(run)
        vectors.append(vector)


    cache_key = (regime, _regime_training_signature(eligible))

    with _REGIME_MODEL_CACHE_LOCK:
        cached = _REGIME_MODEL_CACHE.get(cache_key)
        if cached is not None:
            return cached

    if len(vectors) < MIN_REGIME_SAMPLES:

        result = {
            "available": False,
            "status": (
                "INSUFFICIENT_HISTORY"
            ),
            "regime": regime,
            "training_samples": (
                len(vectors)
            ),
            "minimum_required": (
                MIN_REGIME_SAMPLES
            ),
            "reason": (
                f"At least "
                f"{MIN_REGIME_SAMPLES} "
                f"earlier healthy "
                f"{regime} runs are required"
            ),
        }
        with _REGIME_MODEL_CACHE_LOCK:
            _REGIME_MODEL_CACHE[cache_key] = result
        return result


    durations = [
        round(
            _duration_seconds(run)
            or 0,
            3,
        )
        for run in eligible
    ]


    if len(set(durations)) < 8:

        result = {
            "available": False,
            "status": (
                "INSUFFICIENT_VARIATION"
            ),
            "regime": regime,
            "training_samples": (
                len(vectors)
            ),
            "reason": (
                "Comparable healthy runs "
                "do not yet contain enough "
                "duration variation"
            ),
        }
        with _REGIME_MODEL_CACHE_LOCK:
            _REGIME_MODEL_CACHE[cache_key] = result
        return result


    if regime == SYNC_REGIME:

        page_values = {
            run.page_count or 0
            for run in eligible
        }

        volume_values = {
            run.records_received or 0
            for run in eligible
        }

        if (
            len(page_values) < 2
            and len(volume_values) < 2
        ):

            result = {
                "available": False,
                "status": (
                    "INSUFFICIENT_VARIATION"
                ),
                "regime": regime,
                "training_samples": (
                    len(vectors)
                ),
                "reason": (
                    "Data-sync history lacks "
                    "enough page/volume variation"
                ),
            }
            with _REGIME_MODEL_CACHE_LOCK:
                _REGIME_MODEL_CACHE[cache_key] = result
            return result


    model = IsolationForest(
        n_estimators=300,
        contamination=0.05,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(vectors)


    training_raw = [
        -float(value)
        for value
        in model.decision_function(
            vectors
        )
    ]


    result = {
        "available": True,
        "status": "AVAILABLE",
        "regime": regime,
        "model": model,
        "training_raw": training_raw,
        "training_samples": (
            len(vectors)
        ),
        "training_scope": (
            "earlier_healthy_runs_"
            + regime.lower()
        ),
        "feature_baseline": {
            "duration_seconds_median": (
                median(
                    [
                        _duration_seconds(run)
                        or 0
                        for run in eligible
                    ]
                )
            ),
            "page_count_median": (
                median(
                    [
                        run.page_count or 0
                        for run in eligible
                    ]
                )
            ),
            "records_received_median": (
                median(
                    [
                        run.records_received
                        or 0
                        for run in eligible
                    ]
                )
            ),
        },
    }

    with _REGIME_MODEL_CACHE_LOCK:
        _REGIME_MODEL_CACHE[cache_key] = result

    return result


def _ml_score(
    run: ConnectorRun,
    runs: list[ConnectorRun],
) -> dict:

    regime = _behavior_regime(
        run
    )

    context = _build_regime_model(
        runs,
        regime,
        before_run_id=run.id,
    )


    if not context.get(
        "available"
    ):

        return {
            "available": False,
            "status": context[
                "status"
            ],
            "regime": regime,
            "training_samples": (
                context[
                    "training_samples"
                ]
            ),
            "score": None,
            "classification": None,
            "reason": context[
                "reason"
            ],
        }


    vector = _ml_vector(
        run,
        regime,
    )

    if vector is None:

        return {
            "available": False,
            "status": "RUN_INCOMPLETE",
            "regime": regime,
            "training_samples": (
                context[
                    "training_samples"
                ]
            ),
            "score": None,
            "classification": None,
            "reason": (
                "Completed duration is "
                "required for ML scoring"
            ),
        }


    model = context["model"]

    raw = -float(
        model.decision_function(
            [vector]
        )[0]
    )

    training_raw = context[
        "training_raw"
    ]

    percentile = (
        sum(
            1
            for value in training_raw
            if value <= raw
        )
        / len(training_raw)
    )

    score = round(
        percentile * 100,
        1,
    )


    model_flagged = (
        int(
            model.predict(
                [vector]
            )[0]
        )
        == -1
    )


    # A high percentile alone is not enough
    # to call a run anomalous. The trained
    # IsolationForest must also flag it.
    if (
        model_flagged
        and score >= 95
    ):
        classification = "ANOMALOUS"

    elif (
        model_flagged
        or score >= 90
    ):
        classification = "ELEVATED"

    else:
        classification = "NORMAL"


    baseline = context[
        "feature_baseline"
    ]

    observations = []

    duration = (
        _duration_seconds(run)
        or 0
    )

    median_duration = (
        baseline[
            "duration_seconds_median"
        ]
    )


    if (
        median_duration > 0
        and duration
        > median_duration * 3
    ):

        observations.append(
            "Run duration is more than "
            "3x the comparable healthy "
            "baseline median"
        )


    if regime == SYNC_REGIME:

        median_pages = (
            baseline[
                "page_count_median"
            ]
        )

        median_records = (
            baseline[
                "records_received_median"
            ]
        )


        if (
            (run.page_count or 0)
            > max(
                median_pages * 2,
                2,
            )
        ):

            observations.append(
                "Page count is unusually high "
                "for comparable data-sync runs"
            )


        if (
            (run.records_received or 0)
            > max(
                median_records * 2,
                100,
            )
        ):

            observations.append(
                "Record volume is unusually high "
                "for comparable data-sync runs"
            )


    return {
        "available": True,
        "status": "AVAILABLE",
        "model": "IsolationForest",
        "regime": regime,
        "training_scope": (
            context[
                "training_scope"
            ]
        ),
        "training_samples": (
            context[
                "training_samples"
            ]
        ),
        "score": score,
        "classification": (
            classification
        ),
        "model_flagged_anomaly": (
            model_flagged
        ),
        "observations": observations,
        "interpretation": (
            "Behavioral deviation from "
            "earlier healthy runs in the "
            "same operating regime; this "
            "is not a security verdict."
        ),
    }


# ==================================================
# DATA LOAD
# ==================================================

def _load_runs() -> list[ConnectorRun]:

    with SessionLocal() as session:

        return list(
            session.scalars(
                select(ConnectorRun)
                .order_by(
                    ConnectorRun.id
                )
            ).all()
        )


def _group_history(
    runs: list[ConnectorRun],
) -> dict[str, list[ConnectorRun]]:

    grouped = {}

    for run in runs:

        grouped.setdefault(
            run.connector_name,
            [],
        ).append(run)

    return grouped


def _combined_analysis(
    run: ConnectorRun,
    connector_history: list[ConnectorRun],
    all_runs: list[ConnectorRun],
) -> dict:

    return {
        "run": _run_base(run),
        "operational_risk": (
            _operational_risk(
                run,
                connector_history,
            )
        ),
        "ml_anomaly": (
            _ml_score(
                run,
                all_runs,
            )
        ),
    }



_ANALYSIS_CACHE: dict[str, dict] = {}
_ANALYSIS_CACHE_LOCK = Lock()


def _analysis_signature(
    runs: list[ConnectorRun],
    *,
    max_run_id: int | None = None,
):
    """
    Return the run-state signature relevant to one target run.

    A newly-created run with a larger ID cannot change the historical
    baseline of an older target because ML training already enforces
    run.id < before_run_id.

    Therefore older connector analyses remain valid when unrelated
    newer runs are added.
    """

    relevant = (
        runs
        if max_run_id is None
        else (
            run
            for run in runs
            if run.id <= max_run_id
        )
    )

    return tuple(
        (
            run.id,
            run.connector_name,
            run.status,
            run.started_at,
            run.completed_at,
            run.http_status,
            run.pagination_type,
            run.page_count,
            run.records_received,
            run.records_normalized,
            run.records_quarantined,
            run.error_type,
        )
        for run in relevant
    )


def _latest_connector_analyses(
    runs: list[ConnectorRun],
    histories: dict[str, list[ConnectorRun]],
) -> dict[str, dict]:
    """
    Cache each connector independently.

    Previously any run change invalidated every connector analysis,
    causing many 300-tree IsolationForest models to be retrained.

    A connector is now recomputed only when data capable of affecting
    that connector's latest-run analysis changes.

    The lock also prevents /summary and /connectors from rebuilding
    the same ML models concurrently.
    """

    current_connectors = set(histories)

    with _ANALYSIS_CACHE_LOCK:

        # Remove entries for connectors that no longer exist.
        for connector in list(_ANALYSIS_CACHE):
            if connector not in current_connectors:
                del _ANALYSIS_CACHE[connector]

        for connector in sorted(histories):

            history = histories[connector]
            target = history[-1]

            signature = _analysis_signature(
                runs,
                max_run_id=target.id,
            )

            cached = _ANALYSIS_CACHE.get(
                connector
            )

            if (
                cached is not None
                and cached["signature"]
                == signature
            ):
                continue

            _ANALYSIS_CACHE[connector] = {
                "signature": signature,
                "analysis": _combined_analysis(
                    target,
                    history,
                    runs,
                ),
            }

        return {
            connector: entry["analysis"]
            for connector, entry
            in _ANALYSIS_CACHE.items()
        }


def _public_model_status(
    runs: list[ConnectorRun],
    regime: str,
) -> dict:
    """
    Return serializable public model status metadata for /api/risk/summary.
    Cached by the regime signature so repeated summary requests do not re-extract
    or recompute metadata when historical runs have not changed.
    """
    eligible = [
        run for run in runs
        if run.status == "healthy" and _behavior_regime(run) == regime
    ]
    cache_key = (regime, _regime_training_signature(eligible))

    with _PUBLIC_STATUS_CACHE_LOCK:
        cached = _PUBLIC_STATUS_CACHE.get(cache_key)
        if cached is not None:
            return cached

    context = _build_regime_model(
        runs,
        regime,
    )

    result = {
        key: value
        for key, value in context.items()
        if key not in {
            "model",
            "training_raw",
        }
    }

    with _PUBLIC_STATUS_CACHE_LOCK:
        _PUBLIC_STATUS_CACHE[cache_key] = result

    return result


# ==================================================
# API
# ==================================================

@router.get("/summary")
def risk_summary():

    runs = _load_runs()

    if not runs:

        return {
            "total_runs": 0,
            "connectors": 0,
            "risk_distribution": {},
            "ml_strategy": (
                "regime_aware_isolation_forest"
            ),
            "ml_models": {},
            "top_risk_connectors": [],
        }


    histories = _group_history(
        runs
    )

    latest = [
        history[-1]
        for history
        in histories.values()
    ]


    cached = (
        _latest_connector_analyses(
            runs,
            histories,
        )
    )

    analyses = [
        cached[
            run.connector_name
        ]
        for run in latest
    ]


    distribution = Counter(
        item[
            "operational_risk"
        ]["level"]
        for item in analyses
    )


    ranked = sorted(
        analyses,
        key=lambda item: (
            item[
                "operational_risk"
            ]["score"],
            (
                item[
                    "ml_anomaly"
                ]["score"]
                if item[
                    "ml_anomaly"
                ].get("score")
                is not None
                else -1
            ),
        ),
        reverse=True,
    )


    return {
        "total_runs": len(runs),
        "healthy_runs": sum(
            1
            for run in runs
            if run.status == "healthy"
        ),
        "failed_runs": sum(
            1
            for run in runs
            if run.status == "failed"
        ),
        "connectors": len(
            histories
        ),
        "risk_distribution": (
            dict(distribution)
        ),
        "ml_strategy": (
            "regime_aware_isolation_forest"
        ),
        "ml_methodology": (
            "Each run is compared only with "
            "earlier healthy executions from "
            "the same behavioral regime."
        ),
        "ml_models": {
            IDLE_REGIME: (
                _public_model_status(
                    runs,
                    IDLE_REGIME,
                )
            ),
            SYNC_REGIME: (
                _public_model_status(
                    runs,
                    SYNC_REGIME,
                )
            ),
        },
        "top_risk_connectors": [
            {
                "connector": (
                    item["run"][
                        "connector"
                    ]
                ),
                "latest_run_id": (
                    item["run"][
                        "run_id"
                    ]
                ),
                "behavior_regime": (
                    item["run"][
                        "behavior_regime"
                    ]
                ),
                "operational_risk": (
                    item[
                        "operational_risk"
                    ]
                ),
                "ml_anomaly": (
                    item[
                        "ml_anomaly"
                    ]
                ),
            }
            for item in ranked[:10]
        ],
    }


@router.get("/connectors")
def connector_risk():

    runs = _load_runs()

    histories = _group_history(
        runs
    )

    items = []


    for connector in sorted(
        histories
    ):

        history = histories[
            connector
        ]

        run = history[-1]

        cached = (
            _latest_connector_analyses(
                runs,
                histories,
            )
        )

        analysis = dict(
            cached[
                connector
            ]
        )

        analysis[
            "connector_history_count"
        ] = len(history)

        items.append(
            analysis
        )


    items.sort(
        key=lambda item: (
            item[
                "operational_risk"
            ]["score"],
            (
                item[
                    "ml_anomaly"
                ]["score"]
                if item[
                    "ml_anomaly"
                ].get("score")
                is not None
                else -1
            ),
        ),
        reverse=True,
    )


    return {
        "items": items,
        "returned": len(items),
    }


@router.get("/runs/{run_id}")
def run_risk(
    run_id: int,
):

    runs = _load_runs()

    target = next(
        (
            run
            for run in runs
            if run.id == run_id
        ),
        None,
    )

    if target is None:
        raise HTTPException(
            status_code=404,
            detail="Connector run not found",
        )


    histories = _group_history(
        runs
    )


    return _combined_analysis(
        target,
        histories[
            target.connector_name
        ],
        runs,
    )
