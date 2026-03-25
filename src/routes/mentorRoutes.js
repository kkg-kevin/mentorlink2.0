
const express = require('express');
const router = express.Router();
const mentor = require('../controllers/mentorController');
const upload = require('../middleware/upload');
router.get('/dashboard', mentor.dashboard);
router.get('/sessions', mentor.sessions);
router.get('/feedback/:id', mentor.feedbackForm);
router.post('/feedback/submit', mentor.submitMentorFeedback);
router.post('/session/:id/accept', mentor.acceptSession);
router.post('/session/:id/reject', mentor.rejectSession);
router.post('/session/:id/complete', mentor.completeSession);
router.get('/analytics', mentor.analytics);
router.get('/profile', mentor.profile);
router.post('/profile/update', upload.single('profilePicture'), mentor.updateProfile);
module.exports = router;
