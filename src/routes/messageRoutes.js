const express = require('express');
const router = express.Router();
const messages = require('../controllers/messageController');

router.get('/', messages.listThreads);
router.post('/start', messages.startThread);
router.get('/:id', messages.viewThread);
router.post('/:id/send', messages.sendMessage);

module.exports = router;
