const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'neurodraw_super_secret_jwt_key_change_in_production';

/**
 * Express middleware — protects HTTP routes.
 * Reads the Bearer token from the Authorization header,
 * verifies it, and attaches the decoded user to req.user.
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, email, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token has expired. Please log in again.' });
    }
    logger.warn(`Invalid token attempt: ${err.message}`);
    return res.status(403).json({ success: false, error: 'Invalid token.' });
  }
};

/**
 * Socket.IO middleware — protects WebSocket connections.
 * Reads the token from socket.handshake.auth.token,
 * verifies it, and attaches the decoded user to socket.user.
 */
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    logger.warn(`Socket connection rejected — no token. Socket ID: ${socket.id}`);
    return next(new Error('Authentication error: No token provided.'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded; // { id, username, email }
    logger.info(`Socket authenticated: ${decoded.username} (${socket.id})`);
    next();
  } catch (err) {
    logger.warn(`Socket auth failed: ${err.message}`);
    return next(new Error('Authentication error: Invalid or expired token.'));
  }
};

module.exports = { authenticateToken, authenticateSocket };
