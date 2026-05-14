from pydantic import BaseModel
from datetime import datetime
from typing import Literal


class ChatMessage(BaseModel):
    id: str
    text: str
    timestamp: datetime
    sender: Literal["user", "telegram"]