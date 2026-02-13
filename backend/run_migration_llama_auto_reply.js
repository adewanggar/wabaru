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
    console.log('Running migration to add ai_model column...');
    // Try to add the column
    try {
        await pool.query("ALTER TABLE wa_devices ADD COLUMN ai_model VARCHAR(50) DEFAULT NULL AFTER ai_provider");
        console.log('Migration successful: Added ai_model column');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column ai_model already exists.');
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
