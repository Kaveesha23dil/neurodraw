import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [createdRoomId, setCreatedRoomId] = useState('');
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleCreateRoom = () => {
    const id = uuidv4().slice(0, 8);
    setCreatedRoomId(id);
  };

  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) return;
    navigate(`/room/${joinRoomId.trim()}`);
  };

  const handleGoToCreatedRoom = () => {
    if (!createdRoomId) return;
    navigate(`/room/${createdRoomId}`);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/room/${createdRoomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="home-screen">
      {/* Animated background orbs */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      {/* ── Top Nav Bar ── */}
      <nav className="home-nav">
        <div className="home-nav-logo">
          <div className="home-nav-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="home-nav-title">NeuroDraw</span>
        </div>

        <div className="home-nav-actions">
          {user ? (
            <>
              <div className="home-nav-user">
                <div className="home-nav-avatar">{user.username.charAt(0).toUpperCase()}</div>
                <span className="home-nav-username">{user.username}</span>
              </div>
              <button
                id="logout-btn"
                className="home-nav-btn home-nav-btn-danger"
                onClick={handleLogout}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" id="signin-link" className="home-nav-btn home-nav-btn-ghost">
                Sign In
              </Link>
              <Link to="/register" id="signup-link" className="home-nav-btn home-nav-btn-primary">
                Create Account
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Main Card ── */}
      <div className="home-card glass-panel">
        {/* Logo */}
        <div className="home-logo">
          <div className="logo-glow">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="home-logo-text">NeuroDraw</h1>
        </div>
        <p className="home-subtitle">
          Gesture-powered collaborative whiteboard with real-time video conferencing
        </p>

        <div className="home-form">
          <div className="home-actions-row mt-4">
            {/* Create Room */}
            <div className="home-action-card glass-panel-inner">
              <div className="action-icon-wrap create-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
                </svg>
              </div>
              <h3>Create Room</h3>
              <p>Start a new collaborative session</p>
              <button
                className="btn btn-primary"
                onClick={handleCreateRoom}
                id="create-room-btn"
              >
                Create
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>

            {/* Join Room */}
            <div className="home-action-card glass-panel-inner">
              <div className="action-icon-wrap join-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3>Join Room</h3>
              <p>Enter a room ID to collaborate</p>
              <div className="join-input-row">
                <input
                  id="join-room-input"
                  type="text"
                  placeholder="Room ID..."
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                />
                <button
                  className="btn btn-primary btn-icon-sm"
                  onClick={handleJoinRoom}
                  disabled={!joinRoomId.trim()}
                  id="join-room-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Created room link */}
          {createdRoomId && (
            <div className="created-room-banner glass-panel-inner mt-6">
              <div className="banner-top">
                <span className="banner-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  Room Created!
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={handleCopyLink}
                  id="copy-link-btn"
                >
                  {copied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  )}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
              <div className="banner-link">
                {window.location.origin}/room/{createdRoomId}
              </div>
              <button
                className="btn btn-primary btn-full mt-4"
                onClick={handleGoToCreatedRoom}
                id="enter-created-room-btn"
              >
                Enter Room
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Feature pills */}
        <div className="feature-pills mt-8">
          <span className="pill">✏️ Real-time Drawing</span>
          <span className="pill">🎥 Video Chat</span>
          <span className="pill">🤚 Gesture Control</span>
          <span className="pill">💬 Live Chat</span>
        </div>
      </div>
    </div>
  );
}
