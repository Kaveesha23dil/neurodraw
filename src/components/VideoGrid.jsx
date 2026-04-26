import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoom } from '../context/RoomContext';
import Peer from 'simple-peer';
import { Video, VideoOff, Mic, MicOff, MonitorUp } from 'lucide-react';

const PeerVideo = ({ peer, name }) => {
  const ref = useRef();

  useEffect(() => {
    const handleStream = (stream) => {
      if (ref.current) ref.current.srcObject = stream;
    };
    peer.on('stream', handleStream);
    return () => peer.off('stream', handleStream);
  }, [peer]);

  return (
    <div className="vid-card glass-panel-inner">
      <video playsInline autoPlay ref={ref} />
      <div className="vid-overlay">
        <span className="vid-name">{name || 'Participant'}</span>
      </div>
    </div>
  );
};

export default function VideoGrid() {
  const { socketRef, userStreamRef, users } = useRoom();
  const [peers, setPeers] = useState([]);
  const peersRef = useRef([]);
  const localVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [cameraError, setCameraError] = useState(false);

  // ── Get user media on mount ──
  useEffect(() => {
    let cancelled = false;

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        userStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.warn('Camera access denied or not available:', err);
        setCameraError(true);
        // Try audio only
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!cancelled) {
            userStreamRef.current = audioStream;
            setLocalStream(audioStream);
          }
        } catch {
          // No media at all — proceed without
        }
      }
    };

    initMedia();
    return () => { cancelled = true; };
  }, [userStreamRef]);

  // ── WebRTC signaling ──
  useEffect(() => {
    const socket = socketRef.current;
    const stream = userStreamRef.current;
    if (!socket) return;

    const createPeer = (userToSignal, callerID, stream) => {
      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: stream || undefined,
      });
      peer.on('signal', (signal) => {
        socket.emit('offer', { userToSignal, callerID, signal });
      });
      return peer;
    };

    const addPeer = (incomingSignal, callerID, stream) => {
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: stream || undefined,
      });
      peer.on('signal', (signal) => {
        socket.emit('answer', { signal, callerID });
      });
      peer.signal(incomingSignal);
      return peer;
    };

    // Receive existing users list
    const handleAllUsers = (userIds) => {
      const peersArray = [];
      userIds.forEach((uid) => {
        const peer = createPeer(uid, socket.id, stream);
        peersRef.current.push({ peerID: uid, peer });
        peersArray.push({ peerID: uid, peer });
      });
      setPeers(peersArray);
    };

    // New user sends us an offer
    const handleOffer = (payload) => {
      const peer = addPeer(payload.signal, payload.callerID, stream);
      peersRef.current.push({ peerID: payload.callerID, peer });
      setPeers((prev) => [...prev, { peerID: payload.callerID, peer }]);
    };

    // Receiving answer back
    const handleAnswer = (payload) => {
      const item = peersRef.current.find((p) => p.peerID === payload.id);
      if (item) item.peer.signal(payload.signal);
    };

    // User disconnected
    const handleDisconnect = (id) => {
      const peerObj = peersRef.current.find((p) => p.peerID === id);
      if (peerObj) peerObj.peer.destroy();
      peersRef.current = peersRef.current.filter((p) => p.peerID !== id);
      setPeers((prev) => prev.filter((p) => p.peerID !== id));
    };

    socket.on('all-users', handleAllUsers);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('user-disconnected', handleDisconnect);

    return () => {
      socket.off('all-users', handleAllUsers);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('user-disconnected', handleDisconnect);

      // Cleanup peers
      peersRef.current.forEach((p) => p.peer.destroy());
      peersRef.current = [];
      setPeers([]);
    };
  }, [socketRef, userStreamRef]);

  // ── Toggle camera ──
  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setVideoEnabled(videoTrack.enabled);
    }
  };

  // ── Toggle mic ──
  const toggleAudio = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setAudioEnabled(audioTrack.enabled);
    }
  };

  const getPeerName = (peerID) => {
    const p = users[peerID];
    return p ? p.username : 'Participant';
  };

  const { username } = useRoom();

  return (
    <div className="video-grid">
      {/* Local video */}
      <div className={`vid-card local glass-panel-inner ${cameraError ? 'no-camera' : ''}`}>
        {!cameraError ? (
          <video playsInline muted autoPlay ref={localVideoRef} />
        ) : (
          <div className="vid-placeholder">
            <VideoOff size={24} />
            <span>No Camera</span>
          </div>
        )}
        <div className="vid-overlay">
          <span className="vid-name">{username || 'You'}</span>
          <div className="vid-controls">
            <button
              className={`vid-ctrl-btn ${!audioEnabled ? 'off' : ''}`}
              onClick={toggleAudio}
              title={audioEnabled ? 'Mute' : 'Unmute'}
            >
              {audioEnabled ? <Mic size={12} /> : <MicOff size={12} />}
            </button>
            <button
              className={`vid-ctrl-btn ${!videoEnabled ? 'off' : ''}`}
              onClick={toggleVideo}
              title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              {videoEnabled ? <Video size={12} /> : <VideoOff size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* Remote videos */}
      {peers.map((p) => (
        <PeerVideo key={p.peerID} peer={p.peer} name={getPeerName(p.peerID)} />
      ))}
    </div>
  );
}
