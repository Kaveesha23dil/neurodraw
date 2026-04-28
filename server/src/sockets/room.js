const logger = require('../utils/logger');

/**
 * Handles room joining, leaving, and state initialization.
 */
module.exports = (io, socket, rooms, chatRateLimits) => {
  
  socket.on('join-room', (roomId, requestedUsername) => {
    if (!roomId) {
      socket.emit('error', { message: 'Invalid room ID' });
      return;
    }

    // Join the room
    socket.join(roomId);
    socket.roomId = roomId;

    // Use username from JWT
    const username = socket.user.username;

    // Initialize room state if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: {},
        chatHistory: [],
        sections: [
          { id: 'default', name: 'Board 1', strokes: [] }
        ],
        activeSection: 'default'
      };
      logger.info(`Initialized new state for room ${roomId}`);
    }

    // Add user to state
    rooms[roomId].users[socket.id] = { username };

    const totalUsers = Object.keys(rooms[roomId].users).length;
    logger.info(`User ${username} (${socket.id}) joined room ${roomId}. Total users: ${totalUsers}`);

    // Send current state to the newly joined user
    socket.emit('room-state', {
      chatHistory: rooms[roomId].chatHistory,
      sections: rooms[roomId].sections,
      activeSection: rooms[roomId].activeSection,
      users: rooms[roomId].users
    });

    // Extract socket IDs excluding self for WebRTC mesh network signaling
    const existingUserIds = Object.keys(rooms[roomId].users).filter(id => id !== socket.id);
    socket.emit('all-users', existingUserIds);

    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      username
    });
    
    // Broadcast a system message to chat
    const systemMessage = {
      userId: 'system',
      username: 'System',
      message: `${username} joined the room.`,
      timestamp: Date.now()
    };
    rooms[roomId].chatHistory.push(systemMessage);
    if (rooms[roomId].chatHistory.length > 50) rooms[roomId].chatHistory.shift();
    io.to(roomId).emit('receive-message', systemMessage);
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    
    // Clear chat rate limit
    if (chatRateLimits.has(socket.id)) chatRateLimits.delete(socket.id);

    if (roomId && rooms[roomId]) {
      const user = rooms[roomId].users[socket.id];
      const username = user ? user.username : 'Unknown';

      // Remove user from state
      delete rooms[roomId].users[socket.id];
      
      const remainingUsers = Object.keys(rooms[roomId].users).length;
      logger.info(`User ${username} (${socket.id}) left room ${roomId}. Remaining users: ${remainingUsers}`);

      // Notify others for WebRTC and UI
      socket.to(roomId).emit('user-disconnected', socket.id);
      
      // System chat message
      if (remainingUsers > 0) {
        const systemMessage = {
          userId: 'system',
          username: 'System',
          message: `${username} left the room.`,
          timestamp: Date.now()
        };
        rooms[roomId].chatHistory.push(systemMessage);
        if (rooms[roomId].chatHistory.length > 50) rooms[roomId].chatHistory.shift();
        socket.to(roomId).emit('receive-message', systemMessage);
      }

      // Graceful cleanup of empty rooms
      if (remainingUsers === 0) {
        delete rooms[roomId];
        logger.info(`Room ${roomId} was empty and has been deleted from memory.`);
      }
    } else {
      logger.info(`User ${socket.id} disconnected without joining a room.`);
    }
  });
};
