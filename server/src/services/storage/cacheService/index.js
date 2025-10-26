const CacheService = require('./cache.service');
const BusinessCacheService = require('./business-cache.service');
const SessionCacheService = require('./session-cache.service');
const CacheUtils = require('./utils/cache-utils');
const logger = require('../../../utils/logger.util');

/**
 * Cache Service Factory and Coordinator
 * Manages all cache services with shared Redis connection and utilities
 */
class CacheServiceFactory {
  constructor() {
    this.mainCache = null;
    this.businessCache = null;
    this.sessionCache = null;
    this.utils = null;
    this.isInitialized = false;
  }

  /**
   * Initialize all cache services with shared connection
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    try {
      // Initialize main cache service first
      this.mainCache = new CacheService(logger);
      const success = await this.mainCache.initialize();
      
      if (!success) {
        throw new Error('Failed to initialize main cache service');
      }

      // Initialize specialized cache services using main cache
      this.businessCache = new BusinessCacheService(this.mainCache, logger);
      this.sessionCache = new SessionCacheService(this.mainCache, logger);
      
      // Initialize cache utilities with direct Redis client access
      this.utils = new CacheUtils(this.mainCache.client, logger);

      // Set up cross-service integration
      this._setupCrossServiceIntegration();

      this.isInitialized = true;
      logger.info('All cache services initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('Cache service initialization failed:', error);
      return false;
    }
  }

  /**
   * Setup integration between cache services
   * @private
   */
  _setupCrossServiceIntegration() {
    // Add invalidation coordination between services
    this._setupInvalidationCoordination();
    
    // Add shared metrics collection
    this._setupSharedMetrics();
    
    // Add cross-service event handlers
    this._setupEventHandlers();
  }

  /**
   * Setup invalidation coordination between cache services
   * @private
   */
  _setupInvalidationCoordination() {
    // When user data changes, invalidate related caches across services
    this.businessCache.invalidateUserData = async (userId) => {
      const results = await Promise.allSettled([
        this.mainCache.invalidateUserCache(userId),
        this.sessionCache.invalidateAllUserSessions(userId),
        this.businessCache.invalidateBusinessData('user_data_update', { userId })
      ]);
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      logger.info(`User data invalidation: ${successCount}/${results.length} services cleared for user ${userId}`);
      
      return successCount;
    };

    // When HMRC data changes, coordinate invalidation
    this.businessCache.invalidateHMRCData = async (nino, changeType = 'general') => {
      const results = await Promise.allSettled([
        this.businessCache.invalidateHMRCCache(nino),
        this.sessionCache.invalidateHMRCTokens(nino),
        this.mainCache.invalidateSystemConfig()
      ]);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      logger.info(`HMRC data invalidation: ${successCount}/${results.length} services cleared for ${nino}`);
      
      return successCount;
    };

    // When file processing completes, coordinate cache updates
    this.businessCache.onFileProcessingComplete = async (fileId, userId, result) => {
      // Update business cache with results
      await this.businessCache.cacheProcessingResult(fileId, result);
      
      // If processing involved user transactions, invalidate user summaries
      if (result.transactionsProcessed) {
        await this.mainCache.invalidateUserCache(userId);
      }
      
      // Clear temporary processing data
      await this.businessCache.clearProcessingCache(fileId);
    };
  }

  /**
   * Setup shared metrics collection
   * @private
   */
  _setupSharedMetrics() {
    // Collect metrics from all services
    this.getAggregatedMetrics = async () => {
      const mainMetrics = this.mainCache.getHealthStatus();
      const businessStats = await this.businessCache.getBusinessCacheStats();
      const sessionStats = await this._getSessionStats();
      
      return {
        main: mainMetrics,
        business: businessStats,
        sessions: sessionStats,
        aggregated: {
          totalKeys: await this._getTotalKeyCount(),
          memoryUsage: await this._getTotalMemoryUsage(),
          healthScore: this._calculateHealthScore(mainMetrics)
        }
      };
    };
  }

  /**
   * Setup event handlers for cross-service coordination
   * @private
   */
  _setupEventHandlers() {
    // Main cache events
    this.mainCache.on('connected', () => {
      logger.info('Cache services: Redis connection established');
    });

    this.mainCache.on('disconnected', () => {
      logger.warn('Cache services: Redis connection lost');
    });

    this.mainCache.on('circuitBreakerOpen', (data) => {
      logger.error('Cache services: Circuit breaker opened', data);
      // Could trigger fallback mechanisms here
    });

    // Health monitoring coordination
    this.mainCache.on('healthCheck', (health) => {
      if (health.status === 'unhealthy') {
        logger.warn('Cache health check failed, initiating recovery procedures');
        this._initiateRecovery();
      }
    });
  }

  /**
   * Get session statistics
   * @private
   */
  async _getSessionStats() {
    try {
      const activeUsers = await this.sessionCache.getActiveUsersCount();
      return {
        activeUsers,
        // Add more session-specific metrics
      };
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Get total key count across all cache patterns
   * @private
   */
  async _getTotalKeyCount() {
    try {
      const allKeys = await this.mainCache.keys('*');
      return allKeys.length;
    } catch (error) {
      logger.error('Failed to get total key count:', error);
      return 0;
    }
  }

  /**
   * Get total memory usage
   * @private
   */
  async _getTotalMemoryUsage() {
    try {
      const memoryInfo = await this.mainCache._getMemoryInfo();
      return memoryInfo;
    } catch (error) {
      logger.error('Failed to get memory usage:', error);
      return { error: error.message };
    }
  }

  /**
   * Calculate overall health score
   * @private
   */
  _calculateHealthScore(mainMetrics) {
    if (!mainMetrics || mainMetrics.status === 'unhealthy') {
      return 0;
    }

    let score = 100;
    
    // Deduct points for high latency
    if (mainMetrics.latency > 100) {
      score -= Math.min(30, (mainMetrics.latency - 100) / 10);
    }
    
    // Deduct points for low hit ratio
    if (mainMetrics.metrics && mainMetrics.metrics.hitRatio) {
      const hitRatio = parseFloat(mainMetrics.metrics.hitRatio);
      if (hitRatio < 70) {
        score -= (70 - hitRatio);
      }
    }
    
    // Deduct points for circuit breaker issues
    if (mainMetrics.circuitBreaker !== 'CLOSED') {
      score -= 20;
    }
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Initiate recovery procedures when health issues detected
   * @private
   */
  async _initiateRecovery() {
    try {
      logger.info('Initiating cache recovery procedures...');
      
      // Try to cleanup expired data
      await this.utils.timeBasedInvalidation('*', 3600); // Remove data older than 1 hour
      
      // Reset circuit breaker if needed
      if (this.mainCache.circuitBreaker.state === 'OPEN') {
        setTimeout(() => {
          this.mainCache.circuitBreaker.state = 'HALF_OPEN';
          logger.info('Circuit breaker reset to HALF_OPEN');
        }, 30000); // 30 seconds
      }
      
    } catch (error) {
      logger.error('Cache recovery failed:', error);
    }
  }

  /**
   * Get main cache service
   * @returns {CacheService} Main cache service instance
   */
  getMainCache() {
    if (!this.isInitialized) {
      throw new Error('Cache services not initialized');
    }
    return this.mainCache;
  }

  /**
   * Get business cache service
   * @returns {BusinessCacheService} Business cache service instance
   */
  getBusinessCache() {
    if (!this.isInitialized) {
      throw new Error('Cache services not initialized');
    }
    return this.businessCache;
  }

  /**
   * Get session cache service
   * @returns {SessionCacheService} Session cache service instance
   */
  getSessionCache() {
    if (!this.isInitialized) {
      throw new Error('Cache services not initialized');
    }
    return this.sessionCache;
  }

  /**
   * Get cache utilities
   * @returns {CacheUtils} Cache utilities instance
   */
  getUtils() {
    if (!this.isInitialized) {
      throw new Error('Cache services not initialized');
    }
    return this.utils;
  }

  /**
   * Perform coordinated cache warming
   * @returns {Promise<Object>} Warming results
   */
  async warmAllCaches() {
    try {
      logger.info('Starting coordinated cache warming...');
      
      const results = {
        systemConfig: 0,
        commonData: 0,
        userSessions: 0,
        errors: []
      };

      // Warm system configuration via main cache
      try {
        await this.mainCache._warmSystemConfig();
        results.systemConfig = 1;
      } catch (error) {
        results.errors.push(`System config warming failed: ${error.message}`);
      }

      // Warm common business data
      try {
        const commonMappings = await this.businessCache._warmupCategorizationMappings();
        results.commonData = 1;
      } catch (error) {
        results.errors.push(`Common data warming failed: ${error.message}`);
      }

      logger.info('Coordinated cache warming completed:', results);
      return results;
    } catch (error) {
      logger.error('Cache warming coordination failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Graceful shutdown of all cache services
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      logger.info('Shutting down all cache services...');
      
      if (this.mainCache) {
        await this.mainCache.shutdown();
      }
      
      this.isInitialized = false;
      logger.info('All cache services shutdown complete');
    } catch (error) {
      logger.error('Cache services shutdown error:', error);
    }
  }
}

// Create singleton instance
const cacheFactory = new CacheServiceFactory();

module.exports = cacheFactory;