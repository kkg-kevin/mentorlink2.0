const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');

// Admin dashboard
router.get('/dashboard', admin.dashboard);

// View user profile
router.get('/user/:id', admin.viewUser);

// Delete user
router.post('/user/:id/delete', admin.deleteUser);
router.post('/user/:id/role', admin.updateRole);
router.post('/user/:id/status', admin.updateStatus);
router.post('/feedback/:type/:id/visibility', admin.updateFeedbackVisibility);
router.post('/announcement', admin.createAnnouncement);
router.post('/announcement/:id/toggle', admin.toggleAnnouncement);
router.get('/export/:type', admin.exportCsv);

module.exports = router;
