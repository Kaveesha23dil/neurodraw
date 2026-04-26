import { useState, useRef, useEffect } from 'react';
import { useRoom } from '../context/RoomContext';
import { Send, X } from 'lucide-react';

export default function Chat({ onClose }) {
  const {
    chatHistory, sendMessage, emitTyping, socketRef, typingUsers
  } = useRoom();
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);
  const typingTimeout = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
    emitTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    emitTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      emitTyping(false);
    }, 1500);
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const myId = socketRef.current?.id;

  return (
    <div className="chat-wrapper">
      {/* Header */}
      <div className="chat-header">
        <h3>Chat</h3>
        <button className="btn-icon mini" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {chatHistory.map((msg, i) => {
          const isSystem = msg.userId === 'system';
          const isSelf = msg.userId === myId;
          return (
            <div
              key={i}
              className={`chat-bubble ${isSystem ? 'system' : isSelf ? 'self' : 'other'}`}
            >
              {!isSystem && (
                <div className="bubble-meta">
                  <span className="bubble-author">{msg.username}</span>
                  <span className="bubble-time">{formatTime(msg.timestamp)}</span>
                </div>
              )}
              <span className="bubble-text">{msg.message}</span>
              {isSystem && (
                <span className="bubble-time system-time">{formatTime(msg.timestamp)}</span>
              )}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="typing-bar">
          <div className="typing-dots">
            <span /><span /><span />
          </div>
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Input */}
      <div className="chat-input-area">
        <input
          type="text"
          className="chat-field"
          placeholder="Type a message..."
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          id="chat-message-input"
        />
        <button
          className="btn btn-primary btn-send"
          onClick={handleSend}
          disabled={!input.trim()}
          id="chat-send-btn"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
