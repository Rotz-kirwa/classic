// config/db.js
const { Pool } = require('pg');
// require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'fortune',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'fortune_db',
  password: process.env.DB_PASS || 'fortune123',
  port: process.env.DB_PORT || 5432,
});

async function connectDB() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected with pg Pool.');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = pool;
module.exports.connectDB = connectDB;
