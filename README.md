# Telegram Bot Chat Assignment

A web app that displays real-time, bidirectional messaging between a Telegram bot and a single remote participant. The browser connects to a FastAPI backend over WebSocket; the backend talks to Telegram via long polling.

## Tech Stack

**Frontend** — React 18, Vite 5, native WebSocket API.

**Backend** — FastAPI, python-telegram-bot, Uvicorn (with `uvicorn[standard]` for WebSocket support), Pydantic, python-dotenv.

## Project Structure

```
telegram-bot-chat-assignment/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # create_app() factory + lifespan
│       ├── core/
│       │   ├── config.py       # Settings dataclass; loads TELEGRAM_BOT_TOKEN
│       │   ├── log_config.py   # configure_logging()
│       │   └── state.py        # AppState (active_chat_id)
│       ├── models/
│       │   └── messages.py     # IncomingMessage, OutgoingMessage, ErrorMessage
│       ├── services/
│       │   ├── telegram.py     # TelegramService: start/stop/send + locks
│       │   └── websocket.py    # WebSocketManager: connect/disconnect/broadcast
│       └── routers/
│           ├── health.py       # GET /health
│           └── chat.py         # WS /ws (Depends() injects services)
└── frontend/
    ├── Dockerfile
    ├── .env.example
    ├── index.html
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx             # thin layout shell
        ├── index.css
        ├── config.js           # WS_URL + tunables
        ├── types.js            # WsStatus, Direction, MessageStatus
        ├── hooks/
        │   └── useChatSocket.js
        ├── lib/
        │   └── pendingQueue.js # pure FIFO/TTL helpers
        └── components/
            ├── ChatHeader.jsx
            ├── ChatMessageList.jsx
            ├── ChatMessage.jsx
            └── ChatComposer.jsx
```

## Architecture

```
frontend/src/App.jsx  ←──(WebSocket /ws)──→  backend/app/main.py
        ↓                                              ↓
  React chat UI                          FastAPI + python-telegram-bot
  hooks/useChatSocket                      Telegram Bot API (polling)
```

### Backend layering

- `create_app()` in `main.py` is an application factory — `AppState`, `WebSocketManager`, middleware, and routers are all wired here. `TelegramService` is constructed inside `lifespan` so it sees the running event loop.
- `app.state.app_state` / `ws_manager` / `telegram_service` carry shared state. Routers reach them via `Depends(get_telegram_service)` / `Depends(get_ws_manager)` — no module-level globals.
- `Settings` (`core/config.py`) is a frozen dataclass that raises on a missing token; logging is configured exactly once at import time.
- Models (`models/messages.py`) own the wire contract: `IncomingMessage` validates frontend input, `OutgoingMessage` types the Telegram → frontend broadcast, `ErrorMessage` types failure replies.

### Frontend

- `App.jsx` is a thin layout shell. It calls `useChatSocket(WS_URL)` and composes `ChatHeader` / `ChatMessageList` / `ChatComposer`. No local state, no effects.
- `hooks/useChatSocket.js` owns the WebSocket lifecycle: `useReducer` state, exponential reconnect backoff (1s → 30s cap, reset on open), and a FIFO `pendingRef` (TTL 5s) used to attribute backend `error` payloads to the original outgoing bubble.
- `lib/pendingQueue.js` extracts the FIFO/TTL logic as pure functions so it can be unit-tested without React.
- `config.js` centralizes `WS_URL` (env-driven, with a `window.location` fallback) and tunables (`PENDING_TTL_MS`, `RECONNECT_INITIAL_MS`, `RECONNECT_MAX_MS`, `MAX_MESSAGES`).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check — returns `{"status": "ok"}` |
| WS  | `/ws`     | Bidirectional chat between the browser and the active Telegram participant |

CORS is permissive (`allow_origins=["*"]`); this is intentional for the assignment but would need locking down in production.

## Environment Variables

| Variable | Used by | Required | Default | Notes |
|---|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Backend (`core/config.py`) | Yes | — | Loaded from `backend/.env` via `python-dotenv`. App refuses to start without it. |
| `VITE_WS_URL` | Frontend (`src/config.js`) | No | Derived from `window.location` (e.g. `ws://localhost:8000/ws`) | Override only when not connecting to `localhost:8000`. |

Copy `frontend/.env.example` to `frontend/.env.local` to override the WebSocket URL locally.

## WebSocket Message Contract

**Client → server** — only `text` is accepted; whitespace-only strings are rejected:
```json
{ "text": "hello" }
```

**Server → client** — chat messages forwarded from Telegram:
```json
{
  "text": "hello",
  "sender_id": 123456789,
  "username": "johndoe",
  "timestamp": "2026-05-14T05:10:00+00:00"
}
```

**Server → client** — error reply (e.g. no Telegram participant yet, or validation failure):
```json
{ "error": "No Telegram participant connected yet. Send the bot a message first." }
```

The frontend attributes an `error` to the most recent unacknowledged outgoing message via a 5-second FIFO (`lib/pendingQueue.js`). This is a heuristic — see [Limitations](#limitations).

## Setup

### Docker (recommended)

Both services run with hot reload. Source dirs are bind-mounted; `node_modules` and the Python venv are masked with anonymous volumes so host-built (Windows) deps don't leak into the Linux containers.

1. Create `backend/.env`:
   ```ini
   TELEGRAM_BOT_TOKEN=your_token_here
   ```
2. Build and start:
   ```powershell
   docker compose up --build
   ```

Frontend: http://localhost:5173 — Backend: http://localhost:8000

### Local — Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
# Create .env with TELEGRAM_BOT_TOKEN=<your-token>
uvicorn app.main:app --reload
```

Requires `uvicorn[standard]` (already pinned in `requirements.txt`) — without the `[standard]` extras, WebSocket upgrades silently 404.

### Local — Frontend

```powershell
cd frontend
npm install
# Optional: copy .env.example to .env.local and edit VITE_WS_URL
npm run dev
```

## Concurrency

`TelegramService` holds two `asyncio.Lock`s:

- `_chat_lock` — atomically checks-and-sets `AppState.active_chat_id`; prevents two simultaneous incoming Telegram messages from registering different chats.
- `_send_lock` — serializes outbound `bot.send_message()` calls; preserves delivery order under concurrent frontend sends.

## Communication Choices

### Frontend ↔ Backend — WebSocket

- Real-time, bidirectional
- Low latency
- Persistent connection
- Lower overhead than polling

### Telegram ↔ Backend — long polling

- Simpler local setup (no public URL needed)
- Works on localhost without a tunnel
- Reliable enough for this scope

**Tradeoffs:** slightly higher latency and lower efficiency than webhooks. In a production-scale system I would switch to webhooks for better scalability and lower latency.

## Limitations

- **No persistence.** Messages live in memory only; refreshing the browser clears the conversation, and restarting the backend drops `active_chat_id`.
- **No authentication on `/ws`.** Anyone able to reach the backend can connect and send to the registered Telegram chat.
- **No production frontend build.** Docker Compose runs the Vite dev server; there is no `vite build` + static server.
- **No automated tests or linting.** Neither `package.json` nor `requirements.txt` declares test/lint tooling.
- **Reconnect attempts are unbounded.** Exponential backoff is capped at 30 s, but the client will keep retrying forever.
- **Failure attribution is heuristic.** The frontend matches `error` payloads to outgoing messages by FIFO order with a 5-second TTL; out-of-order errors or silent server-side failures can mis-attribute. The clean fix is backend ack/nack keyed by a client-supplied message id.
- **Hardcoded permissive CORS.** `allow_origins=["*"]` is fine for the assignment but not for any real deployment.