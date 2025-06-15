const express = require('express');
const router = express.Router();
const {
  updatePreferences,
  deleteAccount
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.put('/preferences', protect, updatePreferences);
router.delete('/', protect, deleteAccount);

module.exports = router;