function ChatHeader({ status }) {
  return (
    <header className="chat-header">
      <h2>Telegram Chat</h2>
      <span className={`status-badge status-${status}`}>{status}</span>
    </header>
  );
}

export default ChatHeader;