import { useEffect, useRef, useState } from "react";
import "./index.css";
import ChatMessage from "./components/ChatMessage";
import { WsStatus } from "./types";
import { useChatSocket } from "./services/useChatSocket";

const WS_URL = "ws://localhost:8000/ws";

function App() {
  const [input, setInput] = useState("");
  const { status, messages, send } = useChatSocket(WS_URL);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = () => {
    if (send(input)) setInput("");
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        <header className="chat-header">
          <h2>Telegram Chat</h2>
          <span className={`status-badge status-${status}`}>{status}</span>
        </header>

        <div className="chat-messages">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={status !== WsStatus.OPEN}
          />
          <button onClick={sendMessage} disabled={status !== WsStatus.OPEN}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;