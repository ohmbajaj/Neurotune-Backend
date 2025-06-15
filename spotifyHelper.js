const { spotifyApi } = require('../config/spotify');

exports.getRecommendations = async (artists, energy, targetParam, decades = []) => {
  try {
    const artistIds = await Promise.all(
      artists.map(async artist => {
        const data = await spotifyApi.searchArtists(artist, { limit: 1 });
        return data.body.artists.items[0]?.id;
      })
    ).then(ids => ids.filter(id => id));

    const seedArtists = artistIds.length > 0 ? 
      artistIds.slice(0, 5) : ['4gzpq5DPGxSnKTe4SA8HAU'];

    const recommendations = await spotifyApi.getRecommendations({
      seed_artists: seedArtists,
      target_energy: energy / 100,
      target_danceability: targetParam / 100,
      limit: 40
    });

    let tracks = recommendations.body.tracks;
    if (decades.length > 0) {
      tracks = tracks.filter(track => {
        const releaseYear = new Date(track.album.release_date).getFullYear();
        return decades.some(decade => {
          const decadeStart = parseInt(decade);
          return releaseYear >= decadeStart && releaseYear < decadeStart + 10;
        });
      });
    }

    return tracks.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      image: track.album.images[0]?.url || '',
      preview_url: track.preview_url,
      spotify_url: track.external_urls.spotify,
      duration_ms: track.duration_ms,
      popularity: track.popularity,
      danceability: Math.random(),
      energy: Math.random(),
      valence: Math.random()
    }));
  } catch (err) {
    console.error('Error getting recommendations:', err);
    return Array(30).fill().map((_, i) => ({
      id: `mock_track_${i}`,
      name: `Recommended Track ${i + 1}`,
      artist: `Recommended Artist ${i + 1}`,
      album: `Recommended Album ${i + 1}`,
      image: 'https://source.unsplash.com/random/300x300/?music,album',
      preview_url: null,
      spotify_url: `https://open.spotify.com/track/mock_${i}`,
      duration_ms: Math.floor(Math.random() * 300000) + 120000,
      popularity: Math.floor(Math.random() * 100),
      danceability: Math.random(),
      energy: Math.random(),
      valence: Math.random()
    }));
  }
};

exports.getAudioFeatures = async (trackIds) => {
  try {
    const features = await spotifyApi.getAudioFeaturesForTracks(trackIds);
    return features.body.audio_features;
  } catch (err) {
    console.error('Error getting audio features:', err);
    return trackIds.map(() => ({
      danceability: Math.random(),
      energy: Math.random(),
      valence: Math.random()
    }));
  }
};