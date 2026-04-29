const mysql = require('mysql2/promise');

const basePoolConfig = {
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
};

const sharedConfig = {
  ...basePoolConfig,
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
};

const authDB = mysql.createPool({
  ...sharedConfig,
  database: process.env.AUTH_DB_NAME || process.env.BSERC_DB_NAME || process.env.DB_NAME || 'bserc_core_db',
});

const lmsDB = mysql.createPool({
  ...basePoolConfig,
  ...sharedConfig,
  database: process.env.LMS_DB_NAME || 'lms_core_db',
});

// Keep default export backward-compatible for auth/user modules.
module.exports = authDB;
module.exports.authDB = authDB;
module.exports.bsercDB = authDB;
module.exports.lmsDB = lmsDB;