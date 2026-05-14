import { Direction } from "../types";

function ChatMessage({ message }) {
  const { direction, username, text, timestamp, error } = message;
  const failed = message.status === "failed";

  return (
    <div className={`chat-message ${direction}`}>
      {direction === Direction.INCOMING && username && (
        <div className="chat-username">{username}</div>
      )}
      <div className={`chat-bubble${failed ? " failed" : ""}`}>
        <div className="chat-text">{text}</div>
        {failed && error && <div className="chat-failure">{error}</div>}
        <div className="chat-timestamp">
          {new Date(timestamp).toLocaleTimeString()}
          {failed && " · not delivered"}
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;