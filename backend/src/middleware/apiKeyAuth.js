const db = require('../db');

/**
 * Middleware: Validate X-API-KEY header and attach device info to req
 */
async function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-KEY header' });
  }

  try {
    const [rows] = await db.execute('SELECT * FROM wa_devices WHERE api_key = ?', [apiKey]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.device = rows[0];
    next();
  } catch (err) {
    console.error('[ApiKeyAuth] DB error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = apiKeyAuth;
