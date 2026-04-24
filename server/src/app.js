const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const roomRoutes = require('./routes/roomRoutes');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// HTTP request logging
app.use(morgan('dev'));

// Basic Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/', apiLimiter);

// Routes
app.use('/', roomRoutes);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
