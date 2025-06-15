const axios = require('axios');

const callDeepSeekAI = async (prompt) => {
  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: process.env.AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.AI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('DeepSeek AI Error:', error.response?.data || error.message);
    throw new Error('Failed to generate playlist with AI');
  }
};

exports.generateArtistPrompt = async (artists, energy, danceability) => {
  const prompt = `Create a 35-song Spotify playlist JSON array with tracks similar to ${artists.join(', ')}. 
  Energy level: ${energy}/100. Danceability: ${danceability}/100. 
  Format: [{ "name": "Song", "artist": "Artist", "album": "Album", "id": "spotify_id", "image": "cover_url", "preview_url": "preview_url", "spotify_url": "track_url" }]`;
  
  return await callDeepSeekAI(prompt);
};

exports.generateMoodPrompt = async (theme, includeArtists, excludeArtists, customPrompt, decades, energy, popularity) => {
  const prompt = `Create a 40-song Spotify playlist JSON array matching theme: "${theme}". 
  Include artists: ${includeArtists?.join(', ') || 'none'}. Exclude: ${excludeArtists?.join(', ') || 'none'}. 
  Decades: ${decades?.join(', ') || 'any'}. Energy: ${energy}/100. Popularity: ${popularity}/100.
  Additional notes: ${customPrompt || 'none'}.
  Format: [{ "name": "Song", "artist": "Artist", "album": "Album", "id": "spotify_id", "image": "cover_url", "preview_url": "preview_url", "spotify_url": "track_url" }]`;
  
  return await callDeepSeekAI(prompt);
};