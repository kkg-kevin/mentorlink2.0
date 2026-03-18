
const express = require('express');
const router = express.Router();
const home = require('../controllers/homeController');
router.get('/', home.index);
router.get('/about', home.about);
router.get('/features', home.features);
router.get('/howitworks', home.howitworks);
router.get('/contacts', home.contacts);
module.exports = router;
