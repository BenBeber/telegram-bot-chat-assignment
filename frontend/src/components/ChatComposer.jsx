import { useState } from "react";

function ChatComposer({ disabled, onSend }) {
  const [input, setInput] = useState("");

  const submit = () => {
    if (onSend(input)) setInput("");
  };

  return (
    <div className="chat-input">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message..."
        onKeyDown={(e) => e.key === "Enter" && submit()}
        disabled={disabled}
      />
      <button onClick={submit} disabled={disabled}>
        Send
      </button>
    </div>
  );
}

export default ChatComposer;