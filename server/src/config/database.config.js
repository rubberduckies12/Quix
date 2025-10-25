const { Pool } = require('pg');
const logger = require('../utils/logger.util');

// Database configuration
const config = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'mtd_tax_bridge',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
  
  // Query timeout
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,
  
  // Statement timeout
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000
};

// Create connection pool
const pool = new Pool(config);

// Handle pool events
pool.on('connect', (client) => {
  logger.debug('New database client connected');
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle database client:', err);
});

pool.on('remove', (client) => {
  logger.debug('Database client removed from pool');
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    return false;
  }
};

// Graceful shutdown
const closePool = async () => {
  try {
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool:', error);
  }
};

// Export pool and utilities
module.exports = {
  pool,
  testConnection,
  closePool,
  query: (text, params) => pool.query(text, params)
};