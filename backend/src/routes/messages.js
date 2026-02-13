const express = require('express');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { enqueueMessages, getQueueStats, getQueueItems } = require('../queue/messageQueue');

const router = express.Router();

// Rate limit constants
const MIN_DELAY_MS = 3000;    // 3 seconds minimum
const MAX_TARGETS = 50;       // Max 50 targets per request
const DEFAULT_DELAY_MS = 5000; // 5 seconds default

/**
 * POST /api/send-message
 * 
 * Headers: X-API-KEY
 * Body: { targets: [], message, delay } OR { number, message }
 */
router.post('/send-message', apiKeyAuth, async (req, res) => {
  const { number, targets, message, delay } = req.body;
  const device = req.device;

  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

  // Build targets array
  let targetList = [];

  // Helper: auto-convert 08xxx → 628xxx
  const normalizeNumber = (n) => {
    n = n.toString().trim();
    if (n.startsWith('08')) n = '628' + n.slice(2);
    return n;
  };

  if (targets && Array.isArray(targets)) {
    targetList = targets.map(t => normalizeNumber(t)).filter(t => t.length > 0);
  } else if (number) {
    targetList = [normalizeNumber(number)];
  } else {
    return res.status(400).json({ error: 'Missing number or targets' });
  }

  // Validate targets count
  if (targetList.length === 0) {
    return res.status(400).json({ error: 'No valid targets provided' });
  }

  if (targetList.length > MAX_TARGETS) {
    return res.status(400).json({ error: `Maximum ${MAX_TARGETS} targets per request` });
  }

  // Calculate delay
  let delayMs = delay ? parseInt(delay) : DEFAULT_DELAY_MS;
  if (isNaN(delayMs) || delayMs < MIN_DELAY_MS) {
    delayMs = MIN_DELAY_MS;
  }

  try {
    // Enqueue all messages
    await enqueueMessages(device.device_id, targetList, message, delayMs);

    const delaySeconds = Math.round(delayMs / 1000);
    res.json({
      status: 'queued',
      total_target: targetList.length,
      delay: `${delaySeconds}s`,
      device: device.device_id,
      message: `${targetList.length} message(s) queued with ${delaySeconds}s delay`,
    });
  } catch (err) {
    console.error('[Messages] Enqueue error:', err.message);
    res.status(500).json({ error: 'Failed to queue messages' });
  }
});

/**
 * GET /api/queue-status
 * 
 * Headers: X-API-KEY
 */
router.get('/queue-status', apiKeyAuth, async (req, res) => {
  try {
    const stats = await getQueueStats(req.device.device_id);
    const items = await getQueueItems(req.device.device_id, 50);

    res.json({
      device: req.device.device_id,
      stats,
      recent_items: items,
    });
  } catch (err) {
    console.error('[Messages] Queue status error:', err.message);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

/**
 * GET /api/outbox
 * 
 * Headers: X-API-KEY
 */
router.get('/outbox', apiKeyAuth, async (req, res) => {
  try {
    const [rows] = await (require('../db')).execute(
      'SELECT id, target, message, wa_message_id, status, created_at FROM wa_outbox WHERE device_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.device.device_id]
    );

    res.json({ device: req.device.device_id, messages: rows });
  } catch (err) {
    console.error('[Messages] Outbox error:', err.message);
    res.status(500).json({ error: 'Failed to get outbox' });
  }
});

module.exports = router;
