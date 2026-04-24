import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import './App.css';

const socket = io('http://localhost:5000');

// A helper component to attach a stream to a video element
const Video = ({ peer, name }) => {
  const ref = useRef();

  useEffect(() => {
    peer.on('stream', stream => {
      ref.current.srcObject = stream;
    });
  }, [peer]);

  return (
    <div className="video-container glass-panel" style={{ width: '100%', marginBottom: '1rem' }}>
      <video playsInline autoPlay ref={ref} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div className="video-overlay">
        <span className="user-name">{name || "Participant"}</span>
      </div>
    </div>
  );
}

function App() {
  const [activeTool, setActiveTool] = useState('pen');
  
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  
  const [peers, setPeers] = useState([]);
  
  const userVideo = useRef();
  const peersRef = useRef([]);

  const joinRoom = () => {
    if (!roomId.trim()) return;
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setInRoom(true);
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
      
      socket.emit('join_room', roomId);
      
      // When we get all existing users, we call them
      socket.on('all_users', users => {
        const peersArray = [];
        users.forEach(userID => {
          const peer = createPeer(userID, socket.id, stream);
          peersRef.current.push({
            peerID: userID,
            peer,
          });
          peersArray.push({
            peerID: userID,
            peer,
          });
        });
        setPeers(peersArray);
      });

      // When a new user calls us
      socket.on('user_joined', payload => {
        const peer = addPeer(payload.signal, payload.callerID, stream);
        peersRef.current.push({
          peerID: payload.callerID,
          peer,
        });
        
        setPeers(users => [...users, { peerID: payload.callerID, peer }]);
      });

      // When an existing user answers our call
      socket.on('receiving_returned_signal', payload => {
        const item = peersRef.current.find(p => p.peerID === payload.id);
        if (item) {
          item.peer.signal(payload.signal);
        }
      });
      
      // When a user disconnects
      socket.on('user_disconnected', id => {
        const peerObj = peersRef.current.find(p => p.peerID === id);
        if (peerObj) {
          peerObj.peer.destroy();
        }
        const peersArray = peersRef.current.filter(p => p.peerID !== id);
        peersRef.current = peersArray;
        setPeers(peersArray);
      });

    });
  };

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on('signal', signal => {
      socket.emit('sending_signal', { userToSignal, callerID, signal });
    });

    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on('signal', signal => {
      socket.emit('returning_signal', { signal, callerID });
    });

    peer.signal(incomingSignal);

    return peer;
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header glass-panel">
        <div className="logo-section">
          <span className="logo-icon">🧠</span>
          <span className="logo-text">NeuroDraw</span>
        </div>
        <div className="status-badge">
          <div className="status-dot" style={{ backgroundColor: inRoom ? 'var(--success)' : 'var(--danger)', boxShadow: `0 0 8px ${inRoom ? 'var(--success)' : 'var(--danger)'}` }}></div>
          {inRoom ? `Room: ${roomId}` : 'Disconnected'}
        </div>
        <div className="header-actions">
          {!inRoom && (
             <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Room ID" 
                  value={roomId} 
                  onChange={(e) => setRoomId(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                />
                <button className="btn btn-primary" onClick={joinRoom}>Join Room</button>
             </div>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="workspace">
        {/* Toolbar */}
        <aside className="toolbar glass-panel">
          <div className="tool-group">
            <button 
              className={`btn-icon ${activeTool === 'pointer' ? 'active' : ''}`}
              onClick={() => setActiveTool('pointer')}
              title="Select Tool"
            >
              👆
            </button>
            <button 
              className={`btn-icon ${activeTool === 'pen' ? 'active' : ''}`}
              onClick={() => setActiveTool('pen')}
              title="Draw Tool"
            >
              ✏️
            </button>
            <button 
              className={`btn-icon ${activeTool === 'eraser' ? 'active' : ''}`}
              onClick={() => setActiveTool('eraser')}
              title="Eraser Tool"
            >
              🧽
            </button>
          </div>
          
          <div className="tool-group-divider"></div>
          
          <div className="tool-group">
            <button className="btn-icon" title="Color Picker">🎨</button>
            <button className="btn-icon" title="Shapes">⭕</button>
          </div>
        </aside>

        {/* Whiteboard Canvas Area */}
        <section className="whiteboard-container glass-panel">
          <div className="whiteboard-placeholder">
            <span style={{ fontSize: '3rem' }}>🎨</span>
            <h2>Whiteboard Canvas Area</h2>
            <p>Drawings and gesture trails will render here.</p>
          </div>
        </section>

        {/* Right Sidebar */}
        <aside className="sidebar">
          {inRoom ? (
            <div className="videos" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1 }}>
              {/* Local Video */}
              <div className="video-container glass-panel" style={{ width: '100%', minHeight: '200px' }}>
                <video playsInline muted autoPlay ref={userVideo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div className="video-overlay">
                  <span className="user-name">You (Local)</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-icon" style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}>🎙️</button>
                    <button className="btn-icon" style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}>📹</button>
                  </div>
                </div>
              </div>

              {/* Remote Participants Videos */}
              {peers.map((peer, index) => {
                return (
                  <Video key={peer.peerID} peer={peer.peer} name={`Participant ${index + 1}`} />
                );
              })}
            </div>
          ) : (
            <div className="video-container glass-panel" style={{ flex: 1 }}>
               <div className="video-placeholder">
                 <span style={{ fontSize: '2rem' }}>📹</span>
                 <p>Join a room to start video</p>
               </div>
            </div>
          )}

          {/* Participants List */}
          <div className="participants-list glass-panel" style={{ flex: 'none', height: '200px' }}>
            <h3 className="participants-header">Participants ({inRoom ? peers.length + 1 : 0})</h3>
            {inRoom && (
               <>
                 <div className="participant-item">
                   <div className="participant-avatar">Y</div>
                   <span>You</span>
                 </div>
                 {peers.map((p, i) => (
                    <div className="participant-item" key={p.peerID}>
                      <div className="participant-avatar" style={{ background: 'var(--success)' }}>P</div>
                      <span>Participant {i + 1}</span>
                    </div>
                 ))}
               </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
