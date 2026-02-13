const express = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('../db');
const sessionManager = require('../sessionManager');

const router = express.Router();

// GET /api/devices — List all devices
router.get('/', async (req, res) => {
  try {
    const [devices] = await db.execute(
      'SELECT id, device_id, api_key, gemini_api_key, phone_number, status, auto_reply, auto_reply_prompt, ai_provider, ai_model, created_at FROM wa_devices ORDER BY created_at DESC'
    );

    // Enrich with live session info
    const result = devices.map(d => {
      const session = sessionManager.getSession(d.device_id);
      return {
        ...d,
        live_status: session ? (session.user ? 'connected' : 'connecting') : 'disconnected',
        has_qr: !!(session && session.qr),
      };
    });

    res.json({ devices: result });
  } catch (err) {
    console.error('[Devices] List error:', err.message);
    res.status(500).json({ error: 'Failed to list devices' });
  }
});

// POST /api/devices — Add new device
router.post('/', async (req, res) => {
  const { device_id } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: 'Missing device_id' });
  }

  // Validate format: alphanumeric + hyphens
  if (!/^[a-zA-Z0-9\-_]+$/.test(device_id)) {
    return res.status(400).json({ error: 'device_id must be alphanumeric (hyphens/underscores allowed)' });
  }

  try {
    // Check duplicate
    const [existing] = await db.execute('SELECT id FROM wa_devices WHERE device_id = ?', [device_id]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Device ID already exists' });
    }

    const apiKey = uuidv4();
    await db.execute(
      'INSERT INTO wa_devices (device_id, api_key) VALUES (?, ?)',
      [device_id, apiKey]
    );

    res.status(201).json({
      status: 'success',
      device_id,
      api_key: apiKey,
      message: 'Device created. Use /api/devices/:deviceId/connect to start session.',
    });
  } catch (err) {
    console.error('[Devices] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create device' });
  }
});

// DELETE /api/devices/:deviceId — Remove device
router.delete('/:deviceId', async (req, res) => {
  const { deviceId } = req.params;

  try {
    await sessionManager.logoutSession(deviceId);
    await db.execute('DELETE FROM wa_devices WHERE device_id = ?', [deviceId]);
    res.json({ status: 'success', message: `Device ${deviceId} removed` });
  } catch (err) {
    console.error('[Devices] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

// POST /api/devices/:deviceId/connect — Start session
router.post('/:deviceId/connect', async (req, res) => {
  const { deviceId } = req.params;

  try {
    const [rows] = await db.execute('SELECT id FROM wa_devices WHERE device_id = ?', [deviceId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await sessionManager.startSession(deviceId);
    res.json({ status: 'success', message: `Session starting for ${deviceId}` });
  } catch (err) {
    console.error('[Devices] Connect error:', err.message);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// POST /api/devices/:deviceId/disconnect — Stop session
router.post('/:deviceId/disconnect', async (req, res) => {
  const { deviceId } = req.params;

  try {
    await sessionManager.stopSession(deviceId);
    res.json({ status: 'success', message: `Session stopped for ${deviceId}` });
  } catch (err) {
    console.error('[Devices] Disconnect error:', err.message);
    res.status(500).json({ error: 'Failed to stop session' });
  }
});

// POST /api/devices/:deviceId/logout — Logout and clear session
router.post('/:deviceId/logout', async (req, res) => {
  const { deviceId } = req.params;

  try {
    await sessionManager.logoutSession(deviceId);
    res.json({ status: 'success', message: `Logged out ${deviceId}` });
  } catch (err) {
    console.error('[Devices] Logout error:', err.message);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// GET /api/devices/:deviceId/status — Get connection status + QR
router.get('/:deviceId/status', async (req, res) => {
  const { deviceId } = req.params;

  try {
    const session = sessionManager.getSession(deviceId);

    if (!session) {
      return res.json({ status: 'disconnected', qr: null, user: null });
    }

    let qrDataUrl = null;
    if (session.qr) {
      qrDataUrl = await QRCode.toDataURL(session.qr);
    }

    res.json({
      status: session.user ? 'connected' : 'connecting',
      qr: qrDataUrl,
      user: session.user || null,
    });
  } catch (err) {
    console.error('[Devices] Status error:', err.message);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// PUT /api/devices/:deviceId/auto-reply — Update auto-reply settings
router.put('/:deviceId/auto-reply', async (req, res) => {
  const { deviceId } = req.params;
  const { auto_reply, auto_reply_prompt, ai_provider, ai_model, gemini_api_key } = req.body;

  try {
    const [rows] = await db.execute('SELECT id FROM wa_devices WHERE device_id = ?', [deviceId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await db.execute(
      'UPDATE wa_devices SET auto_reply = ?, auto_reply_prompt = ?, ai_provider = ?, ai_model = ?, gemini_api_key = ? WHERE device_id = ?',
      [
        auto_reply ? 1 : 0, 
        auto_reply_prompt || null, 
        ai_provider || 'gemini', 
        ai_model || null, 
        gemini_api_key || null,
        deviceId
      ]
    );

    // Update in-memory session if exists, though settings are usually pulled from DB or need to be synced
    const session = sessionManager.getSession(deviceId);
    if (session) {
       session.auto_reply = !!auto_reply;
       session.auto_reply_prompt = auto_reply_prompt;
       session.ai_provider = ai_provider;
       session.ai_model = ai_model;
       session.gemini_api_key = gemini_api_key;
    }

    res.json({ status: 'success', message: 'Auto-reply settings updated' });
  } catch (err) {
    console.error('[Devices] Update auto-reply error:', err.message);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/devices/:deviceId/flush-memory — Clear chat history
router.post('/:deviceId/flush-memory', async (req, res) => {
  const { deviceId } = req.params;

  try {
    const success = sessionManager.flushHistory(deviceId);
    if (success) {
      res.json({ status: 'success', message: `Memory flushed for ${deviceId}` });
    } else {
      res.json({ status: 'success', message: `No active memory found for ${deviceId} (or device disconnected)` });
    }
  } catch (err) {
    console.error('[Devices] Flush memory error:', err.message);
    res.status(500).json({ error: 'Failed to flush memory' });
  }
});

module.exports = router;
