require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wa_gateway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function runMigration() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log('Running migration...');
    const queries = [
      "ALTER TABLE wa_devices ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50) DEFAULT 'gemini'"
    ];

    for (const q of queries) {
      try {
        await connection.query(q);
      } catch (err) {
        console.log('Query failed (maybe column exists):', err.message);
        // Fallback for older MariaDB/MySQL without IF NOT EXISTS support inside ADD COLUMN
        if (err.code === 'ER_PARSE_ERROR' || err.code === 'ER_DUP_FIELDNAME') {
             try {
                await connection.query("ALTER TABLE wa_devices ADD COLUMN ai_provider VARCHAR(50) DEFAULT 'gemini'");
             } catch (e) { console.log('Column ai_provider likely exists'); }
        }
      }
    }
    
    console.log('Migration successful: Added ai_provider column');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await connection.end();
  }
}

runMigration();
