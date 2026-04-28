const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createUser, findUserByEmail, sanitizeUser } = require('../models/User');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'neurodraw_super_secret_jwt_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

/**
 * POST /auth/register
 * Register a new user with hashed password.
 */
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // ── Input Validation ──
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'username, email, and password are required.' });
    }
    if (username.trim().length < 2 || username.trim().length > 30) {
      return res.status(400).json({ success: false, error: 'Username must be between 2 and 30 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }

    // ── Duplicate Check ──
    const existing = findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    // ── Hash Password ──
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // ── Create User ──
    const user = createUser({ username: username.trim(), email, password: hashedPassword });
    logger.info(`New user registered: ${user.username} (${user.email})`);

    res.status(201).json({ success: true, message: 'Account created successfully. Please log in.' });
  } catch (error) {
    logger.error(`Register error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Server error during registration.' });
  }
};

/**
 * POST /auth/login
 * Verify credentials and return a JWT token.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Input Validation ──
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password are required.' });
    }

    // ── Find User ──
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // ── Verify Password ──
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // ── Generate JWT ──
    const payload = { id: user.id, username: user.username, email: user.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    logger.info(`User logged in: ${user.username} (${user.email})`);

    res.status(200).json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Server error during login.' });
  }
};

/**
 * GET /auth/me
 * Return the currently authenticated user (requires token).
 */
const getMe = (req, res) => {
  // req.user is set by authenticateToken middleware
  res.status(200).json({ success: true, user: req.user });
};

module.exports = { register, login, getMe };
