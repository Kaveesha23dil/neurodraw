import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { getSocket, disconnectSocket } from '../services/SocketService';

const RoomContext = createContext(null);

export const useRoom = () => {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within RoomProvider');
  return ctx;
};

export function RoomProvider({ children }) {
  // ── Core state ──
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [users, setUsers] = useState({});
  const [inRoom, setInRoom] = useState(false);

  // ── Whiteboard state ──
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState('default');

  // ── Chat state ──
  const [chatHistory, setChatHistory] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // ── Error state ──
  const [error, setError] = useState(null);

  // ── Refs ──
  const socketRef = useRef(null);
  const userStreamRef = useRef(null);

  // ── Initialise socket on mount ──
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      disconnectSocket();
    };
  }, []);

  // ── Join room ──
  const joinRoom = useCallback((rid, uname) => {
    const socket = socketRef.current;
    if (!socket) return;

    setRoomId(rid);
    setUsername(uname);

    // ── Room state on join ──
    socket.on('room-state', (state) => {
      setChatHistory(state.chatHistory || []);
      setSections(state.sections || []);
      setActiveSection(state.activeSection || 'default');
      setUsers(state.users || {});
    });

    // ── User events ──
    socket.on('user-joined', ({ socketId, username: uname }) => {
      setUsers(prev => ({ ...prev, [socketId]: { username: uname } }));
    });

    socket.on('user-disconnected', (id) => {
      setUsers(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    });

    // ── Chat events ──
    socket.on('receive-message', (msg) => {
      setChatHistory(prev => [...prev, msg]);
    });

    socket.on('typing-indicator', ({ userId, username: uname, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping) return prev.includes(uname) ? prev : [...prev, uname];
        return prev.filter(n => n !== uname);
      });
    });

    // ── Whiteboard section events ──
    socket.on('sections-updated', ({ sections: s, activeSection: a }) => {
      setSections(s);
      setActiveSection(a);
    });

    socket.on('active-section-changed', (sectionId) => {
      setActiveSection(sectionId);
    });

    // ── Error ──
    socket.on('error', (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 4000);
    });

    // Emit join
    socket.emit('join-room', rid, uname || undefined);
    setInRoom(true);
  }, []);

  // ── Leave room ──
  const leaveRoom = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      // Remove room-specific listeners
      const events = [
        'room-state', 'all-users', 'offer', 'answer', 'ice-candidate',
        'user-joined', 'user-disconnected', 'receive-message',
        'typing-indicator', 'draw', 'canvas-state-sync', 'clear-canvas',
        'sections-updated', 'active-section-changed', 'error',
      ];
      events.forEach(e => socket.removeAllListeners(e));
      socket.disconnect();
    }

    // Stop media tracks
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(t => t.stop());
      userStreamRef.current = null;
    }

    setInRoom(false);
    setChatHistory([]);
    setUsers({});
    setSections([]);
    setTypingUsers([]);
    setError(null);

    // Reconnect socket for next session
    const newSocket = getSocket();
    socketRef.current = newSocket;
    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));
  }, []);

  // ── Section actions ──
  const createSection = useCallback((name) => {
    socketRef.current?.emit('create-section', name);
  }, []);

  const switchSection = useCallback((id) => {
    socketRef.current?.emit('switch-section', id);
  }, []);

  const deleteSection = useCallback((id) => {
    socketRef.current?.emit('delete-section', id);
  }, []);

  // ── Chat actions ──
  const sendMessage = useCallback((text) => {
    if (!text.trim()) return;
    socketRef.current?.emit('send-message', text.trim());
  }, []);

  const emitTyping = useCallback((isTyping) => {
    socketRef.current?.emit('typing-indicator', isTyping);
  }, []);

  const value = {
    // state
    connected, roomId, username, users, inRoom,
    sections, activeSection,
    chatHistory, typingUsers,
    error,
    // refs
    socketRef, userStreamRef,
    // actions
    joinRoom, leaveRoom,
    createSection, switchSection, deleteSection,
    sendMessage, emitTyping,
    setRoomId, setUsername,
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
}

export default RoomContext;
