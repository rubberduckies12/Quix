const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

// Promisify compression functions
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Cache Utilities for MTD Tax Bridge Application
 * Provides comprehensive cache management, monitoring, and optimization tools
 */
class CacheUtils {
  constructor(redisClient, logger) {
    this.redis = redisClient;
    this.logger = logger;
    this.metrics = new Map(); // Performance metrics storage
    this.compressionThreshold = 1024; // Compress data larger than 1KB
    this.encryptionKey = process.env.CACHE_ENCRYPTION_KEY || crypto.randomBytes(32);
  }

  // ====== INVALIDATION STRATEGIES ======

  /**
   * Tag-based cache invalidation
   * @param {string[]} tags - Tags to invalidate
   * @returns {Promise<number>} Number of keys invalidated
   */
  async tagBasedInvalidation(tags) {
    try {
      const startTime = Date.now();
      let totalInvalidated = 0;

      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const taggedKeys = await this.redis.smembers(tagKey);
        
        if (taggedKeys.length > 0) {
          // Remove the actual cached data
          await this.redis.del(taggedKeys);
          
          // Remove the tag mapping
          await this.redis.del(tagKey);
          
          totalInvalidated += taggedKeys.length;
          
          this.logger.info(`Tag-based invalidation: Removed ${taggedKeys.length} keys for tag '${tag}'`);
        }
      }

      this._recordMetric('invalidation_latency', Date.now() - startTime);
      return totalInvalidated;
    } catch (error) {
      this.logger.error('Tag-based invalidation failed:', error);
      throw error;
    }
  }

  /**
   * Time-based cache invalidation
   * @param {string} pattern - Key pattern to match
   * @param {number} maxAge - Maximum age in seconds
   * @returns {Promise<number>} Number of keys invalidated
   */
  async timeBasedInvalidation(pattern, maxAge) {
    try {
      const startTime = Date.now();
      const cutoffTime = Date.now() - (maxAge * 1000);
      let cursor = '0';
      let totalInvalidated = 0;

      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          const creationTime = await this.redis.hget(`${key}:meta`, 'created_at');
          
          if (creationTime && parseInt(creationTime) < cutoffTime) {
            await this.redis.del(key);
            await this.redis.del(`${key}:meta`);
            totalInvalidated++;
          }
        }
      } while (cursor !== '0');

      this._recordMetric('time_based_invalidation_latency', Date.now() - startTime);
      this.logger.info(`Time-based invalidation: Removed ${totalInvalidated} stale keys`);
      
      return totalInvalidated;
    } catch (error) {
      this.logger.error('Time-based invalidation failed:', error);
      throw error;
    }
  }

  /**
   * Event-driven cache invalidation
   * @param {string} event - Event type
   * @param {string[]} affectedKeys - Keys affected by the event
   * @returns {Promise<number>} Number of keys invalidated
   */
  async eventDrivenInvalidation(event, affectedKeys) {
    try {
      const startTime = Date.now();
      const eventKey = `event:${event}`;
      
      // Get all keys associated with this event
      const registeredKeys = await this.redis.smembers(eventKey);
      const keysToInvalidate = [...new Set([...affectedKeys, ...registeredKeys])];
      
      if (keysToInvalidate.length > 0) {
        await this.redis.del(keysToInvalidate);
        
        // Clean up event registration
        await this.redis.del(eventKey);
        
        this.logger.info(`Event-driven invalidation: Removed ${keysToInvalidate.length} keys for event '${event}'`);
      }

      this._recordMetric('event_driven_invalidation_latency', Date.now() - startTime);
      return keysToInvalidate.length;
    } catch (error) {
      this.logger.error('Event-driven invalidation failed:', error);
      throw error;
    }
  }

  /**
   * Cascading cache invalidation
   * @param {string} key - Primary key that changed
   * @param {string[]} dependentKeys - Keys that depend on the primary key
   * @returns {Promise<number>} Number of keys invalidated
   */
  async cascadingInvalidation(key, dependentKeys) {
    try {
      const startTime = Date.now();
      const allKeys = [key, ...dependentKeys];
      
      // Get additional dependent keys from dependency mapping
      const depKey = `deps:${key}`;
      const additionalDeps = await this.redis.smembers(depKey);
      
      const totalKeys = [...new Set([...allKeys, ...additionalDeps])];
      
      if (totalKeys.length > 0) {
        await this.redis.del(totalKeys);
        await this.redis.del(depKey); // Clean up dependency mapping
        
        this.logger.info(`Cascading invalidation: Removed ${totalKeys.length} dependent keys for '${key}'`);
      }

      this._recordMetric('cascading_invalidation_latency', Date.now() - startTime);
      return totalKeys.length;
    } catch (error) {
      this.logger.error('Cascading invalidation failed:', error);
      throw error;
    }
  }

  /**
   * Intelligent cache invalidation based on user context
   * @param {string} userId - User ID
   * @param {Object} changedData - Data that changed
   * @returns {Promise<number>} Number of keys invalidated
   */
  async intelligentInvalidation(userId, changedData) {
    try {
      const startTime = Date.now();
      const keysToInvalidate = [];
      
      // User-specific data
      keysToInvalidate.push(`user:${userId}:*`);
      
      // Invalidate based on data type
      if (changedData.type === 'transaction') {
        keysToInvalidate.push(`transactions:${userId}:*`);
        keysToInvalidate.push(`aggregated:${userId}:*`);
        keysToInvalidate.push(`categorization:*`);
      }
      
      if (changedData.type === 'hmrc_tokens') {
        keysToInvalidate.push(`hmrc:${userId}:*`);
        keysToInvalidate.push(`obligations:${userId}:*`);
      }
      
      if (changedData.type === 'file_processing') {
        keysToInvalidate.push(`file:${changedData.fileId}:*`);
        keysToInvalidate.push(`processing:${changedData.fileId}:*`);
      }
      
      let totalInvalidated = 0;
      for (const pattern of keysToInvalidate) {
        totalInvalidated += await this._deleteByPattern(pattern);
      }
      
      this._recordMetric('intelligent_invalidation_latency', Date.now() - startTime);
      this.logger.info(`Intelligent invalidation: Removed ${totalInvalidated} keys for user ${userId}`);
      
      return totalInvalidated;
    } catch (error) {
      this.logger.error('Intelligent invalidation failed:', error);
      throw error;
    }
  }

  // ====== PERFORMANCE MONITORING ======

  /**
   * Track cache hit ratio
   * @param {string} key - Cache key
   * @param {boolean} hit - Whether it was a cache hit
   */
  trackCacheHitRatio(key, hit) {
    const keyType = this._getKeyType(key);
    const metricKey = `hit_ratio:${keyType}`;
    
    if (!this.metrics.has(metricKey)) {
      this.metrics.set(metricKey, { hits: 0, misses: 0 });
    }
    
    const stats = this.metrics.get(metricKey);
    if (hit) {
      stats.hits++;
    } else {
      stats.misses++;
    }
    
    // Log hit ratio periodically
    const total = stats.hits + stats.misses;
    if (total % 100 === 0) {
      const ratio = (stats.hits / total * 100).toFixed(2);
      this.logger.info(`Cache hit ratio for ${keyType}: ${ratio}% (${stats.hits}/${total})`);
    }
  }

  /**
   * Measure cache operation latency
   * @param {string} operation - Operation type
   * @param {number} latency - Latency in milliseconds
   */
  measureCacheLatency(operation, latency) {
    this._recordMetric(`${operation}_latency`, latency);
    
    // Alert on high latency
    if (latency > 1000) {
      this.logger.warn(`High cache latency detected: ${operation} took ${latency}ms`);
    }
  }

  /**
   * Track cache memory usage by pattern
   * @param {string} pattern - Key pattern
   * @returns {Promise<Object>} Memory usage statistics
   */
  async trackCacheSize(pattern) {
    try {
      let cursor = '0';
      let totalKeys = 0;
      let totalMemory = 0;
      
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        
        for (const key of keys) {
          const memory = await this.redis.memory('USAGE', key);
          if (memory) {
            totalMemory += memory;
            totalKeys++;
          }
        }
      } while (cursor !== '0');
      
      const stats = {
        pattern,
        keyCount: totalKeys,
        totalMemoryBytes: totalMemory,
        averageKeySize: totalKeys > 0 ? Math.round(totalMemory / totalKeys) : 0,
        totalMemoryMB: (totalMemory / 1024 / 1024).toFixed(2)
      };
      
      this.logger.info(`Cache size for pattern '${pattern}':`, stats);
      return stats;
    } catch (error) {
      this.logger.error('Cache size tracking failed:', error);
      throw error;
    }
  }

  // ====== CACHE ANALYTICS & REPORTING ======

  /**
   * Generate comprehensive cache report
   * @param {string} period - Report period ('hour', 'day', 'week')
   * @returns {Promise<Object>} Cache analytics report
   */
  async generateCacheReport(period = 'day') {
    try {
      const report = {
        period,
        timestamp: new Date().toISOString(),
        metrics: {},
        topKeys: [],
        recommendations: []
      };
      
      // Collect hit ratio metrics
      for (const [key, value] of this.metrics) {
        if (key.startsWith('hit_ratio:')) {
          const keyType = key.replace('hit_ratio:', '');
          const total = value.hits + value.misses;
          report.metrics[keyType] = {
            hits: value.hits,
            misses: value.misses,
            ratio: total > 0 ? (value.hits / total * 100).toFixed(2) : 0
          };
        }
      }
      
      // Get top memory consuming keys
      const memoryInfo = await this.redis.info('memory');
      report.totalMemory = this._parseMemoryInfo(memoryInfo);
      
      // Get cache key distribution
      report.keyDistribution = await this._getKeyDistribution();
      
      // Generate recommendations
      report.recommendations = this._generateRecommendations(report);
      
      this.logger.info('Cache report generated:', report);
      return report;
    } catch (error) {
      this.logger.error('Cache report generation failed:', error);
      throw error;
    }
  }

  // ====== CACHE WARMING ======

  /**
   * Preload commonly accessed user data
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of items preloaded
   */
  async implementCacheWarming(userId) {
    try {
      const startTime = Date.now();
      let preloadedItems = 0;
      
      // Preload user profile
      await this._warmupUserProfile(userId);
      preloadedItems++;
      
      // Preload recent transactions
      await this._warmupUserTransactions(userId);
      preloadedItems++;
      
      // Preload HMRC tokens if available
      await this._warmupHMRCTokens(userId);
      preloadedItems++;
      
      // Preload common categorization mappings
      await this._warmupCategorizationMappings();
      preloadedItems++;
      
      const duration = Date.now() - startTime;
      this.logger.info(`Cache warming completed for user ${userId}: ${preloadedItems} items in ${duration}ms`);
      
      return preloadedItems;
    } catch (error) {
      this.logger.error('Cache warming failed:', error);
      throw error;
    }
  }

  // ====== COMPRESSION & ENCRYPTION ======

  /**
   * Compress large values before caching
   * @param {any} value - Value to compress
   * @returns {Promise<string>} Compressed and encoded value
   */
  async compressLargeValues(value) {
    try {
      const serialized = JSON.stringify(value);
      
      if (serialized.length < this.compressionThreshold) {
        return JSON.stringify({ compressed: false, data: value });
      }
      
      const compressed = await gzip(Buffer.from(serialized));
      const encoded = compressed.toString('base64');
      
      this.logger.debug(`Compressed value from ${serialized.length} to ${encoded.length} bytes`);
      
      return JSON.stringify({
        compressed: true,
        data: encoded,
        originalSize: serialized.length,
        compressedSize: encoded.length
      });
    } catch (error) {
      this.logger.error('Compression failed:', error);
      throw error;
    }
  }

  /**
   * Decompress cached values
   * @param {string} compressedValue - Compressed value from cache
   * @returns {Promise<any>} Decompressed value
   */
  async decompressValue(compressedValue) {
    try {
      const parsed = JSON.parse(compressedValue);
      
      if (!parsed.compressed) {
        return parsed.data;
      }
      
      const buffer = Buffer.from(parsed.data, 'base64');
      const decompressed = await gunzip(buffer);
      
      return JSON.parse(decompressed.toString());
    } catch (error) {
      this.logger.error('Decompression failed:', error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive data before caching
   * @param {any} data - Sensitive data to encrypt
   * @returns {string} Encrypted data
   */
  encryptSensitiveData(data) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return JSON.stringify({
        encrypted: true,
        iv: iv.toString('hex'),
        data: encrypted
      });
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt sensitive cached data
   * @param {string} encryptedData - Encrypted data from cache
   * @returns {any} Decrypted data
   */
  decryptSensitiveData(encryptedData) {
    try {
      const parsed = JSON.parse(encryptedData);
      
      if (!parsed.encrypted) {
        return parsed;
      }
      
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      
      let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      throw error;
    }
  }

  // ====== TESTING UTILITIES ======

  /**
   * Create in-memory mock cache for testing
   * @returns {Object} Mock cache service
   */
  mockCacheService() {
    const mockData = new Map();
    const mockTtls = new Map();
    
    return {
      set: async (key, value, ttl) => {
        mockData.set(key, value);
        if (ttl) {
          mockTtls.set(key, Date.now() + (ttl * 1000));
        }
        return 'OK';
      },
      
      get: async (key) => {
        const expiry = mockTtls.get(key);
        if (expiry && Date.now() > expiry) {
          mockData.delete(key);
          mockTtls.delete(key);
          return null;
        }
        return mockData.get(key) || null;
      },
      
      del: async (key) => {
        const deleted = mockData.has(key) ? 1 : 0;
        mockData.delete(key);
        mockTtls.delete(key);
        return deleted;
      },
      
      exists: async (key) => {
        return mockData.has(key) ? 1 : 0;
      },
      
      flushall: async () => {
        mockData.clear();
        mockTtls.clear();
        return 'OK';
      },
      
      keys: async (pattern) => {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return Array.from(mockData.keys()).filter(key => regex.test(key));
      }
    };
  }

  /**
   * Flush test cache data
   * @returns {Promise<void>}
   */
  async flushTestCache() {
    try {
      const testKeys = await this.redis.keys('test:*');
      if (testKeys.length > 0) {
        await this.redis.del(testKeys);
        this.logger.info(`Flushed ${testKeys.length} test cache keys`);
      }
    } catch (error) {
      this.logger.error('Test cache flush failed:', error);
      throw error;
    }
  }

  /**
   * Seed cache with test data
   * @param {Object} testData - Test data to populate
   * @returns {Promise<number>} Number of items seeded
   */
  async seedCacheForTesting(testData) {
    try {
      let seededCount = 0;
      
      for (const [key, value] of Object.entries(testData)) {
        const testKey = `test:${key}`;
        await this.redis.set(testKey, JSON.stringify(value), 'EX', 3600);
        seededCount++;
      }
      
      this.logger.info(`Seeded ${seededCount} test cache entries`);
      return seededCount;
    } catch (error) {
      this.logger.error('Test cache seeding failed:', error);
      throw error;
    }
  }

  /**
   * Validate cache consistency
   * @param {string} key - Cache key to validate
   * @param {any} expectedValue - Expected value
   * @returns {Promise<boolean>} Whether cache is consistent
   */
  async validateCacheConsistency(key, expectedValue) {
    try {
      const cachedValue = await this.redis.get(key);
      const parsed = cachedValue ? JSON.parse(cachedValue) : null;
      
      const isConsistent = JSON.stringify(parsed) === JSON.stringify(expectedValue);
      
      if (!isConsistent) {
        this.logger.warn(`Cache inconsistency detected for key '${key}'`);
      }
      
      return isConsistent;
    } catch (error) {
      this.logger.error('Cache consistency validation failed:', error);
      return false;
    }
  }

  // ====== HELPER METHODS ======

  /**
   * Record performance metric
   * @private
   */
  _recordMetric(name, value) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name);
    values.push({ value, timestamp: Date.now() });
    
    // Keep only last 1000 measurements
    if (values.length > 1000) {
      values.shift();
    }
  }

  /**
   * Get key type from cache key
   * @private
   */
  _getKeyType(key) {
    const parts = key.split(':');
    return parts[0] || 'unknown';
  }

  /**
   * Delete keys by pattern
   * @private
   */
  async _deleteByPattern(pattern) {
    let cursor = '0';
    let deletedCount = 0;
    
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');
    
    return deletedCount;
  }

  /**
   * Parse Redis memory info
   * @private
   */
  _parseMemoryInfo(memoryInfo) {
    const lines = memoryInfo.split('\n');
    const info = {};
    
    for (const line of lines) {
      const [key, value] = line.split(':');
      if (key && value) {
        info[key] = value.trim();
      }
    }
    
    return info;
  }

  /**
   * Get cache key distribution
   * @private
   */
  async _getKeyDistribution() {
    const distribution = {};
    let cursor = '0';
    
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'COUNT', 1000);
      cursor = nextCursor;
      
      for (const key of keys) {
        const type = this._getKeyType(key);
        distribution[type] = (distribution[type] || 0) + 1;
      }
    } while (cursor !== '0');
    
    return distribution;
  }

  /**
   * Generate cache optimization recommendations
   * @private
   */
  _generateRecommendations(report) {
    const recommendations = [];
    
    // Check hit ratios
    for (const [keyType, metrics] of Object.entries(report.metrics)) {
      if (parseFloat(metrics.ratio) < 70) {
        recommendations.push({
          type: 'low_hit_ratio',
          keyType,
          message: `${keyType} has low hit ratio (${metrics.ratio}%). Consider adjusting TTL or caching strategy.`
        });
      }
    }
    
    // Check memory usage
    if (report.totalMemory && report.totalMemory.used_memory_human) {
      const memoryMB = parseFloat(report.totalMemory.used_memory_human.replace('M', ''));
      if (memoryMB > 500) {
        recommendations.push({
          type: 'high_memory_usage',
          message: `High memory usage detected (${report.totalMemory.used_memory_human}). Consider implementing compression or reducing TTLs.`
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Warmup user profile data
   * @private
   */
  async _warmupUserProfile(userId) {
    // Implementation would fetch and cache user profile data
    const profileKey = `user:${userId}:profile`;
    // Mock data for example
    await this.redis.set(profileKey, JSON.stringify({ userId, warmedUp: true }), 'EX', 3600);
  }

  /**
   * Warmup user transactions
   * @private
   */
  async _warmupUserTransactions(userId) {
    // Implementation would fetch and cache recent transactions
    const transactionsKey = `user:${userId}:transactions:recent`;
    // Mock data for example
    await this.redis.set(transactionsKey, JSON.stringify([]), 'EX', 1800);
  }

  /**
   * Warmup HMRC tokens
   * @private
   */
  async _warmupHMRCTokens(userId) {
    // Implementation would fetch and cache HMRC tokens if available
    const tokensKey = `user:${userId}:hmrc:tokens`;
    // Check if tokens exist before warming up
    const exists = await this.redis.exists(tokensKey);
    if (!exists) {
      // Would typically fetch from secure storage
      this.logger.debug(`No HMRC tokens to warm up for user ${userId}`);
    }
  }

  /**
   * Warmup categorization mappings
   * @private
   */
  async _warmupCategorizationMappings() {
    // Implementation would cache common category mappings
    const mappingsKey = 'categorization:common_mappings';
    const exists = await this.redis.exists(mappingsKey);
    if (!exists) {
      // Mock common mappings
      const commonMappings = {
        'office supplies': 'office_costs',
        'fuel': 'travel',
        'software subscription': 'other_business_costs'
      };
      await this.redis.set(mappingsKey, JSON.stringify(commonMappings), 'EX', 86400);
    }
  }
}

module.exports = CacheUtils;