import asyncio
import logging

from telegram import Update
from telegram.ext import Application, ContextTypes, MessageHandler, filters

from .config import API_TOKEN
from . import state
from .websocket_manager import manager

logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)

_application: Application | None = None

# Prevents two simultaneous Telegram messages from both passing the
# active_chat_id is-None check and registering different chats.
_chat_registration_lock = asyncio.Lock()

# Serializes outbound sends so messages arrive in the order they were submitted.
_send_lock = asyncio.Lock()


async def _handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id

    async with _chat_registration_lock:
        if state.active_chat_id is None:
            state.active_chat_id = chat_id
            logger.info("Telegram chat registered: chat_id=%s", chat_id)
        elif state.active_chat_id != chat_id:
            logger.warning(
                "Rejected message from unknown chat_id=%s (active=%s)",
                chat_id, state.active_chat_id,
            )
            await context.bot.send_message(chat_id=chat_id, text="This bot is currently in use.")
            return

    user = update.effective_user
    username = user.username or user.full_name
    logger.info("Telegram → frontend | user_id=%s | username=%s | text=%r", user.id, username, update.message.text)
    await manager.broadcast({
        "text": update.message.text,
        "sender_id": user.id,
        "username": username,
        "timestamp": update.message.date.isoformat(),
    })


async def send_to_telegram(text: str) -> bool:
    """Forward a frontend message to the active Telegram chat. Returns False if no chat is connected."""
    async with _send_lock:
        if state.active_chat_id is None or _application is None:
            logger.warning("Frontend → Telegram | no active chat, message dropped: %r", text)
            return False
        logger.info("Frontend → Telegram | chat_id=%s | text=%r", state.active_chat_id, text)
        await _application.bot.send_message(chat_id=state.active_chat_id, text=text)
        return True


def build_application() -> Application:
    global _application
    _application = Application.builder().token(API_TOKEN).build()
    _application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _handle_message))
    return _application
