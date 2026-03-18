const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');

// Admin dashboard
router.get('/dashboard', admin.dashboard);

// View user profile
router.get('/user/:id', admin.viewUser);

// Delete user
router.post('/user/:id/delete', admin.deleteUser);

module.exports = router;
