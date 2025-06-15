const express = require('express');
const router = express.Router();
const {
  generateArtistPlaylist,
  generateMoodPlaylist,
  getGenrePlaylists,
  getGenrePlaylist
} = require('../controllers/generateController');
const { protect } = require('../middleware/auth');

router.post('/artist', protect, generateArtistPlaylist);
router.post('/mood', protect, generateMoodPlaylist);
router.get('/genres', getGenrePlaylists);
router.get('/genres/:genre', getGenrePlaylist);

module.exports = router;