from datetime import datetime

from pydantic import BaseModel, field_validator


class IncomingMessage(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text must not be blank")
        return v.strip()


class OutgoingMessage(BaseModel):
    text: str
    sender_id: int
    username: str
    timestamp: datetime


class ErrorMessage(BaseModel):
    error: str
