const Redis = require('ioredis');
const EventEmitter = require('events');

/**
 * Main Cache Service for MTD Tax Bridge Application
 * Provides Redis client management, core operations, health monitoring,
 * and integration points for specialized cache services
 */
class CacheService extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    
    // Initialize clients
    this.client = null;
    this.cluster = null;
    this.isClusterMode = false;
    
    // Connection state
    this.isConnected = false;
    this.isReady = false;
    this.connectionAttempts = 0;
    this.lastHealthCheck = null;
    
    // Configuration
    this.config = this._loadConfiguration();
    
    // Circuit breaker state
    this.circuitBreaker = {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failures: 0,
      lastFailure: null,
      timeout: 60000, // 1 minute
      threshold: 5
    };
    
    // Performance metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      operations: 0,
      lastReset: Date.now()
    };
    
    // Key validation patterns
    this.keyPatterns = {
      valid: /^[a-zA-Z0-9:._-]+$/,
      maxLength: 250
    };
    
    // TTL defaults (in seconds)
    this.defaultTTL = {
      short: 300,      // 5 minutes
      medium: 3600,    // 1 hour
      long: 86400,     // 24 hours
      permanent: null  // No expiry
    };
  }

  // ====== INITIALIZATION & CONNECTION MANAGEMENT ======

  /**
   * Initialize Redis connection
   * @returns {Promise<boolean>} Connection success status
   */
  async initialize() {
    try {
      this.logger.info('Initializing cache service...');
      
      if (this.config.cluster.enabled) {
        await this._initializeCluster();
      } else {
        await this._initializeSingleNode();
      }
      
      // Set up event listeners
      this._setupEventListeners();
      
      // Start health monitoring
      this._startHealthMonitoring();
      
      // Initialize cache warming
      await this._initializeCacheWarming();
      
      this.logger.info('Cache service initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Cache service initialization failed:', error);
      return false;
    }
  }

  /**
   * Initialize single Redis node
   * @private
   */
  async _initializeSingleNode() {
    const options = {
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.database,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      ...this.config.redis.options
    };

    this.client = new Redis(options);
    this.isClusterMode = false;
    
    // Test connection
    await this.client.connect();
    await this.client.ping();
    
    this.isConnected = true;
    this.isReady = true;
  }

  /**
   * Initialize Redis cluster
   * @private
   */
  async _initializeCluster() {
    const clusterOptions = {
      enableOfflineQueue: false,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300,
      maxRetriesPerRequest: 3,
      scaleReads: 'slave',
      ...this.config.cluster.options
    };

    this.cluster = new Redis.Cluster(this.config.cluster.nodes, clusterOptions);
    this.client = this.cluster;
    this.isClusterMode = true;
    
    // Test cluster connection
    await this.cluster.ping();
    
    this.isConnected = true;
    this.isReady = true;
  }

  /**
   * Setup Redis event listeners
   * @private
   */
  _setupEventListeners() {
    const client = this.client;
    
    client.on('connect', () => {
      this.logger.info('Redis connected');
      this.isConnected = true;
      this.connectionAttempts = 0;
      this.emit('connected');
    });
    
    client.on('ready', () => {
      this.logger.info('Redis ready');
      this.isReady = true;
      this.emit('ready');
    });
    
    client.on('error', (error) => {
      this.logger.error('Redis error:', error);
      this._handleCircuitBreaker(error);
      this.emit('error', error);
    });
    
    client.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.isConnected = false;
      this.isReady = false;
      this.emit('disconnected');
    });
    
    client.on('reconnecting', () => {
      this.connectionAttempts++;
      this.logger.info(`Redis reconnecting (attempt ${this.connectionAttempts})`);
      this.emit('reconnecting');
    });
  }

  // ====== CORE CACHE OPERATIONS ======

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    return this._executeWithCircuitBreaker(async () => {
      this._validateKey(key);
      
      const startTime = Date.now();
      const rawValue = await this.client.get(key);
      
      this._recordMetrics('get', Date.now() - startTime, rawValue !== null);
      
      if (rawValue === null) {
        return null;
      }
      
      return this._deserialize(rawValue);
    });
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number|string} ttl - Time to live (seconds or 'short'|'medium'|'long')
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = null) {
    return this._executeWithCircuitBreaker(async () => {
      this._validateKey(key);
      
      const startTime = Date.now();
      const serializedValue = this._serialize(value);
      const resolvedTTL = this._resolveTTL(ttl);
      
      let result;
      if (resolvedTTL) {
        result = await this.client.setex(key, resolvedTTL, serializedValue);
      } else {
        result = await this.client.set(key, serializedValue);
      }
      
      this._recordMetrics('set', Date.now() - startTime, true);
      
      return result === 'OK';
    });
  }

  /**
   * Delete key from cache
   * @param {string|string[]} keys - Key(s) to delete
   * @returns {Promise<number>} Number of keys deleted
   */
  async delete(keys) {
    return this._executeWithCircuitBreaker(async () => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach(key => this._validateKey(key));
      
      const startTime = Date.now();
      const result = await this.client.del(...keyArray);
      
      this._recordMetrics('delete', Date.now() - startTime, true);
      
      return result;
    });
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Existence status
   */
  async exists(key) {
    return this._executeWithCircuitBreaker(async () => {
      this._validateKey(key);
      
      const startTime = Date.now();
      const result = await this.client.exists(key);
      
      this._recordMetrics('exists', Date.now() - startTime, true);
      
      return result === 1;
    });
  }

  /**
   * Set expiry on key
   * @param {string} key - Cache key
   * @param {number} seconds - Seconds until expiry
   * @returns {Promise<boolean>} Success status
   */
  async expire(key, seconds) {
    return this._executeWithCircuitBreaker(async () => {
      this._validateKey(key);
      
      const result = await this.client.expire(key, seconds);
      return result === 1;
    });
  }

  /**
   * Get TTL for key
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
   */
  async ttl(key) {
    return this._executeWithCircuitBreaker(async () => {
      this._validateKey(key);
      return await this.client.ttl(key);
    });
  }

  /**
   * Increment numeric value
   * @param {string} key - Cache key
   * @param {number} increment - Increment amount (default: 1)
   * @returns {Promise<number>} New value after increment
   */
  async increment(key, increment = 1) {
    return this._executeWithCircuitBreaker(async () => {
      this._validateKey(key);
      
      if (increment === 1) {
        return await this.client.incr(key);
      } else {
        return await this.client.incrby(key, increment);
      }
    });
  }

  /**
   * Get multiple keys
   * @param {string[]} keys - Array of cache keys
   * @returns {Promise<any[]>} Array of values (null for missing keys)
   */
  async batchGet(keys) {
    return this._executeWithCircuitBreaker(async () => {
      keys.forEach(key => this._validateKey(key));
      
      const startTime = Date.now();
      const rawValues = await this.client.mget(...keys);
      
      this._recordMetrics('mget', Date.now() - startTime, true);
      
      return rawValues.map(value => value ? this._deserialize(value) : null);
    });
  }

  /**
   * Set multiple key-value pairs
   * @param {Object} keyValuePairs - Object with key-value pairs
   * @param {number|string} ttl - Time to live for all keys
   * @returns {Promise<boolean>} Success status
   */
  async batchSet(keyValuePairs, ttl = null) {
    return this._executeWithCircuitBreaker(async () => {
      const entries = Object.entries(keyValuePairs);
      entries.forEach(([key]) => this._validateKey(key));
      
      const startTime = Date.now();
      const resolvedTTL = this._resolveTTL(ttl);
      
      if (resolvedTTL) {
        // Use pipeline for TTL operations
        const pipeline = this.client.pipeline();
        
        entries.forEach(([key, value]) => {
          pipeline.setex(key, resolvedTTL, this._serialize(value));
        });
        
        const results = await pipeline.exec();
        const success = results.every(([error, result]) => !error && result === 'OK');
        
        this._recordMetrics('mset_ttl', Date.now() - startTime, success);
        return success;
      } else {
        // Use MSET for no TTL
        const flatArray = [];
        entries.forEach(([key, value]) => {
          flatArray.push(key, this._serialize(value));
        });
        
        const result = await this.client.mset(...flatArray);
        
        this._recordMetrics('mset', Date.now() - startTime, true);
        return result === 'OK';
      }
    });
  }

  // ====== PIPELINE OPERATIONS ======

  /**
   * Create pipeline for batch operations
   * @returns {Object} Pipeline instance
   */
  createPipeline() {
    return this.client.pipeline();
  }

  /**
   * Execute pipeline
   * @param {Object} pipeline - Pipeline instance
   * @returns {Promise<Array>} Pipeline results
   */
  async executePipeline(pipeline) {
    return this._executeWithCircuitBreaker(async () => {
      const startTime = Date.now();
      const results = await pipeline.exec();
      
      this._recordMetrics('pipeline', Date.now() - startTime, true);
      
      return results;
    });
  }

  // ====== SET OPERATIONS ======

  /**
   * Add to set
   * @param {string} key - Set key
   * @param {string|string[]} members - Member(s) to add
   * @returns {Promise<number>} Number of members added
   */
  async addToSet(key, members) {
    return this._executeWithCircuitBreaker(async () => {
      this._validateKey(key);
      const memberArray = Array.isArray(members) ? members : [members];
      return await this.client.sadd(key, ...memberArray);
    });
  }

  /**
   * Remove from set
   * @param {string} key - Set key
   * @param {string|string[]} members - Member(s) to remove
   * @returns {Promise<number>} Number of members removed
   */
  async removeFromSet(key, members) {
    return this._executeWithCircuitBreaker(async () => {
      this._validateKey(key);
      const memberArray = Array.isArray(members) ? members : [members];
      return await this.client.srem(key, ...memberArray);
    });
  }

  /**
   * Get all set members
   * @param {string} key - Set key
   * @returns {Promise<string[]>} Set members
   */
  async getSetMembers(key) {
    return this._executeWithCircuitBreaker(async () => {
      this._validateKey(key);
      return await this.client.smembers(key);
    });
  }

  /**
   * Check if member exists in set
   * @param {string} key - Set key
   * @param {string} member - Member to check
   * @returns {Promise<boolean>} Membership status
   */
  async isSetMember(key, member) {
    return this._executeWithCircuitBreaker(async () => {
      this._validateKey(key);
      const result = await this.client.sismember(key, member);
      return result === 1;
    });
  }

  // ====== PATTERN OPERATIONS ======

  /**
   * Get keys matching pattern
   * @param {string} pattern - Key pattern
   * @returns {Promise<string[]>} Matching keys
   */
  async keys(pattern) {
    return this._executeWithCircuitBreaker(async () => {
      // Use SCAN for better performance in production
      if (this.config.useScanForKeys) {
        return await this._scanKeys(pattern);
      } else {
        return await this.client.keys(pattern);
      }
    });
  }

  /**
   * Flush keys matching pattern
   * @param {string} pattern - Key pattern
   * @returns {Promise<number>} Number of keys deleted
   */
  async flushPattern(pattern) {
    return this._executeWithCircuitBreaker(async () => {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        return await this.delete(keys);
      }
      return 0;
    });
  }

  /**
   * Tag-based cache invalidation
   * @param {string[]} tags - Tags to invalidate
   * @returns {Promise<number>} Number of keys invalidated
   */
  async tagBasedInvalidation(tags) {
    return this._executeWithCircuitBreaker(async () => {
      let totalInvalidated = 0;

      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const taggedKeys = await this.getSetMembers(tagKey);
        
        if (taggedKeys.length > 0) {
          // Remove the actual cached data
          totalInvalidated += await this.delete(taggedKeys);
          
          // Remove the tag mapping
          await this.delete(tagKey);
          
          this.logger.info(`Tag-based invalidation: Removed ${taggedKeys.length} keys for tag '${tag}'`);
        }
      }

      return totalInvalidated;
    });
  }

  /**
   * Scan keys with pattern (better for large datasets)
   * @private
   */
  async _scanKeys(pattern) {
    const keys = [];
    let cursor = '0';
    
    do {
      const [nextCursor, foundKeys] = await this.client.scan(
        cursor, 'MATCH', pattern, 'COUNT', 1000
      );
      cursor = nextCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');
    
    return keys;
  }

  // ====== DATABASE QUERY RESULT CACHING ======

  /**
   * Cache database query result
   * @param {string} query - SQL query or identifier
   * @param {any} result - Query result
   * @param {number|string} ttl - Cache TTL
   * @returns {Promise<boolean>} Success status
   */
  async cacheQueryResult(query, result, ttl = 'medium') {
    const queryHash = this._hashQuery(query);
    const key = `query:${queryHash}`;
    
    return await this.set(key, {
      query,
      result,
      timestamp: Date.now(),
      ttl: this._resolveTTL(ttl)
    }, ttl);
  }

  /**
   * Get cached query result
   * @param {string} query - SQL query or identifier
   * @returns {Promise<any>} Cached result or null
   */
  async getCachedQueryResult(query) {
    const queryHash = this._hashQuery(query);
    const key = `query:${queryHash}`;
    
    const cached = await this.get(key);
    return cached ? cached.result : null;
  }

  /**
   * Invalidate query cache by pattern
   * @param {string} tableOrPattern - Table name or pattern
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidateQueryCache(tableOrPattern) {
    const pattern = `query:*${tableOrPattern}*`;
    return await this.flushPattern(pattern);
  }

  // ====== USER DATA CACHING ======

  /**
   * Cache user transactions
   * @param {string} userId - User identifier
   * @param {Array} transactions - Transaction data
   * @param {string} period - Time period (month, quarter, year)
   * @returns {Promise<boolean>} Success status
   */
  async cacheUserTransactions(userId, transactions, period = 'current') {
    const key = `user:${userId}:transactions:${period}`;
    
    return await this.set(key, {
      userId,
      transactions,
      period,
      count: transactions.length,
      lastUpdated: Date.now()
    }, 'medium');
  }

  /**
   * Get cached user transactions
   * @param {string} userId - User identifier
   * @param {string} period - Time period
   * @returns {Promise<Array|null>} Cached transactions or null
   */
  async getCachedUserTransactions(userId, period = 'current') {
    const key = `user:${userId}:transactions:${period}`;
    const cached = await this.get(key);
    
    return cached ? cached.transactions : null;
  }

  /**
   * Cache aggregated user summaries
   * @param {string} userId - User identifier
   * @param {Object} summaries - Aggregated data
   * @param {string} type - Summary type
   * @returns {Promise<boolean>} Success status
   */
  async cacheUserSummaries(userId, summaries, type = 'financial') {
    const key = `user:${userId}:summaries:${type}`;
    
    return await this.set(key, {
      userId,
      summaries,
      type,
      generatedAt: Date.now()
    }, 'long');
  }

  /**
   * Get cached user summaries
   * @param {string} userId - User identifier
   * @param {string} type - Summary type
   * @returns {Promise<Object|null>} Cached summaries or null
   */
  async getCachedUserSummaries(userId, type = 'financial') {
    const key = `user:${userId}:summaries:${type}`;
    const cached = await this.get(key);
    
    return cached ? cached.summaries : null;
  }

  /**
   * Invalidate all user cache
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidateUserCache(userId) {
    const pattern = `user:${userId}:*`;
    return await this.flushPattern(pattern);
  }

  // ====== SYSTEM CONFIGURATION CACHING ======

  /**
   * Cache HMRC categories
   * @param {Array} categories - Category data
   * @returns {Promise<boolean>} Success status
   */
  async cacheHMRCCategories(categories) {
    const key = 'config:hmrc:categories';
    
    return await this.set(key, {
      categories,
      lastUpdated: Date.now(),
      version: this._generateVersion()
    }, 'long');
  }

  /**
   * Get cached HMRC categories
   * @returns {Promise<Array|null>} Cached categories or null
   */
  async getCachedHMRCCategories() {
    const key = 'config:hmrc:categories';
    const cached = await this.get(key);
    
    return cached ? cached.categories : null;
  }

  /**
   * Cache VAT rates
   * @param {Object} vatRates - VAT rate data
   * @returns {Promise<boolean>} Success status
   */
  async cacheVATRates(vatRates) {
    const key = 'config:vat:rates';
    
    return await this.set(key, {
      rates: vatRates,
      effectiveDate: new Date().toISOString(),
      lastUpdated: Date.now()
    }, 'long');
  }

  /**
   * Get cached VAT rates
   * @returns {Promise<Object|null>} Cached VAT rates or null
   */
  async getCachedVATRates() {
    const key = 'config:vat:rates';
    const cached = await this.get(key);
    
    return cached ? cached.rates : null;
  }

  /**
   * Cache tax rates
   * @param {Object} taxRates - Tax rate data
   * @param {string} taxYear - Tax year
   * @returns {Promise<boolean>} Success status
   */
  async cacheTaxRates(taxRates, taxYear) {
    const key = `config:tax:rates:${taxYear}`;
    
    return await this.set(key, {
      rates: taxRates,
      taxYear,
      lastUpdated: Date.now()
    }, 'long');
  }

  /**
   * Get cached tax rates
   * @param {string} taxYear - Tax year
   * @returns {Promise<Object|null>} Cached tax rates or null
   */
  async getCachedTaxRates(taxYear) {
    const key = `config:tax:rates:${taxYear}`;
    const cached = await this.get(key);
    
    return cached ? cached.rates : null;
  }

  /**
   * Invalidate all system configuration cache
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidateSystemConfig() {
    const pattern = 'config:*';
    return await this.flushPattern(pattern);
  }

  // ====== CACHE WARMING STRATEGIES ======

  /**
   * Initialize cache warming on startup
   * @private
   */
  async _initializeCacheWarming() {
    if (!this.config.warming.enabled) {
      return;
    }

    try {
      this.logger.info('Starting cache warming...');

      // Warm system configuration
      if (this.config.warming.systemConfig) {
        await this._warmSystemConfig();
      }

      // Warm common user data
      if (this.config.warming.commonData) {
        await this._warmCommonData();
      }

      this.logger.info('Cache warming completed');
    } catch (error) {
      this.logger.error('Cache warming failed:', error);
    }
  }

  /**
   * Warm system configuration cache
   * @private
   */
  async _warmSystemConfig() {
    try {
      // This would integrate with your configuration service
      const hmrcCategories = await this._fetchHMRCCategories();
      if (hmrcCategories) {
        await this.cacheHMRCCategories(hmrcCategories);
      }

      const vatRates = await this._fetchVATRates();
      if (vatRates) {
        await this.cacheVATRates(vatRates);
      }

      const currentTaxYear = new Date().getFullYear().toString();
      const taxRates = await this._fetchTaxRates(currentTaxYear);
      if (taxRates) {
        await this.cacheTaxRates(taxRates, currentTaxYear);
      }

      this.logger.info('System configuration cache warmed');
    } catch (error) {
      this.logger.error('System config warming failed:', error);
    }
  }

  /**
   * Warm common data cache
   * @private
   */
  async _warmCommonData() {
    try {
      // This would integrate with your data services
      // Example: warm frequently accessed user data, categories, etc.
      this.logger.info('Common data cache warmed');
    } catch (error) {
      this.logger.error('Common data warming failed:', error);
    }
  }

  // ====== HEALTH MONITORING ======

  /**
   * Start health monitoring
   * @private
   */
  _startHealthMonitoring() {
    setInterval(async () => {
      await this._performHealthCheck();
    }, this.config.healthCheck.interval);
  }

  /**
   * Perform health check
   * @returns {Promise<Object>} Health status
   */
  async _performHealthCheck() {
    try {
      const startTime = Date.now();
      
      // Test basic connectivity
      await this.client.ping();
      
      const latency = Date.now() - startTime;
      const memory = await this._getMemoryInfo();
      const connections = await this._getConnectionInfo();
      
      const health = {
        status: 'healthy',
        latency,
        memory,
        connections,
        circuitBreaker: this.circuitBreaker.state,
        metrics: this._getMetrics(),
        timestamp: Date.now()
      };

      this.lastHealthCheck = health;
      this.emit('healthCheck', health);
      
      return health;
    } catch (error) {
      const health = {
        status: 'unhealthy',
        error: error.message,
        circuitBreaker: this.circuitBreaker.state,
        timestamp: Date.now()
      };

      this.lastHealthCheck = health;
      this.emit('healthCheck', health);
      this.logger.error('Health check failed:', error);
      
      return health;
    }
  }

  /**
   * Get current health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    return this.lastHealthCheck || { status: 'unknown' };
  }

  // ====== CIRCUIT BREAKER PATTERN ======

  /**
   * Execute operation with circuit breaker
   * @private
   */
  async _executeWithCircuitBreaker(operation) {
    // Check circuit breaker state
    if (this.circuitBreaker.state === 'OPEN') {
      if (Date.now() - this.circuitBreaker.lastFailure < this.circuitBreaker.timeout) {
        throw new Error('Circuit breaker is OPEN');
      } else {
        this.circuitBreaker.state = 'HALF_OPEN';
        this.logger.info('Circuit breaker state changed to HALF_OPEN');
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit breaker if it was half-open
      if (this.circuitBreaker.state === 'HALF_OPEN') {
        this.circuitBreaker.state = 'CLOSED';
        this.circuitBreaker.failures = 0;
        this.logger.info('Circuit breaker state changed to CLOSED');
      }
      
      return result;
    } catch (error) {
      this._handleCircuitBreaker(error);
      throw error;
    }
  }

  /**
   * Handle circuit breaker state
   * @private
   */
  _handleCircuitBreaker(error) {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'OPEN';
      this.logger.warn('Circuit breaker state changed to OPEN');
      this.emit('circuitBreakerOpen', { error, failures: this.circuitBreaker.failures });
    }
  }

  // ====== HELPER METHODS ======

  /**
   * Load configuration
   * @private
   */
  _loadConfiguration() {
    return {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        database: parseInt(process.env.REDIS_DATABASE) || 0,
        options: {
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          lazyConnect: true
        }
      },
      cluster: {
        enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
        nodes: process.env.REDIS_CLUSTER_NODES ? 
          process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
            const [host, port] = node.trim().split(':');
            return { host, port: parseInt(port) };
          }) : [],
        options: {
          enableOfflineQueue: false,
          scaleReads: 'slave'
        }
      },
      healthCheck: {
        interval: parseInt(process.env.CACHE_HEALTH_CHECK_INTERVAL) || 30000
      },
      warming: {
        enabled: process.env.CACHE_WARMING_ENABLED !== 'false',
        systemConfig: true,
        commonData: true
      },
      useScanForKeys: process.env.CACHE_USE_SCAN === 'true'
    };
  }

  /**
   * Validate cache key
   * @private
   */
  _validateKey(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('Cache key must be a non-empty string');
    }
    
    if (key.length > this.keyPatterns.maxLength) {
      throw new Error(`Cache key too long (max ${this.keyPatterns.maxLength} characters)`);
    }
    
    if (!this.keyPatterns.valid.test(key)) {
      throw new Error('Cache key contains invalid characters');
    }
  }

  /**
   * Serialize value for storage
   * @private
   */
  _serialize(value) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      this.logger.error('Serialization failed:', error);
      throw new Error('Failed to serialize cache value');
    }
  }

  /**
   * Deserialize value from storage
   * @private
   */
  _deserialize(value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      this.logger.error('Deserialization failed:', error);
      return value; // Return raw value if JSON parsing fails
    }
  }

  /**
   * Resolve TTL value
   * @private
   */
  _resolveTTL(ttl) {
    if (ttl === null || ttl === undefined) {
      return null;
    }
    
    if (typeof ttl === 'number') {
      return ttl;
    }
    
    if (typeof ttl === 'string') {
      return this.defaultTTL[ttl] || null;
    }
    
    return null;
  }

  /**
   * Hash query for consistent caching
   * @private
   */
  _hashQuery(query) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(query).digest('hex');
  }

  /**
   * Generate version for cache entries
   * @private
   */
  _generateVersion() {
    return Date.now().toString();
  }

  /**
   * Record performance metrics
   * @private
   */
  _recordMetrics(operation, latency, hit) {
    this.metrics.operations++;
    
    if (operation === 'get') {
      if (hit) {
        this.metrics.hits++;
      } else {
        this.metrics.misses++;
      }
    }
    
    // Reset metrics every hour
    if (Date.now() - this.metrics.lastReset > 3600000) {
      this.metrics = {
        hits: 0,
        misses: 0,
        errors: 0,
        operations: 0,
        lastReset: Date.now()
      };
    }
  }

  /**
   * Get performance metrics
   * @private
   */
  _getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRatio: total > 0 ? (this.metrics.hits / total * 100).toFixed(2) : 0
    };
  }

  /**
   * Get memory information
   * @private
   */
  async _getMemoryInfo() {
    try {
      const info = await this.client.memory('USAGE');
      return { usage: info };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get connection information
   * @private
   */
  async _getConnectionInfo() {
    try {
      const info = await this.client.info('clients');
      return { info };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Mock data fetching methods (would integrate with real services)
  async _fetchHMRCCategories() {
    // Mock implementation - would fetch from HMRC API or database
    return [
      { code: 'office_costs', name: 'Office costs' },
      { code: 'travel', name: 'Travel costs' },
      { code: 'other_business_costs', name: 'Other business costs' }
    ];
  }

  async _fetchVATRates() {
    // Mock implementation - would fetch current VAT rates
    return {
      standard: 20,
      reduced: 5,
      zero: 0
    };
  }

  async _fetchTaxRates(taxYear) {
    // Mock implementation - would fetch tax rates for specific year
    return {
      personalAllowance: 12570,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45
    };
  }

  /**
   * Graceful shutdown
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down cache service...');
      
      if (this.client) {
        await this.client.quit();
      }
      
      this.isConnected = false;
      this.isReady = false;
      
      this.logger.info('Cache service shutdown complete');
    } catch (error) {
      this.logger.error('Cache service shutdown error:', error);
    }
  }
}

module.exports = CacheService;