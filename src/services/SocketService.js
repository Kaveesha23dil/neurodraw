import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

/**
 * Initialize and return a singleton Socket.IO connection.
 * Calling this multiple times returns the same instance unless disconnected.
 */
export const getSocket = () => {
  if (!socket || socket.disconnected) {
    const token = localStorage.getItem('token');
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: { token }
    });
  }
  return socket;
};

/**
 * Disconnect and destroy the socket instance.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export default { getSocket, disconnectSocket };
