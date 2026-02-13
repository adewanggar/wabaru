const db = require('../db');
const sessionManager = require('../sessionManager');

// Track active queue processors per device
const activeProcessors = new Set();

/**
 * Enqueue messages for a device
 * @param {string} deviceId
 * @param {string[]} targets
 * @param {string} message
 * @param {number} delayMs
 */
async function enqueueMessages(deviceId, targets, message, delayMs) {
  const values = targets.map(target => [deviceId, target, message, delayMs, 'pending']);
  const placeholders = values.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const flatValues = values.flat();

  await db.execute(
    `INSERT INTO wa_queue (device_id, target, message, delay_ms, status) VALUES ${placeholders}`,
    flatValues
  );

  // Start processing if not already running for this device
  if (!activeProcessors.has(deviceId)) {
    processQueue(deviceId);
  }
}

/**
 * Process the message queue for a specific device
 */
async function processQueue(deviceId) {
  if (activeProcessors.has(deviceId)) return;
  activeProcessors.add(deviceId);

  console.log(`[Queue] Starting processor for device: ${deviceId}`);

  try {
    while (true) {
      // Pick next pending message
      const [rows] = await db.execute(
        'SELECT * FROM wa_queue WHERE device_id = ? AND status = ? ORDER BY id ASC LIMIT 1',
        [deviceId, 'pending']
      );

      if (rows.length === 0) {
        console.log(`[Queue] No more pending messages for ${deviceId}`);
        break;
      }

      const item = rows[0];

      // Mark as processing
      await db.execute('UPDATE wa_queue SET status = ? WHERE id = ?', ['processing', item.id]);

      // Get session
      const session = sessionManager.getSession(deviceId);
      if (!session || !session.sock || !session.user) {
        console.log(`[Queue] Device ${deviceId} not connected, marking as failed`);
        await db.execute(
          'UPDATE wa_queue SET status = ?, error = ? WHERE id = ?',
          ['failed', 'Device not connected', item.id]
        );
        continue;
      }

      try {
        // Format number to JID
        const jid = item.target.includes('@s.whatsapp.net')
          ? item.target
          : `${item.target}@s.whatsapp.net`;

        // Send message
        const sentMsg = await session.sock.sendMessage(jid, { text: item.message });
        const msgId = sentMsg?.key?.id || null;

        // Mark as sent
        await db.execute(
          'UPDATE wa_queue SET status = ?, sent_at = NOW() WHERE id = ?',
          ['sent', item.id]
        );

        // Log to outbox
        await db.execute(
          'INSERT INTO wa_outbox (device_id, target, message, wa_message_id, status) VALUES (?, ?, ?, ?, ?)',
          [deviceId, item.target, item.message, msgId, 'SENT']
        );

        console.log(`[Queue] Sent to ${item.target} via ${deviceId} (msg: ${msgId})`);
      } catch (sendErr) {
        console.error(`[Queue] Failed to send to ${item.target}:`, sendErr.message);
        await db.execute(
          'UPDATE wa_queue SET status = ?, error = ? WHERE id = ?',
          ['failed', sendErr.message, item.id]
        );
      }

      // Wait for delay before next message
      if (item.delay_ms > 0) {
        console.log(`[Queue] Waiting ${item.delay_ms}ms before next message...`);
        await new Promise(resolve => setTimeout(resolve, item.delay_ms));
      }
    }
  } catch (err) {
    console.error(`[Queue] Processor error for ${deviceId}:`, err.message);
  } finally {
    activeProcessors.delete(deviceId);
    console.log(`[Queue] Processor stopped for device: ${deviceId}`);
  }
}

/**
 * Get queue stats for a device
 */
async function getQueueStats(deviceId) {
  const [rows] = await db.execute(
    `SELECT status, COUNT(*) as count FROM wa_queue WHERE device_id = ? GROUP BY status`,
    [deviceId]
  );

  const stats = { pending: 0, processing: 0, sent: 0, failed: 0 };
  for (const row of rows) {
    stats[row.status] = row.count;
  }
  return stats;
}

/**
 * Get recent queue items for a device
 */
async function getQueueItems(deviceId, limit = 50) {
  const [rows] = await db.execute(
    `SELECT id, target, status, error, delay_ms, created_at, sent_at 
     FROM wa_queue 
     WHERE device_id = ? 
     ORDER BY 
       CASE WHEN status = 'processing' THEN 1 WHEN status = 'pending' THEN 2 ELSE 3 END ASC, 
       id DESC 
     LIMIT ?`,
    [deviceId, limit]
  );
  return rows;
}

module.exports = {
  enqueueMessages,
  processQueue,
  getQueueStats,
  getQueueItems,
};
