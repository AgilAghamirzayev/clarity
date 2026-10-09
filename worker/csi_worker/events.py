from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class Event(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    tenant: UUID
    type: Literal["call.imported", "decision.approved", "summary.requested"]
    resource: UUID
    generation: int = Field(ge=1)


def parse_event(raw):
    return Event.model_validate_json(raw).model_dump(mode="json")
