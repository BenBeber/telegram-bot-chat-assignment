import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from ..models.messages import ErrorMessage, IncomingMessage
from ..services.telegram import TelegramService
from ..services.websocket import WebSocketManager

logger = logging.getLogger(__name__)
router = APIRouter()


def get_telegram_service(websocket: WebSocket) -> TelegramService:
    return websocket.app.state.telegram_service


def get_ws_manager(websocket: WebSocket) -> WebSocketManager:
    return websocket.app.state.ws_manager


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    service: TelegramService = Depends(get_telegram_service),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
) -> None:
    await ws_manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = IncomingMessage.model_validate_json(raw)
            except ValidationError as exc:
                await websocket.send_text(
                    ErrorMessage(error=f"Invalid message: {exc.error_count()} validation error(s)").model_dump_json()
                )
                continue
            try:
                await service.send(msg.text)
            except RuntimeError as exc:
                await websocket.send_text(ErrorMessage(error=str(exc)).model_dump_json())
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
