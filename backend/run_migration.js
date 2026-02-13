require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wa_gateway',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('Running migration...');
    await pool.query("ALTER TABLE wa_devices ADD COLUMN IF NOT EXISTS auto_reply BOOLEAN DEFAULT FALSE");
    await pool.query("ALTER TABLE wa_devices ADD COLUMN IF NOT EXISTS auto_reply_prompt TEXT DEFAULT NULL");
    console.log('Migration successful: Added auto_reply columns');
  } catch (err) {
    // If error is about syntax (MariaDB < 10.2), try without IF NOT EXISTS and ignore error if exists
    console.log('Initial migration attempt failed, trying fallback...', err.message);
    try {
        await pool.query("ALTER TABLE wa_devices ADD COLUMN auto_reply BOOLEAN DEFAULT FALSE");
    } catch (e) { console.log('auto_reply col might exist'); }
    
    try {
        await pool.query("ALTER TABLE wa_devices ADD COLUMN auto_reply_prompt TEXT DEFAULT NULL");
    } catch (e) { console.log('auto_reply_prompt col might exist'); }
  } finally {
    await pool.end();
  }
}

runMigration();
