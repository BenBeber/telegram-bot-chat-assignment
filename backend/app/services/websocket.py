import logging

from fastapi import WebSocket
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        logger.info("WebSocket client connected. total=%d", len(self._connections))

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)
        logger.info("WebSocket client disconnected. total=%d", len(self._connections))

    async def broadcast(self, message: BaseModel) -> None:
        dead: set[WebSocket] = set()
        payload = message.model_dump_json()
        for ws in self._connections:
            try:
                await ws.send_text(payload)
            except Exception:
                logger.warning("Failed to send to a WebSocket client — dropping connection.")
                dead.add(ws)
        self._connections -= dead
