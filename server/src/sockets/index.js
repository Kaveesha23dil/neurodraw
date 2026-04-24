const logger = require('../utils/logger');

// Import modular handlers
const registerRoomHandlers = require('./room');
const registerChatHandlers = require('./chat');
const registerWhiteboardHandlers = require('./whiteboard');
const registerSignalingHandlers = require('./signaling');

/**
 * Global In-Memory Store
 * Structure:
 * rooms[roomId] = {
 *   users: { socketId: { username: "Guest-123" } },
 *   chatHistory: [ { userId, username, message, timestamp } ], // max 50
 *   sections: [
 *     { id: 'default', name: 'Board 1', strokes: [] }
 *   ],
 *   activeSection: 'default'
 * }
 */
const rooms = {};

// Chat rate limit map: { socketId: lastMessageTimestamp }
const chatRateLimits = new Map();

/**
 * Initialize all socket connection logic
 * @param {import('socket.io').Server} io 
 */
const initSockets = (io) => {
  io.on('connection', (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    // Register handlers and pass dependencies (io, socket, state)
    registerRoomHandlers(io, socket, rooms, chatRateLimits);
    registerChatHandlers(io, socket, rooms, chatRateLimits);
    registerWhiteboardHandlers(io, socket, rooms);
    registerSignalingHandlers(io, socket);
    
  });
};

module.exports = initSockets;
