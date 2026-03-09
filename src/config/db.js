const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function getEnv(key, fallback) {
  const value = process.env[key];
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed === '' ? fallback : trimmed;
}

const dbConfig = {
  host: getEnv('DB_HOST', '127.0.0.1'),
  user: getEnv('DB_USER', 'root'),
  password: process.env.DB_PASSWORD ?? '',
  database: getEnv('DB_NAME', 'pos_system'),
  port: Number(getEnv('DB_PORT', '3306')),
};

const pool = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  port: dbConfig.port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log(`DB config -> host=${dbConfig.host} port=${dbConfig.port} user=${dbConfig.user} db=${dbConfig.database}`);

// TEST CONNECTION
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ MySQL connection failed:', err.code || err.name || 'UNKNOWN_ERROR', err.message || '(no message)');
  } else {
    console.log('✅ MySQL connected successfully');
    connection.release();
  }
});

module.exports = pool.promise();
