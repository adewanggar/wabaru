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
    console.log('Running migration to add gemini_api_key column...');
    // Try to add the column
    try {
        await pool.query("ALTER TABLE wa_devices ADD COLUMN gemini_api_key VARCHAR(255) DEFAULT NULL AFTER api_key");
        console.log('Migration successful: Added gemini_api_key column');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column gemini_api_key already exists.');
        } else {
            throw err;
        }
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

runMigration();
