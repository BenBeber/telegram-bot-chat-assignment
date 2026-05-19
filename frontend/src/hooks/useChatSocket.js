import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  PENDING_TTL_MS,
  RECONNECT_INITIAL_MS,
  RECONNECT_MAX_MS,
  MAX_MESSAGES,
} from "../config";
import { Direction, MessageStatus, WsStatus } from "../types";
import { popOldest, pruneExpired } from "../lib/pendingQueue";

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const initialState = { status: WsStatus.CONNECTING, messages: [] };

function reducer(state, action) {
  switch (action.type) {
    case "status":
      return { ...state, status: action.status };
    case "append": {
      const next = [...state.messages, action.message];
      return {
        ...state,
        messages:
          next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next,
      };
    }
    case "markFailed":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id
            ? { ...m, status: MessageStatus.FAILED, error: action.error }
            : m,
        ),
      };
    default:
      return state;
  }
}

export function useChatSocket(url) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef(null);
  const pendingRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer = null;
    let backoff = RECONNECT_INITIAL_MS;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      dispatch({ type: "status", status: WsStatus.CONNECTING });

      ws.onopen = () => {
        backoff = RECONNECT_INITIAL_MS;
        dispatch({ type: "status", status: WsStatus.OPEN });
      };

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.error) {
          pendingRef.current = pruneExpired(
            pendingRef.current,
            Date.now(),
            PENDING_TTL_MS,
          );
          const [pending, rest] = popOldest(pendingRef.current);
          pendingRef.current = rest;
          if (pending) {
            dispatch({ type: "markFailed", id: pending.id, error: data.error });
          } else {
            dispatch({
              type: "append",
              message: {
                id: newId(),
                text: data.error,
                direction: Direction.ERROR,
                username: null,
                timestamp: new Date().toISOString(),
              },
            });
          }
          return;
        }

        if (typeof data.text === "string") {
          dispatch({
            type: "append",
            message: {
              id: newId(),
              text: data.text,
              direction: Direction.INCOMING,
              username: data.username ?? null,
              timestamp: data.timestamp ?? new Date().toISOString(),
            },
          });
        }
      };

      ws.onerror = () => ws.close();

      ws.onclose = () => {
        dispatch({ type: "status", status: WsStatus.CLOSED });
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, RECONNECT_MAX_MS);
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      if (ws) {
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
        ws.close();
      }
    };
  }, [url]);

  const send = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    const id = newId();
    ws.send(JSON.stringify({ text: trimmed }));
    pendingRef.current.push({ id, sentAt: Date.now() });
    dispatch({
      type: "append",
      message: {
        id,
        text: trimmed,
        direction: Direction.OUTGOING,
        username: null,
        timestamp: new Date().toISOString(),
        status: MessageStatus.SENT,
      },
    });
    return true;
  }, []);

  return { status: state.status, messages: state.messages, send };
}