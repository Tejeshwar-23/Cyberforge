from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    email: str
    status: str
    source: str = Field(min_length=1)
    last_login: datetime


class DeviceRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    hostname: str
    ip: str
    os: str
    owner: str
    source: str = Field(min_length=1)
    last_seen: datetime


class EventRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: str
    severity: str
    timestamp: datetime
    description: str
    source: str = Field(min_length=1)


NORMALIZED_MODELS = {
    "user": UserRecord,
    "device": DeviceRecord,
    "event": EventRecord,
}
