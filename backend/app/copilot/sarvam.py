import json
from dataclasses import dataclass
from typing import Any, Literal

import httpx
import yaml
from pydantic import ValidationError

from backend.app.connectors.schema import ConnectorConfig
from backend.app.connectors.secrets import (
    SecretResolutionError,
    SecretResolver,
)


SARVAM_URL = (
    "https://api.sarvam.ai/v1/chat/completions"
)

SARVAM_MODEL = "sarvam-105b"


class SarvamCopilotError(Exception):
    def __init__(
        self,
        error_type: str,
        message: str,
        *,
        status_code: int | None = None,
    ):
        super().__init__(message)

        self.error_type = error_type
        self.status_code = status_code


@dataclass(frozen=True)
class GeneratedConnectorDraft:
    connector: dict[str, Any]
    yaml_preview: str
    model: str
    usage: dict[str, Any]


def _canonical_fields(
    entity: Literal[
        "user",
        "device",
        "event",
    ],
) -> list[str]:

    if entity == "user":
        return [
            "id",
            "name",
            "email",
            "status",
            "last_login",
        ]

    if entity == "device":
        return [
            "id",
            "hostname",
            "ip",
            "os",
            "owner",
            "last_seen",
        ]

    return [
        "id",
        "type",
        "severity",
        "timestamp",
        "description",
    ]


def _extract_message_content(
    payload: dict[str, Any],
) -> str:

    try:
        content = (
            payload["choices"][0]
            ["message"]["content"]
        )
    except (
        KeyError,
        IndexError,
        TypeError,
    ) as exc:
        raise SarvamCopilotError(
            "COPILOT_PROVIDER_RESPONSE_ERROR",
            (
                "Sarvam returned an unexpected "
                "response structure"
            ),
        ) from exc

    if (
        not isinstance(content, str)
        or not content.strip()
    ):
        raise SarvamCopilotError(
            "COPILOT_PROVIDER_RESPONSE_ERROR",
            "Sarvam returned an empty draft",
        )

    return content.strip()


def _provider_error(
    status_code: int,
) -> SarvamCopilotError:

    if status_code == 403:
        return SarvamCopilotError(
            "COPILOT_AUTHENTICATION_ERROR",
            (
                "Sarvam authentication failed. "
                "Check SARVAM_API_KEY in the "
                "encrypted vault."
            ),
            status_code=status_code,
        )

    if status_code == 429:
        return SarvamCopilotError(
            "COPILOT_RATE_LIMITED",
            (
                "Sarvam temporarily rate-limited "
                "the Copilot request."
            ),
            status_code=status_code,
        )

    if status_code >= 500:
        return SarvamCopilotError(
            "COPILOT_PROVIDER_ERROR",
            (
                "Sarvam is temporarily unavailable."
            ),
            status_code=status_code,
        )

    return SarvamCopilotError(
        "COPILOT_PROVIDER_ERROR",
        (
            "Sarvam rejected the Copilot request."
        ),
        status_code=status_code,
    )


def generate_connector_draft(
    *,
    source_name: str,
    entity: Literal[
        "user",
        "device",
        "event",
    ],
    api_details: str,
    sample_payload: str | None = None,
    secret_ref_hint: str | None = None,
    resolver: SecretResolver | None = None,
) -> GeneratedConnectorDraft:
    """
    Ask Sarvam to draft one CyberForge connector.

    Safety boundaries:
    - Sarvam receives no secret value.
    - Generated configuration is never persisted here.
    - Generated configuration is always disabled.
    - CyberForge validates the draft with ConnectorConfig.
    """

    resolver = resolver or SecretResolver()

    try:
        sarvam_key = resolver.resolve(
            "SARVAM_API_KEY"
        )

    except SecretResolutionError:
        raise

    schema = ConnectorConfig.model_json_schema()

    canonical_fields = _canonical_fields(
        entity
    )

    secret_instruction = (
        (
            "Use this symbolic secret reference "
            f"when appropriate: {secret_ref_hint}. "
            "This is a reference name only, not "
            "a credential value."
        )
        if secret_ref_hint
        else (
            "Create symbolic UPPERCASE secret "
            "reference names where credentials "
            "are required."
        )
    )

    system_prompt = f"""
You are the CyberForge Connector Configuration Copilot.

Your only task is to produce ONE JSON object representing
a CyberForge connector configuration.

SECURITY RULES:
- Never output actual API keys, passwords, bearer tokens,
  cookies, credentials, or other secret values.
- Credential fields must contain symbolic secret references.
- Never place secrets inside endpoint headers or query params.
- Set enabled to false.
- Do not invent OAuth2 because this CyberForge schema does
  not support OAuth2.
- Do not produce executable code.
- Do not produce markdown.
- Do not add fields outside the supplied connector schema.

CONFIGURATION RULES:
- Target entity MUST be exactly: {entity}
- Canonical target fields are:
  {json.dumps(canonical_fields)}
- Use only information supported by the supplied API details
  or sample payload.
- Do not invent pagination if pagination is not described.
- If pagination is unknown, use type "none".
- Enable incremental sync only if the API documentation
  clearly identifies a timestamp filter and source field.
- Otherwise set incremental.enabled to false.
- Default schedule.every_minutes to 15.
- Connector names must be lowercase hyphen-separated and
  end in the entity suffix:
  user -> -users
  device -> -devices
  event -> -events
- base_url must contain only the API scheme and host/base
  path. Put the resource endpoint in endpoint.path.
- response.records_path must identify the array containing
  records when one exists.
- Nested source fields may use dot notation.
- Map source fields to CyberForge canonical fields.
- Preserve only static non-secret headers.

{secret_instruction}

CyberForge Pydantic JSON Schema:
{json.dumps(schema)}
""".strip()

    sample_section = (
        sample_payload.strip()
        if isinstance(
            sample_payload,
            str,
        )
        and sample_payload.strip()
        else "(No sample payload supplied.)"
    )

    user_prompt = f"""
Security source:
{source_name}

Target CyberForge entity:
{entity}

API documentation / integration details:
{api_details.strip()}

Sample API response:
{sample_section}

Generate the safest valid CyberForge connector draft.
Return exactly one JSON object.
""".strip()

    request_payload = {
        "model": SARVAM_MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        "temperature": 0.1,
        "reasoning_effort": None,
        "max_tokens": 4096,
        "response_format": {
            "type": "json_object",
        },
    }

    try:
        with httpx.Client(
            timeout=httpx.Timeout(45.0),
            follow_redirects=False,
        ) as client:

            response = client.post(
                SARVAM_URL,
                headers={
                    "api-subscription-key": (
                        sarvam_key
                    ),
                    "Content-Type": (
                        "application/json"
                    ),
                },
                json=request_payload,
            )

    except httpx.TimeoutException as exc:
        raise SarvamCopilotError(
            "COPILOT_TIMEOUT",
            "Sarvam Copilot request timed out.",
        ) from exc

    except httpx.RequestError as exc:
        raise SarvamCopilotError(
            "COPILOT_NETWORK_ERROR",
            (
                "Unable to reach the Sarvam "
                "Copilot service."
            ),
        ) from exc

    if response.status_code != 200:
        raise _provider_error(
            response.status_code
        )

    try:
        provider_payload = response.json()

    except ValueError as exc:
        raise SarvamCopilotError(
            "COPILOT_PROVIDER_RESPONSE_ERROR",
            (
                "Sarvam returned a non-JSON "
                "API response."
            ),
        ) from exc

    content = _extract_message_content(
        provider_payload
    )

    try:
        generated = json.loads(
            content
        )

    except json.JSONDecodeError as exc:
        raise SarvamCopilotError(
            "COPILOT_INVALID_JSON",
            (
                "Sarvam did not return a valid "
                "connector JSON object."
            ),
        ) from exc

    if not isinstance(
        generated,
        dict,
    ):
        raise SarvamCopilotError(
            "COPILOT_INVALID_JSON",
            (
                "Generated connector must be "
                "a JSON object."
            ),
        )

    # -------------------------------------------------
    # Deterministic semantic normalization.
    #
    # Pagination and incremental-sync control
    # parameters belong to the CyberForge engine.
    # They must not also appear as static endpoint
    # query parameters generated by the model.
    # -------------------------------------------------

    endpoint = generated.get("endpoint")
    pagination = generated.get("pagination")
    incremental = generated.get("incremental")

    if isinstance(endpoint, dict):
        query_params = endpoint.get("query_params")

        if isinstance(query_params, dict):

            reserved_params: set[str] = set()

            if isinstance(pagination, dict):
                for key in (
                    "page_param",
                    "offset_param",
                    "limit_param",
                    "cursor_param",
                ):
                    value = pagination.get(key)

                    if isinstance(value, str) and value:
                        reserved_params.add(value)

            if isinstance(incremental, dict):
                request_param = incremental.get(
                    "request_param"
                )

                if (
                    isinstance(request_param, str)
                    and request_param
                ):
                    reserved_params.add(
                        request_param
                    )

            endpoint["query_params"] = {
                key: value
                for key, value in query_params.items()
                if key not in reserved_params
            }

    # AI-generated configs are NEVER allowed to
    # arrive enabled.
    generated["enabled"] = False

    try:
        validated = (
            ConnectorConfig.model_validate(
                generated
            )
        )

    except ValidationError as exc:
        errors = exc.errors(
            include_url=False
        )

        summary = "; ".join(
            str(error.get("msg", "invalid"))
            for error in errors[:5]
        )

        raise SarvamCopilotError(
            "COPILOT_SCHEMA_VALIDATION_FAILED",
            (
                "Sarvam produced a draft that "
                "did not satisfy the CyberForge "
                "connector schema: "
                + summary
            ),
        ) from exc

    if validated.mapping.entity != entity:
        raise SarvamCopilotError(
            "COPILOT_ENTITY_MISMATCH",
            (
                "Generated connector entity does "
                "not match the requested entity."
            ),
        )

    safe_connector = validated.model_dump(
        mode="json"
    )

    # Enforce this again after model validation.
    safe_connector["enabled"] = False

    yaml_preview = yaml.safe_dump(
        safe_connector,
        sort_keys=False,
        allow_unicode=True,
    )

    usage = provider_payload.get(
        "usage"
    )

    if not isinstance(
        usage,
        dict,
    ):
        usage = {}

    safe_usage = {
        key: usage.get(key)
        for key in (
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
        )
        if usage.get(key) is not None
    }

    return GeneratedConnectorDraft(
        connector=safe_connector,
        yaml_preview=yaml_preview,
        model=SARVAM_MODEL,
        usage=safe_usage,
    )
