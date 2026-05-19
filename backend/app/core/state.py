from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AppState:
    active_chat_id: Optional[int] = field(default=None)

    def reset(self) -> None:
        self.active_chat_id = None
