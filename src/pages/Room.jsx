import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import Whiteboard from '../components/Whiteboard';
import VideoGrid from '../components/VideoGrid';
import Chat from '../components/Chat';
import SectionTabs from '../components/SectionTabs';
import {
  LogOut, Copy, Check, Link as LinkIcon,
  MessageSquare, Users, Hand, X
} from 'lucide-react';

export default function Room() {
  const { roomId: paramRoomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    connected, inRoom, joinRoom, leaveRoom,
    roomId, users, error,
    socketRef,
  } = useRoom();

  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const hasJoined = useRef(false);

  // Join room on mount
  useEffect(() => {
    if (hasJoined.current) return;
    hasJoined.current = true;
    joinRoom(paramRoomId);
  }, [paramRoomId, joinRoom]);

  // Track unread messages when chat is closed
  const { chatHistory } = useRoom();
  useEffect(() => {
    if (!showChat) {
      setUnreadCount(prev => prev + 1);
    }
  }, [chatHistory.length]);

  // Reset unread when chat opens
  useEffect(() => {
    if (showChat) setUnreadCount(0);
  }, [showChat]);

  const handleLeave = useCallback(() => {
    leaveRoom();
    navigate('/');
  }, [leaveRoom, navigate]);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/room/${paramRoomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const participantCount = Object.keys(users).length;
  const participantList = Object.entries(users);

  // ── Not connected fallback ──
  if (!connected && !inRoom) {
    return (
      <div className="room-loading">
        <div className="loading-spinner" />
        <p>Connecting to server...</p>
      </div>
    );
  }

  return (
    <div className="room-container">
      {/* ── Error toast ── */}
      {error && (
        <div className="error-toast glass-panel">
          <span>{error}</span>
        </div>
      )}

      {/* ── Header ── */}
      <header className="room-header glass-panel">
        <div className="header-left">
          <span className="logo-icon">🧠</span>
          <span className="logo-text">NeuroDraw</span>
          <div className="header-divider" />
          <SectionTabs />
        </div>

        <div className="header-right">
          {/* Room link */}
          <button
            className="btn btn-ghost-sm"
            onClick={handleCopyLink}
            title="Copy room link"
            id="copy-room-link"
          >
            {copied ? <Check size={14} /> : <LinkIcon size={14} />}
            <span className="hide-mobile">{copied ? 'Copied!' : paramRoomId}</span>
          </button>

          {/* Participants toggle */}
          <button
            className={`btn btn-ghost-sm ${showParticipants ? 'active' : ''}`}
            onClick={() => setShowParticipants(p => !p)}
            id="toggle-participants"
          >
            <Users size={14} />
            <span>{participantCount}</span>
          </button>

          {/* Chat toggle */}
          <button
            className={`btn btn-ghost-sm ${showChat ? 'active' : ''}`}
            onClick={() => setShowChat(c => !c)}
            id="toggle-chat"
          >
            <MessageSquare size={14} />
            {unreadCount > 1 && <span className="notif-badge">{unreadCount - 1}</span>}
          </button>

          {/* Connection indicator */}
          <div className="connection-dot-wrap">
            <div
              className="status-dot"
              style={{
                backgroundColor: connected ? 'var(--success)' : 'var(--danger)',
                boxShadow: `0 0 8px ${connected ? 'var(--success)' : 'var(--danger)'}`,
              }}
            />
          </div>

          {/* Leave */}
          <button className="btn btn-danger-sm" onClick={handleLeave} id="leave-room-btn">
            <LogOut size={14} />
            <span className="hide-mobile">Leave</span>
          </button>
        </div>
      </header>

      {/* ── Main workspace ── */}
      <main className="room-workspace">
        {/* Left — Video Grid */}
        <aside className="video-sidebar">
          <VideoGrid />
        </aside>

        {/* Center — Whiteboard */}
        <section className="whiteboard-area">
          <Whiteboard />
        </section>

        {/* Right — Chat (conditionally) */}
        {showChat && (
          <aside className="chat-sidebar glass-panel">
            <Chat onClose={() => setShowChat(false)} />
          </aside>
        )}
      </main>

      {/* ── Participants overlay ── */}
      {showParticipants && (
        <div className="participants-overlay glass-panel">
          <div className="overlay-header">
            <h3>Participants ({participantCount})</h3>
            <button className="btn-icon mini" onClick={() => setShowParticipants(false)}>
              <X size={14} />
            </button>
          </div>
          <div className="participants-scroll">
            {participantList.map(([id, data]) => (
              <div className="participant-row" key={id}>
                <div
                  className="participant-avatar"
                  style={{
                    background: id === socketRef.current?.id
                      ? 'var(--accent-primary)'
                      : 'var(--success)',
                  }}
                >
                  {(data.username || 'G')[0].toUpperCase()}
                </div>
                <span className="participant-name">
                  {data.username}
                  {id === socketRef.current?.id ? ' (You)' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
