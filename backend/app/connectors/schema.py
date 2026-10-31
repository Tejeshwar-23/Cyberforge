from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator


class NoAuthConfig(BaseModel):
    type: Literal["none"]


class ApiKeyAuthConfig(BaseModel):
    type: Literal["api_key"]
    secret_ref: str = Field(min_length=1)
    header: str = Field(min_length=1)


class BearerAuthConfig(BaseModel):
    type: Literal["bearer"]
    secret_ref: str = Field(min_length=1)


class BasicAuthConfig(BaseModel):
    type: Literal["basic"]
    username_ref: str = Field(min_length=1)
    password_ref: str = Field(min_length=1)


AuthConfig = (
    NoAuthConfig
    | ApiKeyAuthConfig
    | BearerAuthConfig
    | BasicAuthConfig
)


class EndpointConfig(BaseModel):
    method: Literal["GET", "POST"]
    path: str = Field(min_length=1)
    query_params: dict[str, Any] = Field(default_factory=dict)
    headers: dict[str, str] = Field(default_factory=dict)


class ResponseConfig(BaseModel):
    format: Literal["json", "xml", "yaml"] = "json"
    records_path: str | None = None


class PaginationConfig(BaseModel):
    type: Literal[
        "none",
        "page",
        "offset",
        "cursor",
        "next_link",
    ] = "none"

    page_param: str | None = None
    start_page: int = 1

    offset_param: str | None = None
    limit_param: str | None = None
    page_size: int | None = Field(default=None, gt=0)

    cursor_param: str | None = None
    cursor_response_path: str | None = None

    next_link_path: str | None = None

    @model_validator(mode="after")
    def validate_pagination(self):
        if self.type == "page" and not self.page_param:
            raise ValueError("page pagination requires page_param")

        if self.type == "offset":
            if not self.offset_param or not self.limit_param or not self.page_size:
                raise ValueError(
                    "offset pagination requires offset_param, limit_param and page_size"
                )

        if self.type == "cursor":
            if not self.cursor_param or not self.cursor_response_path:
                raise ValueError(
                    "cursor pagination requires cursor_param and cursor_response_path"
                )

        if self.type == "next_link" and not self.next_link_path:
            raise ValueError(
                "next_link pagination requires next_link_path"
            )

        return self


class ScheduleConfig(BaseModel):
    every_minutes: int = Field(gt=0)


class MappingConfig(BaseModel):
    entity: Literal["user", "device", "event"]
    fields: dict[str, str] = Field(min_length=1)
    constants: dict[str, Any] = Field(default_factory=dict)
    date_fields: list[str] = Field(default_factory=list)


class ConnectorConfig(BaseModel):
    version: str = "1.0"

    name: str = Field(min_length=1)
    description: str | None = None

    base_url: HttpUrl

    auth: AuthConfig
    endpoint: EndpointConfig

    response: ResponseConfig = Field(
        default_factory=ResponseConfig
    )

    pagination: PaginationConfig = Field(
        default_factory=PaginationConfig
    )

    schedule: ScheduleConfig
    mapping: MappingConfig

    enabled: bool = True
