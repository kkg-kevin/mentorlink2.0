
const express = require('express');
const router = express.Router();
const org = require('../controllers/orgController');
const upload = require('../middleware/upload');
router.get('/dashboard', org.dashboard);
router.get('/sessions', org.sessions);
router.post('/session/:id/accept', org.acceptSession);
router.post('/session/:id/complete', org.completeSession);
router.get('/analytics', org.analytics);
router.get('/profile', org.profile);
router.post('/profile/update', upload.single('profilePicture'), org.updateProfile);
module.exports = router;
