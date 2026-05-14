from typing import Optional

# Chat ID of the single permitted Telegram participant.
# Set on first incoming message; rejected chats receive a busy notice.
active_chat_id: Optional[int] = None