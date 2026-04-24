const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const { PORT, CLIENT_URL } = require('./src/config/constants');
const logger = require('./src/utils/logger');
const initSockets = require('./src/sockets');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

// Setup Socket logic
initSockets(io);

// Start listening
server.listen(PORT, () => {
  logger.info(`NeuroDraw Signaling Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
