const cacheFactory = require('./storage/cacheService');

/**
 * Cache Service Wrapper for Backward Compatibility
 * Provides a simple interface to the integrated cache services
 */
class CacheServiceWrapper {
  constructor() {
    this.factory = cacheFactory;
    this.isInitialized = false;
  }

  /**
   * Initialize cache services
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    this.isInitialized = await this.factory.initialize();
    return this.isInitialized;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value
   */
  async get(key) {
    this._ensureInitialized();
    return await this.factory.getMainCache().get(key);
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number|string} ttl - Time to live
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl) {
    this._ensureInitialized();
    return await this.factory.getMainCache().set(key, value, ttl);
  }

  /**
   * Delete key from cache
   * @param {string|string[]} keys - Key(s) to delete
   * @returns {Promise<number>} Number of keys deleted
   */
  async delete(keys) {
    this._ensureInitialized();
    return await this.factory.getMainCache().delete(keys);
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Existence status
   */
  async exists(key) {
    this._ensureInitialized();
    return await this.factory.getMainCache().exists(key);
  }

  /**
   * Set expiry on key
   * @param {string} key - Cache key
   * @param {number} seconds - Seconds until expiry
   * @returns {Promise<boolean>} Success status
   */
  async expire(key, seconds) {
    this._ensureInitialized();
    return await this.factory.getMainCache().expire(key, seconds);
  }

  /**
   * Cache file processing result
   * @param {string} fileId - File identifier
   * @param {Object} result - Processing result
   * @param {number} ttl - Time to live
   * @returns {Promise<boolean>} Success status
   */
  async cacheFileProcessingResult(fileId, result, ttl) {
    this._ensureInitialized();
    return await this.factory.getBusinessCache().cacheProcessingResult(fileId, result, ttl);
  }

  /**
   * Get file processing status
   * @param {string} fileId - File identifier
   * @returns {Promise<Object|null>} Processing status
   */
  async getFileProcessingStatus(fileId) {
    this._ensureInitialized();
    return await this.factory.getBusinessCache().getProcessingStatus(fileId);
  }

  /**
   * Set file processing progress
   * @param {string} fileId - File identifier
   * @param {number} percentage - Progress percentage
   * @param {string} stage - Current stage
   * @param {Object} details - Additional details
   * @returns {Promise<boolean>} Success status
   */
  async setFileProcessingProgress(fileId, percentage, stage, details) {
    this._ensureInitialized();
    return await this.factory.getBusinessCache().setProcessingProgress(fileId, percentage, stage, details);
  }

  /**
   * Cache file metadata
   * @param {string} fileId - File identifier
   * @param {Object} metadata - File metadata
   * @returns {Promise<boolean>} Success status
   */
  async cacheFileMetadata(fileId, metadata) {
    this._ensureInitialized();
    return await this.factory.getBusinessCache().cacheFileMetadata(fileId, metadata);
  }

  /**
   * Cache validation results
   * @param {string} fileId - File identifier
   * @param {Array} errors - Validation errors
   * @returns {Promise<boolean>} Success status
   */
  async cacheValidationResults(fileId, errors) {
    this._ensureInitialized();
    return await this.factory.getBusinessCache().cacheValidationResults(fileId, errors);
  }

  /**
   * Clear processing cache for file
   * @param {string} fileId - File identifier
   * @returns {Promise<number>} Number of keys cleared
   */
  async clearFileProcessingCache(fileId) {
    this._ensureInitialized();
    return await this.factory.getBusinessCache().clearProcessingCache(fileId);
  }

  /**
   * Invalidate user cache
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidateUserCache(userId) {
    this._ensureInitialized();
    return await this.factory.getBusinessCache().invalidateUserData(userId);
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    this._ensureInitialized();
    return await this.factory.getAggregatedMetrics();
  }

  /**
   * Get health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    this._ensureInitialized();
    return this.factory.getMainCache().getHealthStatus();
  }

  /**
   * Access to specialized cache services
   */
  get business() {
    this._ensureInitialized();
    return this.factory.getBusinessCache();
  }

  get session() {
    this._ensureInitialized();
    return this.factory.getSessionCache();
  }

  get utils() {
    this._ensureInitialized();
    return this.factory.getUtils();
  }

  get main() {
    this._ensureInitialized();
    return this.factory.getMainCache();
  }

  /**
   * Ensure cache services are initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('Cache service not initialized. Call initialize() first.');
    }
  }

  /**
   * Graceful shutdown
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.isInitialized) {
      await this.factory.shutdown();
      this.isInitialized = false;
    }
  }
}

module.exports = new CacheServiceWrapper();