const mongoose = require('mongoose');

const PlaylistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a playlist name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  description: {
    type: String,
    maxlength: [200, 'Description cannot be more than 200 characters']
  },
  type: {
    type: String,
    enum: ['artist', 'mood', 'genre'],
    required: true
  },
  tracks: [
    {
      id: String,
      name: String,
      artist: String,
      album: String,
      image: String,
      preview_url: String,
      spotify_url: String,
      duration_ms: Number,
      popularity: Number,
      danceability: Number,
      energy: Number,
      valence: Number
    }
  ],
  spotifyPlaylistId: String,
  generatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  parameters: {
    artists: [String],
    energy: Number,
    danceability: Number,
    theme: String,
    includeArtists: [String],
    excludeArtists: [String],
    customPrompt: String,
    decades: [String],
    popularity: Number,
    genre: String
  }
});

// Prevent user from saving more than 50 playlists
PlaylistSchema.pre('save', async function(next) {
  const count = await this.model('Playlist').countDocuments({ generatedBy: this.generatedBy });
  if (count >= 50) {
    throw new Error('You have reached the maximum number of saved playlists');
  }
  next();
});

module.exports = mongoose.model('Playlist', PlaylistSchema);