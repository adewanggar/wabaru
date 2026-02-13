const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  // makeInMemoryStore,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const axios = require('axios');
const makeInMemoryStore = require('./store');

// Map<deviceId, { sock, qr, user }>
const sessions = new Map();

const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// AI History Helpers
const getHistory = async (deviceId, remoteJid) => {
  try {
    const [rows] = await db.execute(
      'SELECT role, content FROM ai_chat_history WHERE device_id = ? AND remote_jid = ? ORDER BY created_at DESC LIMIT 10',
      [deviceId, remoteJid]
    );
    return rows.reverse().map(r => ({ role: r.role, text: r.content }));
  } catch (err) {
    console.error('[SessionManager] Error fetching history:', err.message);
    return [];
  }
};

const addHistory = async (deviceId, remoteJid, role, content) => {
  try {
    await db.execute(
      'INSERT INTO ai_chat_history (device_id, remote_jid, role, content) VALUES (?, ?, ?, ?)',
      [deviceId, remoteJid, role, content]
    );
  } catch (err) {
    console.error('[SessionManager] Error saving history:', err.message);
  }
};

const flushHistory = async (deviceId) => {
  try {
    await db.execute('DELETE FROM ai_chat_history WHERE device_id = ?', [deviceId]);
    console.log(`[SessionManager] History flushed for ${deviceId}`);
    return true;
  } catch (err) {
    console.error('[SessionManager] Error flushing history:', err.message);
    return false;
  }
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 11) return 'Pagi';
  if (hour < 15) return 'Siang';
  if (hour < 19) return 'Sore';
  return 'Malam';
};

/**
 * Start a WhatsApp session for a device
 */
async function startSession(deviceId) {
  if (sessions.has(deviceId)) {
    console.log(`[SessionManager] Session already exists for ${deviceId}`);
    return sessions.get(deviceId);
  }

  const sessionDir = path.join(SESSIONS_DIR, deviceId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  // Initialize Store
  // Initialize Store
  const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });
  const storeFile = path.join(sessionDir, 'store.json');
  try {
      store.readFromFile(storeFile);
  } catch (err) {
      console.log(`[SessionManager] No store file found for ${deviceId}, creating new one.`);
  }
  
  // Save every 10s
  setInterval(() => {
      store.writeToFile(storeFile);
  }, 10_000);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 30000, // Keep connection alive
    retryRequestDelayMs: 250,
    connectTimeoutMs: 60000,
    browser: ['WA Gateway', 'Chrome', '10.0'], // Proper browser identification
  });

  store.bind(sock.ev);

  const sessionData = { sock, qr: '', user: null, deviceId, store };
  sessions.set(deviceId, sessionData);

  // Update DB status
  await db.execute('UPDATE wa_devices SET status = ? WHERE device_id = ?', ['connecting', deviceId]);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      sessionData.qr = qr;
      console.log(`[SessionManager] QR received for ${deviceId}`);
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[SessionManager] Connection closed for ${deviceId}, reason: ${lastDisconnect?.error}, statusCode: ${statusCode}`);

      if (statusCode === DisconnectReason.loggedOut) {
         console.log(`[SessionManager] Device ${deviceId} logged out. Cleaning up.`);
         sessions.delete(deviceId);
         await db.execute('UPDATE wa_devices SET status = ?, phone_number = NULL WHERE device_id = ?', ['disconnected', deviceId]);
         // Optional: Delete session files if logged out
         fs.rmSync(sessionDir, { recursive: true, force: true });
      } else {
         console.log(`[SessionManager] Device ${deviceId} temporarily disconnected. Reconnecting in 3s...`);
         await db.execute('UPDATE wa_devices SET status = ? WHERE device_id = ?', ['connecting', deviceId]);
         sessions.delete(deviceId); // Remove from memory but keep files
         setTimeout(() => startSession(deviceId), 3000);
      }
    } else if (connection === 'open') {
      sessionData.qr = '';
      sessionData.user = sock.user;
      const phoneNumber = sock.user?.id?.split(':')[0] || null;
      console.log(`[SessionManager] Connected: ${deviceId} (${phoneNumber})`);
      await db.execute('UPDATE wa_devices SET status = ?, phone_number = ? WHERE device_id = ?', ['connected', phoneNumber, deviceId]);
    }
  });

  // Track message status updates
  sock.ev.on('messages.update', (updates) => {
    for (const update of updates) {
      if (update.update.status) {
        let statusText = 'SENT';
        if (update.update.status === 3) statusText = 'SENT';
        else if (update.update.status === 4) statusText = 'DELIVERED';
        else if (update.update.status === 5) statusText = 'READ';

        // Update outbox
        db.execute('UPDATE wa_outbox SET status = ? WHERE wa_message_id = ?', [statusText, update.key.id])
          .catch(err => console.error(`[SessionManager] Failed to update outbox status:`, err.message));
      }
    }
  });





  // AI Auto-Reply Listener
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe && m.type === 'notify') {
      try {
        const [rows] = await db.execute('SELECT auto_reply, auto_reply_prompt, ai_provider, ai_model, gemini_api_key FROM wa_devices WHERE device_id = ?', [deviceId]);
        const settings = rows[0];

        if (settings && settings.auto_reply) {
           const remoteJid = msg.key.remoteJid;
           const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

           if (messageContent) {
              console.log(`[SessionManager] Auto-reply triggered for ${deviceId} to ${remoteJid}`);

              // 1. Add User Message to History
              await addHistory(deviceId, remoteJid, 'user', messageContent);
              
              // 2. Fetch History
              const history = await getHistory(deviceId, remoteJid);

              // 3. Prepare Context & Prompt
              const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;
              
              const timeString = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
              const greeting = getGreeting();
              
              const systemContext = `
Current Time: ${timeString}
Greeting Context: Selamat ${greeting}
System Instruction: ${settings.auto_reply_prompt || 'You are a helpful assistant.'}
`;
              
              // Construct prompt with history
              // Gemini format: { role, parts: [{ text }] }
              // Ollama format: { role, content }
              
              let replyText = '';

              if (settings.ai_provider === 'ollama') {
                 // OLLAMA LOGIC
                 const ollamaMessages = [
                    { role: 'system', content: systemContext },
                    ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
                    { role: 'user', content: messageContent } // Current message
                 ];

                 try {
                     const ollamaRes = await axios.post('http://localhost:11434/api/chat', {
                         model: settings.ai_model || 'mistral',
                         messages: ollamaMessages,
                         stream: false
                     });
                     
                     if (ollamaRes.data && ollamaRes.data.message) {
                         replyText = ollamaRes.data.message.content;
                     }
                 } catch (ollamaErr) {
                     console.error('[SessionManager] Ollama error:', ollamaErr.message);
                 }

              } else {
                 // GEMINI LOGIC (Default)
                 const model = 'gemini-2.5-flash'; 
                 const contents = [
                    { role: 'user', parts: [{ text: systemContext }] }, 
                    ...history.map(h => ({
                        role: h.role, 
                        parts: [{ text: h.text }]
                    }))
                 ];
                 
                 const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                 
                 const requestBody = {
                      contents: contents,
                      generationConfig: { thinkingConfig: { includeThoughts: true } },
                      tools: [{ googleSearch: {} }]
                 };

                 try {
                     const aiRes = await axios.post(url, requestBody, { headers: { 'Content-Type': 'application/json' } });
                     
                     if (aiRes.data.candidates && aiRes.data.candidates.length > 0) {
                        const parts = aiRes.data.candidates[0].content.parts;
                        const textPart = parts.find(p => p.text && !p.thought); 
                        replyText = textPart ? textPart.text : parts[0].text;
                     }
                 } catch (geminiErr) {
                     console.error('[SessionManager] Gemini error:', geminiErr.response?.data || geminiErr.message);
                 }
              }

              if (replyText) {
                 // 4. Send Reply
                 await sock.sendMessage(remoteJid, { text: replyText }, { quoted: msg });
                 console.log(`[SessionManager] Auto-reply sent to ${remoteJid} via ${settings.ai_provider || 'gemini'}`);

                 // 5. Add AI Response to History
                 await addHistory(deviceId, remoteJid, 'model', replyText);
              }
           }
        }
      } catch (err) {
        console.error(`[SessionManager] Auto-reply error for ${deviceId}:`, err.message);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  return sessionData;
}

/**
 * Stop a WhatsApp session for a device
 */
async function stopSession(deviceId) {
  const session = sessions.get(deviceId);
  if (!session) return;

  try {
    session.sock.end(undefined);
  } catch (err) {
    console.error(`[SessionManager] Error stopping session ${deviceId}:`, err.message);
  }

  sessions.delete(deviceId);
  await db.execute('UPDATE wa_devices SET status = ? WHERE device_id = ?', ['disconnected', deviceId]);
  console.log(`[SessionManager] Session stopped: ${deviceId}`);
}

/**
 * Logout and delete session data for a device
 */
async function logoutSession(deviceId) {
  const session = sessions.get(deviceId);
  if (session) {
    try {
      await session.sock.logout();
      session.sock.end(undefined);
    } catch (err) {
      console.error(`[SessionManager] Logout error for ${deviceId}:`, err.message);
    }
    sessions.delete(deviceId);
  }

  // Delete session files
  const sessionDir = path.join(SESSIONS_DIR, deviceId);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }

  await db.execute('UPDATE wa_devices SET status = ?, phone_number = NULL WHERE device_id = ?', ['disconnected', deviceId]);
  console.log(`[SessionManager] Logged out and cleaned: ${deviceId}`);
}

/**
 * Get a session
 */
function getSession(deviceId) {
  return sessions.get(deviceId) || null;
}

/**
 * Get all active sessions
 */
function getAllSessions() {
  return sessions;
}

/**
 * Restore all sessions that were previously connected
 */
async function restoreAllSessions() {
  try {
    const [devices] = await db.execute('SELECT device_id FROM wa_devices');
    console.log(`[SessionManager] Restoring ${devices.length} device session(s)...`);

    for (const device of devices) {
      const sessionDir = path.join(SESSIONS_DIR, device.device_id);
      if (fs.existsSync(sessionDir)) {
        console.log(`[SessionManager] Restoring session: ${device.device_id}`);
        await startSession(device.device_id);
        // Small delay between session starts
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } catch (err) {
    console.error('[SessionManager] Failed to restore sessions:', err.message);
  }
}

module.exports = {
  startSession,
  stopSession,
  logoutSession,
  getSession,
  getAllSessions,
  restoreAllSessions,
  flushHistory,
  getStore: (deviceId) => sessions.get(deviceId)?.store || null,
};
