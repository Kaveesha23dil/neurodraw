const logger = require('../utils/logger');

/**
 * Handles WebRTC signaling logic (offers, answers, ICE candidates)
 */
module.exports = (io, socket) => {
  
  socket.on('offer', (payload) => {
    io.to(payload.userToSignal).emit('offer', {
      signal: payload.signal,
      callerID: payload.callerID || socket.id
    });
  });

  socket.on('answer', (payload) => {
    io.to(payload.callerID).emit('answer', {
      signal: payload.signal,
      id: socket.id
    });
  });

  socket.on('ice-candidate', (payload) => {
    io.to(payload.target).emit('ice-candidate', {
      candidate: payload.candidate,
      sender: socket.id
    });
  });

  // Keep legacy event names for backwards compatibility during transition
  socket.on('sending_signal', (payload) => {
    io.to(payload.userToSignal).emit('user_joined', { signal: payload.signal, callerID: payload.callerID });
  });

  socket.on('returning_signal', (payload) => {
    io.to(payload.callerID).emit('receiving_returned_signal', { signal: payload.signal, id: socket.id });
  });
  
};
