import asyncio
import logging
from datetime import timezone

from telegram import Update
from telegram.ext import Application, ContextTypes, MessageHandler, filters

from ..core.state import AppState
from ..models.messages import OutgoingMessage
from .websocket import WebSocketManager

logger = logging.getLogger(__name__)


class TelegramService:
    def __init__(self, token: str, ws_manager: WebSocketManager, state: AppState) -> None:
        self._state = state
        self._ws_manager = ws_manager
        self._chat_lock = asyncio.Lock()
        self._send_lock = asyncio.Lock()
        self._app = Application.builder().token(token).build()
        self._app.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, self._handle_message)
        )

    async def start(self) -> None:
        await self._app.initialize()
        await self._app.start()
        await self._app.updater.start_polling()
        logger.info("Telegram bot polling started.")

    async def stop(self) -> None:
        await self._app.updater.stop()
        await self._app.stop()
        await self._app.shutdown()
        logger.info("Telegram bot stopped.")

    async def send(self, text: str) -> None:
        """Forward a message to the active Telegram chat. Raises RuntimeError if no chat is connected."""
        async with self._send_lock:
            if self._state.active_chat_id is None:
                raise RuntimeError(
                    "No Telegram participant connected yet. Send the bot a message first."
                )
            logger.info("Frontend → Telegram | chat_id=%s | text=%r", self._state.active_chat_id, text)
            await self._app.bot.send_message(chat_id=self._state.active_chat_id, text=text)

    async def _handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        chat_id = update.effective_chat.id

        async with self._chat_lock:
            if self._state.active_chat_id is None:
                self._state.active_chat_id = chat_id
                logger.info("Telegram chat registered: chat_id=%s", chat_id)
            elif self._state.active_chat_id != chat_id:
                logger.warning(
                    "Rejected message from chat_id=%s (active=%s)", chat_id, self._state.active_chat_id
                )
                await context.bot.send_message(chat_id=chat_id, text="This bot is currently in use.")
                return

        user = update.effective_user
        username = user.username or user.full_name
        logger.info(
            "Telegram → frontend | user_id=%s | username=%s | text=%r",
            user.id, username, update.message.text,
        )
        await self._ws_manager.broadcast(OutgoingMessage(
            text=update.message.text,
            sender_id=user.id,
            username=username,
            timestamp=update.message.date.astimezone(timezone.utc),
        ))
