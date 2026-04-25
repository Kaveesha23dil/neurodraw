import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import './App.css';

const SOCKET_URL = 'http://localhost:5000';

// ── Video component ────────────────────────────────────────────────
const Video = ({ peer, name }) => {
  const ref = useRef();

  useEffect(() => {
    peer.on('stream', stream => {
      if (ref.current) ref.current.srcObject = stream;
    });
  }, [peer]);

  return (
    <div className="video-container glass-panel">
      <video playsInline autoPlay ref={ref} />
      <div className="video-overlay">
        <span className="user-name">{name || 'Participant'}</span>
      </div>
    </div>
  );
};

// ── Main App ───────────────────────────────────────────────────────
function App() {
  // ── Connection state ──
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');

  // ── Peers / video ──
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);
  const userVideo = useRef();
  const userStream = useRef(null);

  // ── Participants (from server room-state) ──
  const [participants, setParticipants] = useState({});

  // ── Chat ──
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const chatEndRef = useRef(null);
  const typingTimeout = useRef(null);
  const [showChat, setShowChat] = useState(false);

  // ── Whiteboard ──
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTool, setActiveTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState('default');
  const localStrokesRef = useRef([]);
  const lastPoint = useRef(null);

  // ── Scroll chat to bottom ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Connect socket once ──
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => {
      setConnected(false);
      setInRoom(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // ── Register room-level listeners (only after joining) ──
  const registerRoomListeners = useCallback((socket, stream) => {
    // ── Room state on join ──
    socket.on('room-state', (state) => {
      setMessages(state.chatHistory || []);
      setSections(state.sections || []);
      setActiveSection(state.activeSection || 'default');
      setParticipants(state.users || {});

      // Replay existing strokes onto canvas
      const section = (state.sections || []).find(s => s.id === state.activeSection);
      if (section) {
        localStrokesRef.current = section.strokes || [];
        redrawCanvas(section.strokes || []);
      }
    });

    // ── WebRTC: receive list of existing users ──
    socket.on('all-users', (userIds) => {
      const peersArray = [];
      userIds.forEach(uid => {
        const peer = createPeer(uid, socket.id, stream);
        peersRef.current.push({ peerID: uid, peer });
        peersArray.push({ peerID: uid, peer });
      });
      setPeers(peersArray);
    });

    // ── WebRTC: a new user joins and sends us an offer ──
    socket.on('offer', (payload) => {
      const peer = addPeer(payload.signal, payload.callerID, stream);
      peersRef.current.push({ peerID: payload.callerID, peer });
      setPeers(prev => [...prev, { peerID: payload.callerID, peer }]);
    });

    // ── WebRTC: receiving an answer back ──
    socket.on('answer', (payload) => {
      const item = peersRef.current.find(p => p.peerID === payload.id);
      if (item) item.peer.signal(payload.signal);
    });

    // ── ICE candidate relay ──
    socket.on('ice-candidate', (payload) => {
      const item = peersRef.current.find(p => p.peerID === payload.sender);
      if (item && item.peer) {
        // simple-peer handles ICE internally, but we can pass if needed
      }
    });

    // ── User joined notification ──
    socket.on('user-joined', ({ socketId, username: uname }) => {
      setParticipants(prev => ({ ...prev, [socketId]: { username: uname } }));
    });

    // ── User disconnected ──
    socket.on('user-disconnected', (id) => {
      const peerObj = peersRef.current.find(p => p.peerID === id);
      if (peerObj) peerObj.peer.destroy();
      peersRef.current = peersRef.current.filter(p => p.peerID !== id);
      setPeers(prev => prev.filter(p => p.peerID !== id));
      setParticipants(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    });

    // ── Chat ──
    socket.on('receive-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('typing-indicator', ({ userId, username: uname, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping) {
          return prev.includes(uname) ? prev : [...prev, uname];
        }
        return prev.filter(n => n !== uname);
      });
    });

    // ── Whiteboard sync ──
    socket.on('draw', (strokeData) => {
      localStrokesRef.current.push(strokeData);
      drawStroke(strokeData);
    });

    socket.on('canvas-state-sync', (strokes) => {
      localStrokesRef.current = strokes;
      redrawCanvas(strokes);
    });

    socket.on('clear-canvas', () => {
      localStrokesRef.current = [];
      clearCanvasLocal();
    });

    socket.on('sections-updated', ({ sections: s, activeSection: a }) => {
      setSections(s);
      setActiveSection(a);
      const sec = s.find(sec => sec.id === a);
      if (sec) {
        localStrokesRef.current = sec.strokes || [];
        redrawCanvas(sec.strokes || []);
      }
    });

    socket.on('active-section-changed', (sectionId) => {
      setActiveSection(sectionId);
    });

    // ── Error handling ──
    socket.on('error', (err) => {
      console.warn('Server error:', err.message);
    });
  }, []);

  // ── Join room handler ──
  const joinRoom = async () => {
    if (!roomId.trim()) return;
    const socket = socketRef.current;
    if (!socket) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      userStream.current = stream;
      if (userVideo.current) userVideo.current.srcObject = stream;

      registerRoomListeners(socket, stream);
      socket.emit('join-room', roomId, username || undefined);
      setInRoom(true);
    } catch (err) {
      console.error('Failed to get media devices:', err);
      // Join without video/audio
      registerRoomListeners(socket, null);
      socket.emit('join-room', roomId, username || undefined);
      setInRoom(true);
    }
  };

  // ── Leave room ──
  const leaveRoom = () => {
    const socket = socketRef.current;
    if (socket) {
      socket.removeAllListeners('room-state');
      socket.removeAllListeners('all-users');
      socket.removeAllListeners('offer');
      socket.removeAllListeners('answer');
      socket.removeAllListeners('ice-candidate');
      socket.removeAllListeners('user-joined');
      socket.removeAllListeners('user-disconnected');
      socket.removeAllListeners('receive-message');
      socket.removeAllListeners('typing-indicator');
      socket.removeAllListeners('draw');
      socket.removeAllListeners('canvas-state-sync');
      socket.removeAllListeners('clear-canvas');
      socket.removeAllListeners('sections-updated');
      socket.removeAllListeners('active-section-changed');
      socket.removeAllListeners('error');
      socket.disconnect();
    }

    // Destroy peers
    peersRef.current.forEach(p => p.peer.destroy());
    peersRef.current = [];
    setPeers([]);

    // Stop media tracks
    if (userStream.current) {
      userStream.current.getTracks().forEach(t => t.stop());
      userStream.current = null;
    }

    setInRoom(false);
    setMessages([]);
    setParticipants({});
    setSections([]);
    localStrokesRef.current = [];
    clearCanvasLocal();

    // Reconnect socket for next join
    const newSocket = io(SOCKET_URL);
    socketRef.current = newSocket;
    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));
  };

  // ── WebRTC helpers ──
  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({ initiator: true, trickle: false, stream: stream || undefined });
    peer.on('signal', signal => {
      socketRef.current.emit('offer', { userToSignal, callerID, signal });
    });
    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({ initiator: false, trickle: false, stream: stream || undefined });
    peer.on('signal', signal => {
      socketRef.current.emit('answer', { signal, callerID });
    });
    peer.signal(incomingSignal);
    return peer;
  }

  // ── Chat helpers ──
  const sendMessage = () => {
    if (!chatInput.trim() || !socketRef.current) return;
    socketRef.current.emit('send-message', chatInput.trim());
    setChatInput('');
    socketRef.current.emit('typing-indicator', false);
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleChatInputChange = (e) => {
    setChatInput(e.target.value);
    if (socketRef.current) {
      socketRef.current.emit('typing-indicator', true);
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socketRef.current?.emit('typing-indicator', false);
      }, 1500);
    }
  };

  // ── Whiteboard drawing ──
  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const startDrawing = (e) => {
    if (!inRoom) return;
    e.preventDefault();
    setIsDrawing(true);
    lastPoint.current = getCanvasPoint(e);
  };

  const draw = (e) => {
    if (!isDrawing || !lastPoint.current) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (!point) return;

    const strokeData = {
      from: lastPoint.current,
      to: point,
      color: activeTool === 'eraser' ? '#0a0a0f' : strokeColor,
      width: activeTool === 'eraser' ? strokeWidth * 4 : strokeWidth,
      tool: activeTool,
    };

    // Draw locally
    drawStroke(strokeData);
    localStrokesRef.current.push(strokeData);

    // Emit to server
    socketRef.current?.emit('draw', strokeData);

    lastPoint.current = point;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPoint.current = null;
  };

  const drawStroke = (data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.beginPath();
    ctx.moveTo(data.from.x * w, data.from.y * h);
    ctx.lineTo(data.to.x * w, data.to.y * h);
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const redrawCanvas = (strokes) => {
    clearCanvasLocal();
    (strokes || []).forEach(s => drawStroke(s));
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleUndo = () => socketRef.current?.emit('undo');
  const handleClearCanvas = () => socketRef.current?.emit('clear-canvas');
  const handleCreateSection = () => socketRef.current?.emit('create-section');
  const handleSwitchSection = (id) => socketRef.current?.emit('switch-section', id);
  const handleDeleteSection = (id) => socketRef.current?.emit('delete-section', id);

  // ── Canvas resize ──
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      redrawCanvas(localStrokesRef.current);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [inRoom]);

  // ── Participant count ──
  const participantCount = Object.keys(participants).length;
  const participantList = Object.entries(participants);

  // ── Get display name for a peer ──
  const getPeerName = (peerID) => {
    const p = participants[peerID];
    return p ? p.username : 'Participant';
  };

  // ════════════════════════════════════════════════════════════════
  // JOIN SCREEN
  // ════════════════════════════════════════════════════════════════
  if (!inRoom) {
    return (
      <div className="join-screen">
        <div className="join-card glass-panel">
          <div className="join-logo">
            <span className="join-logo-icon">🧠</span>
            <h1 className="join-logo-text">NeuroDraw</h1>
          </div>
          <p className="join-subtitle">Collaborative whiteboard with real-time video</p>

          <div className="join-form">
            <div className="input-group">
              <label htmlFor="username-input">Display Name</label>
              <input
                id="username-input"
                type="text"
                placeholder="Enter your name..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              />
            </div>
            <div className="input-group">
              <label htmlFor="room-input">Room ID</label>
              <input
                id="room-input"
                type="text"
                placeholder="Enter room ID..."
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              />
            </div>
            <button className="btn btn-primary join-btn" onClick={joinRoom} disabled={!roomId.trim()}>
              Join Room
            </button>
          </div>

          <div className="join-status">
            <div
              className="status-dot"
              style={{
                backgroundColor: connected ? 'var(--success)' : 'var(--danger)',
                boxShadow: `0 0 8px ${connected ? 'var(--success)' : 'var(--danger)'}`,
              }}
            />
            <span>{connected ? 'Server connected' : 'Connecting...'}</span>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // MAIN WORKSPACE
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header className="header glass-panel">
        <div className="logo-section">
          <span className="logo-icon">🧠</span>
          <span className="logo-text">NeuroDraw</span>
        </div>

        {/* Section Tabs */}
        <div className="section-tabs">
          {sections.map((sec) => (
            <button
              key={sec.id}
              className={`section-tab ${sec.id === activeSection ? 'active' : ''}`}
              onClick={() => handleSwitchSection(sec.id)}
            >
              {sec.name}
              {sections.length > 1 && (
                <span
                  className="section-tab-close"
                  onClick={(e) => { e.stopPropagation(); handleDeleteSection(sec.id); }}
                >
                  ×
                </span>
              )}
            </button>
          ))}
          <button className="section-tab add-tab" onClick={handleCreateSection} title="New Board">
            +
          </button>
        </div>

        <div className="header-actions">
          <div className="status-badge">
            <div className="status-dot" style={{ backgroundColor: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
            Room: {roomId}
          </div>
          <button className="btn btn-danger-outline" onClick={leaveRoom}>Leave</button>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <main className="workspace">
        {/* ── Toolbar ── */}
        <aside className="toolbar glass-panel">
          <div className="tool-group">
            <button
              className={`btn-icon ${activeTool === 'pen' ? 'active' : ''}`}
              onClick={() => setActiveTool('pen')}
              title="Draw"
            >✏️</button>
            <button
              className={`btn-icon ${activeTool === 'eraser' ? 'active' : ''}`}
              onClick={() => setActiveTool('eraser')}
              title="Eraser"
            >🧽</button>
          </div>

          <div className="tool-group-divider" />

          <div className="tool-group">
            <input
              type="color"
              className="color-picker"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              title="Color"
            />
            <input
              type="range"
              className="stroke-slider"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              title={`Width: ${strokeWidth}`}
            />
          </div>

          <div className="tool-group-divider" />

          <div className="tool-group">
            <button className="btn-icon" onClick={handleUndo} title="Undo">↩️</button>
            <button className="btn-icon" onClick={handleClearCanvas} title="Clear">🗑️</button>
          </div>
        </aside>

        {/* ── Whiteboard Canvas ── */}
        <section className="whiteboard-container glass-panel">
          <canvas
            ref={canvasRef}
            className="whiteboard-canvas"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </section>

        {/* ── Right Sidebar ── */}
        <aside className="sidebar">
          {/* Video feeds */}
          <div className="videos-section">
            {/* Local video */}
            <div className="video-container glass-panel local-video">
              <video playsInline muted autoPlay ref={userVideo} />
              <div className="video-overlay">
                <span className="user-name">{username || 'You'}</span>
                <div className="video-controls">
                  <button className="btn-icon mini" title="Mic">🎙️</button>
                  <button className="btn-icon mini" title="Camera">📹</button>
                </div>
              </div>
            </div>

            {/* Remote videos */}
            {peers.map((p) => (
              <Video key={p.peerID} peer={p.peer} name={getPeerName(p.peerID)} />
            ))}
          </div>

          {/* Participants */}
          <div className="participants-list glass-panel">
            <h3 className="participants-header">Participants ({participantCount})</h3>
            <div className="participants-scroll">
              {participantList.map(([id, data]) => (
                <div className="participant-item" key={id}>
                  <div
                    className="participant-avatar"
                    style={{ background: id === socketRef.current?.id ? 'var(--accent-primary)' : 'var(--success)' }}
                  >
                    {(data.username || 'G')[0].toUpperCase()}
                  </div>
                  <span>{data.username}{id === socketRef.current?.id ? ' (You)' : ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat toggle */}
          <button className="btn btn-primary chat-toggle-btn" onClick={() => setShowChat(c => !c)}>
            💬 {showChat ? 'Hide Chat' : 'Chat'}
            {messages.length > 0 && <span className="chat-badge">{messages.length}</span>}
          </button>
        </aside>
      </main>

      {/* ── Chat Panel (overlay) ── */}
      {showChat && (
        <div className="chat-panel glass-panel">
          <div className="chat-header">
            <h3>Room Chat</h3>
            <button className="btn-icon mini" onClick={() => setShowChat(false)}>✕</button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.userId === 'system' ? 'system' : msg.userId === socketRef.current?.id ? 'self' : ''}`}>
                {msg.userId !== 'system' && <span className="chat-msg-author">{msg.username}</span>}
                <span className="chat-msg-text">{msg.message}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}

          <div className="chat-input-row">
            <input
              type="text"
              className="chat-input"
              placeholder="Type a message..."
              value={chatInput}
              onChange={handleChatInputChange}
              onKeyDown={handleChatKeyDown}
            />
            <button className="btn btn-primary" onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
