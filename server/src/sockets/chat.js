const logger = require('../utils/logger');

/**
 * Handles real-time chat and typing indicators.
 */
module.exports = (io, socket, rooms, chatRateLimits) => {
  
  socket.on('send-message', (messageText) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    // Basic Rate Limiting: 1 message per second
    const now = Date.now();
    const lastMsgTime = chatRateLimits.get(socket.id) || 0;
    if (now - lastMsgTime < 1000) {
      socket.emit('error', { message: 'You are sending messages too fast.' });
      return;
    }
    chatRateLimits.set(socket.id, now);

    const user = rooms[roomId].users[socket.id];
    if (!user) return;

    const chatMessage = {
      userId: socket.id,
      username: user.username,
      message: messageText,
      timestamp: now
    };

    // Store in memory (limit to 50)
    rooms[roomId].chatHistory.push(chatMessage);
    if (rooms[roomId].chatHistory.length > 50) {
      rooms[roomId].chatHistory.shift();
    }

    // Broadcast to everyone in the room (including sender)
    io.to(roomId).emit('receive-message', chatMessage);
  });

  socket.on('typing-indicator', (isTyping) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const user = rooms[roomId].users[socket.id];
    if (!user) return;

    // Broadcast to everyone else in the room
    socket.to(roomId).emit('typing-indicator', {
      userId: socket.id,
      username: user.username,
      isTyping
    });
  });

};
