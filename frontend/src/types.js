export const WsStatus = Object.freeze({
  CONNECTING: "connecting",
  OPEN: "open",
  CLOSED: "closed",
});

export const Direction = Object.freeze({
  INCOMING: "incoming",
  OUTGOING: "outgoing",
  ERROR: "error",
});

export const MessageStatus = Object.freeze({
  SENT: "sent",
  FAILED: "failed",
});

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} text
 * @property {"incoming"|"outgoing"|"error"} direction
 * @property {string|null} username
 * @property {string} timestamp           ISO-8601
 * @property {"sent"|"failed"} [status]
 * @property {string} [error]
 */