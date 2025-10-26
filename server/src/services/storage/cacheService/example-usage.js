/**
 * Example usage of integrated cache services
 * This demonstrates how all cache services work together
 */

const cacheFactory = require('./cacheService'); // From index.js
const logger = require('../../utils/logger.util');

class CacheExampleUsage {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize all cache services
   */
  async initialize() {
    try {
      logger.info('Initializing cache example...');
      
      // Initialize the cache factory (this sets up all services)
      this.isInitialized = await cacheFactory.initialize();
      
      if (this.isInitialized) {
        logger.info('Cache services initialized successfully');
      } else {
        throw new Error('Cache initialization failed');
      }
      
      return this.isInitialized;
    } catch (error) {
      logger.error('Cache example initialization failed:', error);
      return false;
    }
  }

  /**
   * Demonstrate main cache operations
   */
  async demonstrateMainCache() {
    const mainCache = cacheFactory.getMainCache();
    
    // Basic operations
    await mainCache.set('user:123:profile', { name: 'John Doe', email: 'john@example.com' }, 'medium');
    const profile = await mainCache.get('user:123:profile');
    console.log('Retrieved profile:', profile);
    
    // Batch operations
    const batchData = {
      'config:vat:standard': 20,
      'config:vat:reduced': 5,
      'config:vat:zero': 0
    };
    await mainCache.batchSet(batchData, 'long');
    
    const vatRates = await mainCache.batchGet(['config:vat:standard', 'config:vat:reduced']);
    console.log('VAT rates:', vatRates);
  }

  /**
   * Demonstrate business cache operations
   */
  async demonstrateBusinessCache() {
    const businessCache = cacheFactory.getBusinessCache();
    
    // AI categorization caching
    const transactionHash = 'abc123def456';
    await businessCache.cacheCategorizationResult(
      transactionHash,
      'office_costs',
      0.95,
      { source: 'ai_model_v2', keywords: ['office', 'supplies'] }
    );
    
    const categorization = await businessCache.getCategorization(transactionHash);
    console.log('Categorization result:', categorization);
    
    // HMRC response caching
    await businessCache.cacheHMRCResponse(
      'obligations',
      { nino: 'AB123456C', from: '2024-04-06', to: '2025-04-05' },
      { obligations: [{ periodKey: 'A001', due: '2024-07-31' }] }
    );
    
    // File processing
    const fileId = 'file_789';
    await businessCache.setProcessingProgress(fileId, 50, 'validation', { rows: 100 });
    await businessCache.cacheProcessingResult(fileId, {
      status: 'completed',
      rowsProcessed: 100,
      errors: 0
    });
  }

  /**
   * Demonstrate session cache operations
   */
  async demonstrateSessionCache() {
    const sessionCache = cacheFactory.getSessionCache();
    
    // Store user session
    await sessionCache.storeUserSession(
      'user123',
      'session456',
      {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        loginTime: Date.now()
      },
      'jwt.token.here'
    );
    
    // Store HMRC tokens
    await sessionCache.storeHMRCTokens('user123', {
      accessToken: 'hmrc_access_token',
      refreshToken: 'hmrc_refresh_token',
      expiresIn: 14400,
      expiresAt: Date.now() + 14400000,
      scope: 'read:self-assessment'
    });
    
    // Get session
    const session = await sessionCache.getUserSession('session456');
    console.log('User session:', session);
  }

  /**
   * Demonstrate cache utilities
   */
  async demonstrateCacheUtils() {
    const utils = cacheFactory.getUtils();
    
    // Compress large data
    const largeData = { items: new Array(1000).fill({ id: 1, name: 'item' }) };
    const compressed = await utils.compressLargeValues(largeData);
    const decompressed = await utils.decompressValue(compressed);
    
    console.log('Compression successful:', decompressed.items.length === 1000);
    
    // Tag-based invalidation
    const mainCache = cacheFactory.getMainCache();
    
    // Add some data with tags
    await mainCache.set('user:123:data1', 'value1');
    await mainCache.set('user:123:data2', 'value2');
    await mainCache.addToSet('tag:user:123', ['user:123:data1', 'user:123:data2']);
    
    // Invalidate by tag
    const invalidatedCount = await utils.tagBasedInvalidation(['user:123']);
    console.log('Invalidated keys:', invalidatedCount);
  }

  /**
   * Demonstrate coordinated cache operations
   */
  async demonstrateCoordination() {
    const businessCache = cacheFactory.getBusinessCache();
    
    // Simulate user data change - this will invalidate across all services
    const userId = 'user123';
    const invalidatedCount = await businessCache.invalidateUserData(userId);
    console.log(`Coordinated invalidation cleared ${invalidatedCount} cache entries`);
    
    // Get aggregated metrics
    const metrics = await cacheFactory.getAggregatedMetrics();
    console.log('Cache metrics:', metrics);
    
    // Perform coordinated cache warming
    const warmingResults = await cacheFactory.warmAllCaches();
    console.log('Cache warming results:', warmingResults);
  }

  /**
   * Demonstrate error handling and circuit breaker
   */
  async demonstrateErrorHandling() {
    const mainCache = cacheFactory.getMainCache();
    
    try {
      // This would trigger circuit breaker if Redis is down
      await mainCache.get('test:key');
      console.log('Cache operation successful');
    } catch (error) {
      console.log('Cache operation failed:', error.message);
      
      // Check health status
      const health = mainCache.getHealthStatus();
      console.log('Cache health:', health);
    }
  }

  /**
   * Run all demonstrations
   */
  async runAllDemonstrations() {
    if (!this.isInitialized) {
      console.error('Cache services not initialized');
      return;
    }

    try {
      console.log('\n=== Main Cache Operations ===');
      await this.demonstrateMainCache();
      
      console.log('\n=== Business Cache Operations ===');
      await this.demonstrateBusinessCache();
      
      console.log('\n=== Session Cache Operations ===');
      await this.demonstrateSessionCache();
      
      console.log('\n=== Cache Utilities ===');
      await this.demonstrateCacheUtils();
      
      console.log('\n=== Coordinated Operations ===');
      await this.demonstrateCoordination();
      
      console.log('\n=== Error Handling ===');
      await this.demonstrateErrorHandling();
      
      console.log('\n=== All demonstrations completed ===');
    } catch (error) {
      console.error('Demonstration failed:', error);
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    if (this.isInitialized) {
      await cacheFactory.shutdown();
      console.log('Cache services shutdown complete');
    }
  }
}

module.exports = CacheExampleUsage;

// Example of how to use it:
if (require.main === module) {
  const example = new CacheExampleUsage();
  
  example.initialize()
    .then(() => example.runAllDemonstrations())
    .then(() => example.shutdown())
    .catch(console.error);
}