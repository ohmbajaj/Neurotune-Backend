const ErrorResponse = require('../utils/errorResponse');
const { spotifyApi, refreshAccessToken } = require('../config/spotify');
const Playlist = require('../models/Playlist');
const User = require('../models/User');

// @desc    Save playlist to Spotify
// @route   POST /api/playlists/save
// @access  Private
exports.savePlaylistToSpotify = async (req, res, next) => {
  const { playlistId, name, tracks } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).select('+spotifyAccessToken +spotifyRefreshToken');
    if (!user || !user.spotifyAccessToken) {
      return next(new ErrorResponse('Please connect your Spotify account first', 401));
    }

    spotifyApi.setAccessToken(user.spotifyAccessToken);
    const spotifyPlaylist = await spotifyApi.createPlaylist(name, {
      description: 'Created with NeuroTune',
      public: true
    });

    const trackUris = tracks.map(track => `spotify:track:${track.id}`);
    await spotifyApi.addTracksToPlaylist(spotifyPlaylist.body.id, trackUris);

    const playlist = await Playlist.findByIdAndUpdate(
      playlistId,
      { spotifyPlaylistId: spotifyPlaylist.body.id },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: {
        playlist_id: playlist._id,
        spotify_url: spotifyPlaylist.body.external_urls.spotify
      }
    });
  } catch (err) {
    if (err.statusCode === 401) {
      try {
        const newAccessToken = await refreshAccessToken(user.spotifyRefreshToken);
        user.spotifyAccessToken = newAccessToken;
        await user.save();
        spotifyApi.setAccessToken(newAccessToken);
        return exports.savePlaylistToSpotify(req, res, next);
      } catch (refreshErr) {
        return next(refreshErr);
      }
    }
    next(err);
  }
};

// @desc    Get user's saved playlists
// @route   GET /api/playlists
// @access  Private
exports.getUserPlaylists = async (req, res, next) => {
  try {
    const playlists = await Playlist.find({ generatedBy: req.user.id })
      .sort('-createdAt')
      .limit(10);

    res.status(200).json({
      success: true,
      count: playlists.length,
      data: playlists
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single playlist
// @route   GET /api/playlists/:id
// @access  Private
exports.getPlaylist = async (req, res, next) => {
  try {
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return next(new ErrorResponse(`Playlist not found with id of ${req.params.id}`, 404));
    }

    if (playlist.generatedBy.toString() !== req.user.id) {
      return next(new ErrorResponse(`Not authorized to access this playlist`, 401));
    }

    res.status(200).json({
      success: true,
      data: playlist
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete playlist
// @route   DELETE /api/playlists/:id
// @access  Private
exports.deletePlaylist = async (req, res, next) => {
  try {
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return next(new ErrorResponse(`Playlist not found with id of ${req.params.id}`, 404));
    }

    if (playlist.generatedBy.toString() !== req.user.id) {
      return next(new ErrorResponse(`Not authorized to delete this playlist`, 401));
    }

    if (playlist.spotifyPlaylistId) {
      try {
        const user = await User.findById(req.user.id).select('+spotifyAccessToken +spotifyRefreshToken');
        if (user && user.spotifyAccessToken) {
          spotifyApi.setAccessToken(user.spotifyAccessToken);
          await spotifyApi.unfollowPlaylist(playlist.spotifyPlaylistId);
        }
      } catch (spotifyErr) {
        console.error('Error deleting playlist from Spotify:', spotifyErr);
      }
    }

    await playlist.remove();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};