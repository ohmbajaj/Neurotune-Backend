const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { spotifyApi } = require('../config/spotify');
const jwt = require('jsonwebtoken');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  const { username, email, password } = req.body;

  try {
    const user = await User.create({
      username,
      email,
      password
    });

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
};

// @desc    Initiate Spotify OAuth flow
// @route   GET /api/auth/spotify
// @access  Private
exports.spotifyAuth = async (req, res, next) => {
  try {
    const scopes = [
      'user-read-private',
      'user-read-email',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-library-read'
    ];
    const state = req.user.id;
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
    
    res.status(200).json({
      success: true,
      data: authorizeURL
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Spotify OAuth callback
// @route   GET /api/auth/spotify/callback
// @access  Public
exports.spotifyCallback = async (req, res, next) => {
  const { code, state } = req.query;
  const userId = state;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(new ErrorResponse('Invalid user', 401));
    }

    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;

    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    const spotifyUser = await spotifyApi.getMe();

    user.spotifyId = spotifyUser.body.id;
    user.spotifyAccessToken = access_token;
    user.spotifyRefreshToken = refresh_token;
    await user.save();

    res.redirect(`${process.env.FRONTEND_URL}/spotify-success`);
  } catch (err) {
    next(err);
  }
};

// Helper: Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token
    });
};
const ErrorResponse = require('../utils/errorResponse');
const { spotifyApi, refreshAccessToken } = require('../config/spotify');
const User = require('../models/User');
const Playlist = require('../models/Playlist');
const { generateArtistPrompt, generateMoodPrompt } = require('../utils/aiHelper');
const { getRecommendations } = require('../utils/spotifyHelper');
const { setCache, getCache } = require('../utils/cache');

// @desc    Generate playlist based on artists
// @route   POST /api/generate/artist
// @access  Private
exports.generateArtistPlaylist = async (req, res, next) => {
  const { artists, energy, danceability } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).select('+spotifyAccessToken +spotifyRefreshToken');
    if (!user || !user.spotifyAccessToken) {
      return next(new ErrorResponse('Please connect your Spotify account first', 401));
    }

    spotifyApi.setAccessToken(user.spotifyAccessToken);
    const prompt = generateArtistPrompt(artists, energy, danceability);
    
    // In production: Call DeepSeek AI here
    const aiResponse = {
      success: true,
      playlist_name: `${artists[0]} Inspired Mix`,
      tracks: await getRecommendations(artists, energy, danceability)
    };

    const playlist = await Playlist.create({
      name: aiResponse.playlist_name,
      type: 'artist',
      tracks: aiResponse.tracks,
      generatedBy: userId,
      parameters: {
        artists,
        energy: parseInt(energy),
        danceability: parseInt(danceability)
      }
    });

    res.status(200).json({
      success: true,
      data: {
        playlist_name: playlist.name,
        tracks: playlist.tracks
      }
    });
  } catch (err) {
    if (err.statusCode === 401) {
      try {
        const newAccessToken = await refreshAccessToken(user.spotifyRefreshToken);
        user.spotifyAccessToken = newAccessToken;
        await user.save();
        spotifyApi.setAccessToken(newAccessToken);
        return exports.generateArtistPlaylist(req, res, next);
      } catch (refreshErr) {
        return next(refreshErr);
      }
    }
    next(err);
  }
};

// @desc    Generate playlist based on mood/theme
// @route   POST /api/generate/mood
// @access  Private
exports.generateMoodPlaylist = async (req, res, next) => {
  const { theme, includeArtists, excludeArtists, customPrompt, decades, energy, popularity } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).select('+spotifyAccessToken +spotifyRefreshToken');
    if (!user || !user.spotifyAccessToken) {
      return next(new ErrorResponse('Please connect your Spotify account first', 401));
    }

    spotifyApi.setAccessToken(user.spotifyAccessToken);
    const prompt = generateMoodPrompt(theme, includeArtists, excludeArtists, customPrompt, decades, energy, popularity);
    
    // In production: Call DeepSeek AI here
    const aiResponse = {
      success: true,
      playlist_name: `${theme} Mix`,
      tracks: await getRecommendations(includeArtists || [], energy, popularity, decades)
    };

    const playlist = await Playlist.create({
      name: aiResponse.playlist_name,
      type: 'mood',
      tracks: aiResponse.tracks,
      generatedBy: userId,
      parameters: {
        theme,
        includeArtists: includeArtists || [],
        excludeArtists: excludeArtists || [],
        customPrompt,
        decades: decades || [],
        energy: parseInt(energy),
        popularity: parseInt(popularity)
      }
    });

    res.status(200).json({
      success: true,
      data: {
        playlist_name: playlist.name,
        tracks: playlist.tracks
      }
    });
  } catch (err) {
    if (err.statusCode === 401) {
      try {
        const newAccessToken = await refreshAccessToken(user.spotifyRefreshToken);
        user.spotifyAccessToken = newAccessToken;
        await user.save();
        spotifyApi.setAccessToken(newAccessToken);
        return exports.generateMoodPlaylist(req, res, next);
      } catch (refreshErr) {
        return next(refreshErr);
      }
    }
    next(err);
  }
};

// @desc    Get top genre playlists
// @route   GET /api/generate/genres
// @access  Public
exports.getGenrePlaylists = async (req, res, next) => {
  try {
    const cachedGenres = await getCache('genres');
    if (cachedGenres) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedGenres)
      });
    }

    const genres = [
      'Electronic', 'Rock', 'Hip Hop', 'Pop', 'Jazz', 
      'Classical', 'R&B', 'Country', 'Metal'
    ];

    const genrePlaylists = await Promise.all(
      genres.map(async genre => ({
        genre,
        description: `Top ${genre} tracks`,
        tracks_count: Math.floor(Math.random() * 100) + 50,
        likes_count: Math.floor(Math.random() * 2000) + 500,
        image: `https://source.unsplash.com/random/300x300/?${genre.toLowerCase()},music`
      }))
    );

    await setCache('genres', JSON.stringify(genrePlaylists), 86400);

    res.status(200).json({
      success: true,
      data: genrePlaylists
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get genre-specific playlist
// @route   GET /api/generate/genres/:genre
// @access  Public
exports.getGenrePlaylist = async (req, res, next) => {
  const { genre } = req.params;

  try {
    const cacheKey = `genre_${genre.toLowerCase()}`;
    const cachedPlaylist = await getCache(cacheKey);
    if (cachedPlaylist) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedPlaylist)
      });
    }

    const mockTracks = Array(30).fill().map((_, i) => ({
      id: `mock_track_${genre}_${i}`,
      name: `${genre} Track ${i + 1}`,
      artist: `${genre} Artist ${i + 1}`,
      album: `${genre} Album ${i + 1}`,
      image: `https://source.unsplash.com/random/300x300/?${genre.toLowerCase()},album`,
      preview_url: null,
      spotify_url: `https://open.spotify.com/track/mock_${genre}_${i}`,
      duration_ms: Math.floor(Math.random() * 300000) + 120000,
      popularity: Math.floor(Math.random() * 100),
      danceability: Math.random(),
      energy: Math.random(),
      valence: Math.random()
    }));

    const playlist = {
      genre,
      tracks: mockTracks
    };

    await setCache(cacheKey, JSON.stringify(playlist), 43200);

    res.status(200).json({
      success: true,
      data: playlist
    });
  } catch (err) {
    next(err);
  }
};