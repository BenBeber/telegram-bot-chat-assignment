import { useCallback, useEffect, useRef, useState } from "react";
import { Direction, WsStatus } from "../types";

const PENDING_TTL_MS = 5000;
const RECONNECT_DELAY_MS = 3000;

export function useChatSocket(url) {
  const [status, setStatus] = useState(WsStatus.CONNECTING);
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);
  const pendingRef = useRef([]);

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const markFailed = useCallback((id, error) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "failed", error } : m))
    );
  }, []);

  useEffect(() => {
    let ws;
    let reconnectTimeout;
    let cancelled = false;

    const connect = () => {
      ws = new WebSocket(url);
      wsRef.current = ws;
      setStatus(WsStatus.CONNECTING);

      ws.onopen = () => setStatus(WsStatus.OPEN);

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.error) {
          const cutoff = Date.now() - PENDING_TTL_MS;
          while (
            pendingRef.current.length &&
            pendingRef.current[0].sentAt < cutoff
          ) {
            pendingRef.current.shift();
          }
          const pending = pendingRef.current.shift();
          if (pending) {
            markFailed(pending.id, data.error);
          } else {
            addMessage({
              id: crypto.randomUUID(),
              text: data.error,
              direction: Direction.ERROR,
              username: null,
              timestamp: new Date().toISOString(),
            });
          }
        } else if (data.text) {
          addMessage({
            id: crypto.randomUUID(),
            text: data.text,
            direction: Direction.INCOMING,
            username: data.username ?? null,
            timestamp: data.timestamp ?? new Date().toISOString(),
          });
        }
      };

      ws.onclose = () => {
        setStatus(WsStatus.CLOSED);
        if (!cancelled) {
          reconnectTimeout = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [url, addMessage, markFailed]);

  const send = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;

      const id = crypto.randomUUID();
      ws.send(JSON.stringify({ text: trimmed }));
      pendingRef.current.push({ id, sentAt: Date.now() });
      addMessage({
        id,
        text: trimmed,
        direction: Direction.OUTGOING,
        username: null,
        timestamp: new Date().toISOString(),
      });
      return true;
    },
    [addMessage]
  );

  return { status, messages, send };
}