const express = require('express');
const axios = require('axios');
const router = express.Router();

/**
 * POST /api/genai/generate-message
 * Body: { prompt: "Promo lebaran" }
 */
router.post('/generate-message', async (req, res) => {
  const { prompt, provider = 'gemini', model: userModel } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    let text = '';

    if (provider === 'ollama') {
      // Ollama Integration
      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const model = userModel || 'llama3:8b'; // Default to llama3:8b if not specified

      // Use /api/chat as it is verified to work in sessionManager.js
      const response = await axios.post(`${ollamaBaseUrl}/api/chat`, {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      });

      if (!response.data || !response.data.message || !response.data.message.content) {
        throw new Error('No valid response from Ollama');
      }

      text = response.data.message.content;

    } else {
      // Gemini Integration (Default)
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API Key is missing in backend (.env)' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      // As per user request: "gemini-2.0-flash" or fallback
      const model = 'gemini-2.0-flash'; 
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          thinkingConfig: {
            includeThoughts: true
          }
        },
        tools: [
          { googleSearch: {} }
        ]
      };

      const response = await axios.post(url, requestBody, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Check if candidates exist
      if (!response.data.candidates || response.data.candidates.length === 0) {
         throw new Error('No response generated');
      }

      const parts = response.data.candidates[0].content.parts;
      // Extract text part, ignoring thought parts
      const textPart = parts.find(p => p.text && !p.thought); 
      const extractedText = textPart ? textPart.text : parts[0].text;
      text = extractedText;
    }

    res.json({ text });

  } catch (err) {
    const errorData = err.response ? err.response.data : null;
    console.error('[GenAI] Generation error:', errorData || err.message);
    
    let errorMessage = 'Failed to generate message';
    if (err.response) {
        if (err.response.status === 429) {
            errorMessage = 'Quota exceeded. Please try again later.';
        } else if (err.response.status === 404) {
             // Check if it's Gemini or Ollama error context (simplified)
            errorMessage = `Model not found or API key not authorized.`;
        } else {
            errorMessage = errorData?.error?.message || errorMessage;
        }
    } else if (err.code === 'ECONNREFUSED') {
       errorMessage = 'Failed to connect to Ollama. Make sure it is running.';
    }

    res.status(500).json({ 
      error: errorMessage, 
      details: err.message 
    });
  }
});

module.exports = router;
