const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'quix_mtd',
  password: process.env.DB_PASSWORD || 'your_password_here',
  port: process.env.DB_PORT || 5432,
  // Connection pool settings
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // return an error after 2 seconds if connection could not be established
  maxUses: 7500, // close (and replace) a connection after it's been used 7500 times
};

// SSL configuration for production
if (process.env.NODE_ENV === 'production') {
  dbConfig.ssl = {
    rejectUnauthorized: false,
    ca: process.env.DB_SSL_CA,
    key: process.env.DB_SSL_KEY,
    cert: process.env.DB_SSL_CERT,
  };
}

// Create connection pool
const pool = new Pool(dbConfig);

// Connection event handlers
pool.on('connect', (client) => {
  console.log('✅ New client connected to database');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('acquire', (client) => {
  console.log('🔗 Client acquired from pool');
});

pool.on('release', (client) => {
  console.log('🔓 Client released back to pool');
});

// Database connection test
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0].now);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return false;
  }
};

// Initialize database schema
const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database schema...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'schema', 'quix.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.warn('⚠️ Schema file not found at:', schemaPath);
      return false;
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    const client = await pool.connect();
    await client.query(schema);
    client.release();
    
    console.log('✅ Database schema initialized successfully');
    return true;
  } catch (err) {
    console.error('❌ Failed to initialize database schema:', err.message);
    return false;
  }
};

// Execute a query with error handling
const query = async (text, params = []) => {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    console.log('📊 Query executed:', {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    
    console.error('❌ Query error:', {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      error: err.message
    });
    
    throw err;
  }
};

// Execute a transaction
const transaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Get a client from the pool (for manual transaction management)
const getClient = async () => {
  return await pool.connect();
};

// Database health check
const healthCheck = async () => {
  try {
    const result = await query('SELECT 1 as healthy');
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connected: true,
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      connected: false,
      error: err.message
    };
  }
};

// Graceful shutdown
const shutdown = async () => {
  console.log('🔄 Closing database connections...');
  
  try {
    await pool.end();
    console.log('✅ Database connections closed successfully');
  } catch (err) {
    console.error('❌ Error closing database connections:', err.message);
  }
};

// Handle process termination
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

// Database utilities for common operations
const dbUtils = {
  // Check if table exists
  tableExists: async (tableName) => {
    const result = await query(
      'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)',
      [tableName]
    );
    return result.rows[0].exists;
  },
  
  // Get table row count
  getRowCount: async (tableName) => {
    const result = await query(`SELECT COUNT(*) FROM ${tableName}`);
    return parseInt(result.rows[0].count);
  },
  
  // Check database version
  getVersion: async () => {
    const result = await query('SELECT version()');
    return result.rows[0].version;
  },
  
  // Get database size
  getDatabaseSize: async () => {
    const result = await query(
      'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
    );
    return result.rows[0].size;
  }
};

// Export everything
module.exports = {
  pool,
  query,
  transaction,
  getClient,
  testConnection,
  initializeDatabase,
  healthCheck,
  shutdown,
  dbUtils
};

// Auto-test connection on module load
if (require.main !== module) {
  testConnection();
}