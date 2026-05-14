# Telegram Bot Chat Assignment

## Overview

A Telegram bot chat interface assignment — a web app that displays real-time bidirectional messaging between a Telegram bot and a remote participant. The frontend is now wired to the backend over WebSocket, with reconnect, failed-message attribution, auto-scroll, and an extracted transport hook.

## Tech Stack

### Frontend
- React.js
- Vite
- Native WebSocket API

### Backend
- FastAPI
- python-telegram-bot
- Uvicorn.

---

## Architecture

```
frontend/src/App.jsx  ←──(WebSocket /ws)──→  backend/app/main.py
        ↓                                              ↓
  React chat UI                          FastAPI + python-telegram-bot
  useChatSocket hook                       Telegram Bot API (polling)
```

## Backend Modules

| File | Purpose |
|---|---|
| `app/main.py` | FastAPI app, lifespan (bot startup/shutdown), `GET /health`, `WS /ws` endpoint, logging config |
| `app/config.py` | `API_TOKEN` — loaded from `TELEGRAM_BOT_TOKEN` env var via `python-dotenv` (`load_dotenv()` reads `backend/.env`) |
| `app/models.py` | `ChatMessage` Pydantic model (`id`, `text`, `timestamp`, `sender: Literal["user","telegram"]`). **Currently unused** — defined but not imported anywhere; broadcast/send paths use raw dicts. Safe to remove or wire up. |
| `app/state.py` | `active_chat_id: Optional[int]` — the single permitted Telegram chat |
| `app/telegram_service.py` | Telegram message handler, `send_to_telegram()`, concurrency locks |
| `app/websocket_manager.py` | `WebSocketManager` — connect/disconnect/broadcast to all frontend clients |

The backend exposes:
- `GET /health` → `{"status": "ok"}`
- `WS /ws` — bidirectional chat between frontend and the active Telegram participant

## Frontend Modules

| File | Purpose |
|---|---|
| `src/App.jsx` | Top-level view: header, status badge, message list, input. Pure view; transport lives in the hook. |
| `src/services/useChatSocket.js` | WebSocket lifecycle hook: connect/reconnect, message state, send. Returns `{ status, messages, send }`. Maintains a FIFO `pendingRef` of recent outgoing message IDs (TTL 5s) to attribute backend `error` payloads to the originating outgoing bubble. |
| `src/components/ChatMessage.jsx` | Renders a single message bubble (incoming/outgoing/error/failed). |
| `src/types.js` | `WsStatus` (`connecting`/`open`/`closed`) and `Direction` (`incoming`/`outgoing`/`error`) frozen enums. |
| `src/index.css` | All styles. Failed outgoing bubbles use `.chat-bubble.failed` (red) plus `.chat-failure` for the inline error text. |

Auto-scroll: `App.jsx` keeps a `bottomRef` after the message list and calls `scrollIntoView` in a `useEffect` keyed on `messages.length`.

Reconnect: `useChatSocket` schedules `setTimeout(connect, 3000)` from `onclose` unless the effect is cancelled. No backoff, no retry cap — known limitation.


## Concurrency

Two `asyncio.Lock` instances in `telegram_service.py` guard against race conditions:
- `_chat_registration_lock` — atomically checks and sets `active_chat_id`; prevents two simultaneous Telegram messages from registering different chats
- `_send_lock` — serializes outbound `bot.send_message()` calls; preserves message delivery order under concurrent frontend sends

---

### 3. Backend Configuration State

**Bot token.** `backend/app/config.py` reads `TELEGRAM_BOT_TOKEN` from the environment via `python-dotenv`. Create `backend/.env` with `TELEGRAM_BOT_TOKEN=<your-token>` before running either Docker or local dev — `load_dotenv()` picks it up from the working directory, which is `backend/` locally and `/app/` (the bind-mounted `./backend`) in the container. Compose does not pass the token through `environment:` / `env_file:`, so the `.env` file is required.


```.env
TELEGRAM_BOT_TOKEN=your_token_here
```

---

## Communication Between Frontend and Backend

The communication between the frontend and backend is implemented using WebSockets.
- Real-Time Bidirectional Communication
- low latency
- persistent connection
- lower overhead than polling

## Communication Between Telgram and Backend
The Telegram bot integration uses long polling instead of webhooks.
- simpler development setup
- Polling works locally
- reliable enough for this scope

### Tradeoffs
- slightly higher latency
- less efficient than webhooks

 In a production-scale system, I would likely switch to webhooks for better scalability and lower latency.

---

## Setup Instructions

### Backend

Bash
```bash
cd backend
python -m venv venv
source venv/bin/activate
uvicorn app.main:app --reload
```

### Frontend

Bash
```bash
cd frontend
npm install
npm run dev
```

### Docker Setup

For a streamlined setup, you can run the entire system using Docker Compose. This ensures all dependencies and environment configurations are handled automatically.

 **Build and start the containers:**
   ```bash
   docker-compose up --build

