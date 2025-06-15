const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  logout,
  spotifyAuth,
  spotifyCallback
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);
router.get('/spotify', protect, spotifyAuth);
router.get('/spotify/callback', spotifyCallback);

module.exports = router;