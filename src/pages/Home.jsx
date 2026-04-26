import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Sparkles, Users, ArrowRight, Copy, Check } from 'lucide-react';

export default function Home() {
  const [username, setUsername] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [createdRoomId, setCreatedRoomId] = useState('');
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    const id = uuidv4().slice(0, 8);
    setCreatedRoomId(id);
  };

  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) return;
    const uname = username.trim() || `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
    navigate(`/room/${joinRoomId.trim()}`, { state: { username: uname } });
  };

  const handleGoToCreatedRoom = () => {
    if (!createdRoomId) return;
    const uname = username.trim() || `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
    navigate(`/room/${createdRoomId}`, { state: { username: uname } });
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/room/${createdRoomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="home-screen">
      {/* Animated background orbs */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      <div className="home-card glass-panel">
        {/* Logo */}
        <div className="home-logo">
          <div className="logo-glow">
            <Sparkles size={32} className="logo-sparkle" />
          </div>
          <h1 className="home-logo-text">NeuroDraw</h1>
        </div>
        <p className="home-subtitle">
          Gesture-powered collaborative whiteboard with real-time video conferencing
        </p>

        {/* Username */}
        <div className="home-form">
          <div className="input-group">
            <label htmlFor="home-username">Display Name</label>
            <input
              id="home-username"
              type="text"
              placeholder="Enter your name..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="home-actions-row">
            {/* Create Room */}
            <div className="home-action-card glass-panel-inner">
              <div className="action-icon-wrap create-icon">
                <Sparkles size={20} />
              </div>
              <h3>Create Room</h3>
              <p>Start a new collaborative session</p>
              <button
                className="btn btn-primary"
                onClick={handleCreateRoom}
                id="create-room-btn"
              >
                Create <Sparkles size={14} />
              </button>
            </div>

            {/* Join Room */}
            <div className="home-action-card glass-panel-inner">
              <div className="action-icon-wrap join-icon">
                <Users size={20} />
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
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Created room link */}
          {createdRoomId && (
            <div className="created-room-banner glass-panel-inner">
              <div className="banner-top">
                <span className="banner-label">Room Created!</span>
                <button
                  className="btn btn-ghost"
                  onClick={handleCopyLink}
                  id="copy-link-btn"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
              <div className="banner-link">
                {window.location.origin}/room/{createdRoomId}
              </div>
              <button
                className="btn btn-primary btn-full"
                onClick={handleGoToCreatedRoom}
                id="enter-created-room-btn"
              >
                Enter Room <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Feature pills */}
        <div className="feature-pills">
          <span className="pill">✏️ Real-time Drawing</span>
          <span className="pill">🎥 Video Chat</span>
          <span className="pill">🤚 Gesture Control</span>
          <span className="pill">💬 Live Chat</span>
        </div>
      </div>
    </div>
  );
}
