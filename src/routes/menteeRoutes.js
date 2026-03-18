
const express = require('express');
const router = express.Router();
const mentee = require('../controllers/menteeController');
const upload = require('../middleware/upload');
router.get('/dashboard', mentee.dashboard);
router.get('/sessions', mentee.sessions);
router.get('/sessions/:id', mentee.sessionDetails);
router.get('/feedback', mentee.feedback);
router.post('/feedback/submit', mentee.submitFeedback);
router.post('/session/request', mentee.requestSession);
router.post('/session/organization/request', mentee.requestOrganizationSession);
router.post('/session/:id/cancel', mentee.cancelSession);
router.get('/profile', mentee.profile);
router.post('/profile/update', upload.single('profilePicture'), mentee.updateProfile);
module.exports = router;
