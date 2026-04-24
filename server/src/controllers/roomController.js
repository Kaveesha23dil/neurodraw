const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// We need a way to reference the global rooms object if we want to validate 
// However, since `rooms` is held in sockets, a cleaner way is to let the socket handle it,
// OR we export `rooms` from a global store. For this implementation, we will check room existence 
// if we expose it, but for simplicity we'll just allow join validation in the socket itself 
// or maintain a lightweight shared store.
// We'll keep the API simple and let the socket validate `rooms` memory.

/**
 * Health check endpoint
 * GET /health
 */
const checkHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
};

/**
 * Generate a new room ID and return a shareable link
 * POST /create-room
 */
const createRoom = (req, res) => {
  try {
    const roomId = uuidv4();
    const shareLink = `/room/${roomId}`;
    
    logger.info(`New room created via API: ${roomId}`);
    
    res.status(201).json({
      success: true,
      roomId,
      shareLink
    });
  } catch (error) {
    logger.error(`Error creating room: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to create room' });
  }
};

/**
 * Basic validation endpoint (can be extended to check actual memory if shared)
 * GET /room/:roomId
 */
const getRoom = (req, res) => {
  const { roomId } = req.params;
  
  if (!roomId || roomId.length < 10) {
    return res.status(400).json({ success: false, error: 'Invalid Room ID format' });
  }

  // We return success true to let frontend proceed; true validation happens on socket connection
  res.status(200).json({ success: true, roomId });
};

module.exports = {
  checkHealth,
  createRoom,
  getRoom
};
