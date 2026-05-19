import "./index.css";
import { WS_URL } from "./config";
import { WsStatus } from "./types";
import { useChatSocket } from "./hooks/useChatSocket";
import ChatHeader from "./components/ChatHeader";
import ChatMessageList from "./components/ChatMessageList";
import ChatComposer from "./components/ChatComposer";

function App() {
  const { status, messages, send } = useChatSocket(WS_URL);
  const canSend = status === WsStatus.OPEN;

  return (
    <div className="chat-page">
      <div className="chat-container">
        <ChatHeader status={status} />
        <ChatMessageList messages={messages} />
        <ChatComposer disabled={!canSend} onSend={send} />
      </div>
    </div>
  );
}

export default App;