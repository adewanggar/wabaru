require('dotenv').config(); // Load .env
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Import modules
const db = require('./src/db');
const sessionManager = require('./src/sessionManager');
const devicesRouter = require('./src/routes/devices');
const messagesRouter = require('./src/routes/messages');
const genaiRouter = require('./src/routes/genai');

const app = express();
app.use(express.json());
app.use(cors());

const port = process.env.PORT || 3000;

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'WhatsApp Gateway Multi-Device API',
    version: '2.0.0',
    endpoints: {
      devices: '/api/devices',
      send_message: '/api/send-message',
      queue_status: '/api/queue-status',
      outbox: '/api/outbox',
    },
  });
});

// Routes
const historyRouter = require('./src/routes/history');

app.use('/api/devices', devicesRouter);
app.use('/api/genai', genaiRouter);
app.use('/api/history', historyRouter);
app.use('/api', messagesRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const connection = await db.getConnection();
    console.log('[Server] Database connected successfully');
    connection.release();

    // Check for HTTPS
    const sslKeyPath = process.env.SSL_KEY_PATH || 'private.key';
    const sslCertPath = process.env.SSL_CERT_PATH || 'certificate.crt';

    let server;
    if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
      const https = require('https');
      const httpsOptions = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
      };
      server = https.createServer(httpsOptions, app);
      server.listen(port, () => {
        console.log(`[Server] WhatsApp Gateway listening on port ${port} (HTTPS)`);
      });
    } else {
      server = app.listen(port, () => {
        console.log(`[Server] WhatsApp Gateway listening on port ${port} (HTTP)`);
      });
    }

    // Restore all existing device sessions
    await sessionManager.restoreAllSessions();
    console.log('[Server] All sessions restored');
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
};

startServer();
