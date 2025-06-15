const express = require('express');
const router = express.Router();
const {
  savePlaylistToSpotify,
  getUserPlaylists,
  getPlaylist,
  deletePlaylist
} = require('../controllers/playlistController');
const { protect } = require('../middleware/auth');

router.post('/save', protect, savePlaylistToSpotify);
router.get('/', protect, getUserPlaylists);
router.get('/:id', protect, getPlaylist);
router.delete('/:id', protect, deletePlaylist);

module.exports = router;