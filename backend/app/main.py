from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.log_config import configure_logging
from .core.state import AppState
from .routers.chat import router as chat_router
from .routers.health import router as health_router
from .services.telegram import TelegramService
from .services.websocket import WebSocketManager

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.telegram_service = TelegramService(
        token=settings.telegram_bot_token,
        ws_manager=app.state.ws_manager,
        state=app.state.app_state,
    )
    await app.state.telegram_service.start()
    yield
    await app.state.telegram_service.stop()


def create_app() -> FastAPI:
    application = FastAPI(title="Telegram Chat Backend", lifespan=lifespan)

    application.state.app_state = AppState()
    application.state.ws_manager = WebSocketManager()

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(health_router)
    application.include_router(chat_router)

    return application


app = create_app()
