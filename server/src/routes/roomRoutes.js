const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

// Health Check
router.get('/health', roomController.checkHealth);

// Room Creation
router.post('/create-room', roomController.createRoom);

// Room Validation
router.get('/room/:roomId', roomController.getRoom);

module.exports = router;
