const crypto = require('crypto');

/**
 * Business Cache Service for MTD Tax Bridge Application
 * Handles caching of AI-powered business categorization,
 * HMRC API responses, spreadsheet processing, and bulk operations
 * 
 * Focused on bridging spreadsheets to HMRC categories via AI for
 * sole traders and landlords
 */
class BusinessCacheService {
  constructor(cacheService, logger) {
    this.cache = cacheService;
    this.logger = logger;
    
    // Cache TTL configurations (in seconds)
    this.ttl = {
      aiCategorization: 7 * 24 * 3600,      // 7 days
      hmrcCategories: 30 * 24 * 3600,       // 30 days
      hmrcResponse: 15 * 60,                // 15 minutes
      hmrcBusinessIds: 24 * 3600,           // 24 hours
      hmrcObligations: 6 * 3600,            // 6 hours
      hmrcRateLimit: 3600,                  // 1 hour
      spreadsheetProcessing: 2 * 3600,      // 2 hours
      fileMetadata: 24 * 3600,              // 24 hours
      validationResults: 6 * 3600,          // 6 hours
      processingProgress: 30 * 60           // 30 minutes
    };
    
    // Cache key prefixes
    this.prefixes = {
      aiCategorization: 'ai:categorization',
      aiModelResults: 'ai:model:results',
      hmrcCategories: 'hmrc:categories',
      hmrcResponse: 'hmrc:response',
      hmrcBusiness: 'hmrc:business',
      hmrcObligations: 'hmrc:obligations',
      hmrcRateLimit: 'hmrc:ratelimit',
      spreadsheetProcessing: 'spreadsheet:processing',
      fileMetadata: 'file:metadata',
      validation: 'file:validation',
      progress: 'file:progress'
    };
  }

  // ====== AI CATEGORIZATION CACHING FOR SOLE TRADERS & LANDLORDS ======

  /**
   * Cache AI categorization result for spreadsheet transaction
   * @param {string} transactionHash - Hash of transaction data
   * @param {string} hmrcCategory - HMRC category code (e.g., 'office_costs', 'travel')
   * @param {number} confidence - AI confidence score (0-1)
   * @param {Object} metadata - AI model metadata and context
   * @returns {Promise<boolean>} Success status
   */
  async cacheAICategorizationResult(transactionHash, hmrcCategory, confidence, metadata = {}) {
    try {
      const key = `${this.prefixes.aiCategorization}:${transactionHash}`;
      const value = {
        transactionHash,
        hmrcCategory,
        confidence,
        metadata: {
          ...metadata,
          modelVersion: metadata.modelVersion || 'v1.0',
          businessType: metadata.businessType || 'sole_trader', // sole_trader or landlord
          analysisDate: Date.now(),
          features: metadata.features || [] // Features used by AI model
        },
        timestamp: Date.now()
      };

      // Tag for HMRC category-based invalidation
      await this._addToTag(`hmrc:category:${hmrcCategory}`, key);
      
      const success = await this.cache.set(key, value, this.ttl.aiCategorization);
      
      this.logger.debug(`Cached AI categorization: ${transactionHash} -> ${hmrcCategory} (${confidence})`);
      return success;
    } catch (error) {
      this.logger.error('Failed to cache AI categorization result:', error);
      return false;
    }
  }

  /**
   * Retrieve cached AI categorization result
   * @param {string} transactionHash - Hash of transaction data
   * @returns {Promise<Object|null>} Categorization result or null
   */
  async getAICategorizationResult(transactionHash) {
    try {
      const key = `${this.prefixes.aiCategorization}:${transactionHash}`;
      const result = await this.cache.get(key);
      
      if (result) {
        this.logger.debug(`Cache hit for AI categorization: ${transactionHash}`);
        return result;
      }
      
      this.logger.debug(`Cache miss for AI categorization: ${transactionHash}`);
      return null;
    } catch (error) {
      this.logger.error('Failed to get AI categorization result:', error);
      return null;
    }
  }

  /**
   * Cache AI model batch results for spreadsheet processing
   * @param {Array} batchResults - Array of categorization results
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @returns {Promise<Object>} Success/failure counts
   */
  async cacheAIBatchResults(batchResults, businessType = 'sole_trader') {
    try {
      let successCount = 0;
      let failureCount = 0;

      const operations = batchResults.map(async (result) => {
        try {
          const success = await this.cacheAICategorizationResult(
            result.transactionHash,
            result.hmrcCategory,
            result.confidence,
            { ...result.metadata, businessType }
          );
          if (success) successCount++;
          else failureCount++;
        } catch (error) {
          failureCount++;
          this.logger.error(`Failed to cache AI result for ${result.transactionHash}:`, error);
        }
      });

      await Promise.all(operations);

      this.logger.info(`AI batch caching (${businessType}): ${successCount} success, ${failureCount} failures`);
      return { successCount, failureCount, total: batchResults.length };
    } catch (error) {
      this.logger.error('AI batch caching failed:', error);
      return { successCount: 0, failureCount: batchResults.length, total: batchResults.length };
    }
  }

  /**
   * Cache HMRC category definitions for sole traders and landlords
   * @param {Object} categories - HMRC category definitions
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @returns {Promise<boolean>} Success status
   */
  async cacheHMRCCategories(categories, businessType) {
    try {
      const key = `${this.prefixes.hmrcCategories}:${businessType}`;
      const value = {
        categories,
        businessType,
        lastUpdated: Date.now(),
        version: this._generateVersion()
      };

      const success = await this.cache.set(key, value, this.ttl.hmrcCategories);
      
      this.logger.debug(`Cached HMRC categories for ${businessType}: ${Object.keys(categories).length} categories`);
      return success;
    } catch (error) {
      this.logger.error('Failed to cache HMRC categories:', error);
      return false;
    }
  }

  /**
   * Get cached HMRC categories for business type
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @returns {Promise<Object|null>} Categories or null
   */
  async getHMRCCategories(businessType) {
    try {
      const key = `${this.prefixes.hmrcCategories}:${businessType}`;
      const cached = await this.cache.get(key);
      
      return cached ? cached.categories : null;
    } catch (error) {
      this.logger.error('Failed to get HMRC categories:', error);
      return null;
    }
  }

  /**
   * Update categorization confidence score
   * @param {string} transactionHash - Transaction hash
   * @param {number} newConfidence - Updated confidence score
   * @returns {Promise<boolean>} Success status
   */
  async updateCategoryConfidence(transactionHash, newConfidence) {
    try {
      const key = `${this.prefixes.aiCategorization}:${transactionHash}`;
      const existing = await this.cache.get(key);
      
      if (existing) {
        existing.confidence = newConfidence;
        existing.metadata.updatedAt = Date.now();
        
        const success = await this.cache.set(key, existing, this.ttl.aiCategorization);
        this.logger.debug(`Updated AI confidence for ${transactionHash}: ${newConfidence}`);
        return success;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Failed to update category confidence:', error);
      return false;
    }
  }

  /**
   * Get AI categorization statistics for business type
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @returns {Promise<Object>} Categorization statistics
   */
  async getAICategorizationStats(businessType) {
    try {
      const pattern = `${this.prefixes.aiCategorization}:*`;
      const keys = await this.cache.keys(pattern);
      
      const stats = {
        totalCategorizations: 0,
        businessTypeBreakdown: { sole_trader: 0, landlord: 0 },
        categoryBreakdown: {},
        averageConfidence: 0,
        lastUpdated: Date.now()
      };

      let totalConfidence = 0;
      let validResults = 0;

      for (const key of keys) {
        const result = await this.cache.get(key);
        if (result && result.metadata) {
          stats.totalCategorizations++;
          
          const resultBusinessType = result.metadata.businessType || 'sole_trader';
          stats.businessTypeBreakdown[resultBusinessType]++;
          
          if (!businessType || resultBusinessType === businessType) {
            const category = result.hmrcCategory;
            stats.categoryBreakdown[category] = (stats.categoryBreakdown[category] || 0) + 1;
            
            totalConfidence += result.confidence;
            validResults++;
          }
        }
      }

      if (validResults > 0) {
        stats.averageConfidence = (totalConfidence / validResults).toFixed(3);
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get AI categorization stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Invalidate AI categorization cache for business type
   * @param {string} businessType - 'sole_trader' or 'landlord' (optional)
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidateAICategorizationCache(businessType = null) {
    try {
      if (businessType) {
        // Invalidate only for specific business type
        const pattern = `${this.prefixes.aiCategorization}:*`;
        const keys = await this.cache.keys(pattern);
        
        let invalidated = 0;
        for (const key of keys) {
          const result = await this.cache.get(key);
          if (result && result.metadata && result.metadata.businessType === businessType) {
            await this.cache.delete(key);
            invalidated++;
          }
        }
        
        this.logger.info(`Invalidated ${invalidated} AI categorization entries for ${businessType}`);
        return invalidated;
      } else {
        // Invalidate all AI categorization cache
        const pattern = `${this.prefixes.aiCategorization}:*`;
        const count = await this.cache.flushPattern(pattern);
        
        this.logger.info(`Invalidated ${count} AI categorization entries`);
        return count;
      }
    } catch (error) {
      this.logger.error('Failed to invalidate AI categorization cache:', error);
      return 0;
    }
  }

  // ====== HMRC API RESPONSE CACHING ======

  /**
   * Cache HMRC API response
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @param {Object} response - API response
   * @param {number} customTtl - Custom TTL (optional)
   * @returns {Promise<boolean>} Success status
   */
  async cacheHMRCResponse(endpoint, params, response, customTtl = null) {
    try {
      const paramsHash = this._hashObject(params);
      const key = `${this.prefixes.hmrcResponse}:${endpoint}:${paramsHash}`;
      
      const value = {
        endpoint,
        params,
        response,
        timestamp: Date.now(),
        ttl: customTtl || this.ttl.hmrcResponse
      };

      // Tag for endpoint-based invalidation
      await this._addToTag(`hmrc:endpoint:${endpoint}`, key);
      
      const success = await this.cache.set(key, value, customTtl || this.ttl.hmrcResponse);
      
      this.logger.debug(`Cached HMRC response for ${endpoint}`);
      return success;
    } catch (error) {
      this.logger.error('Failed to cache HMRC response:', error);
      return false;
    }
  }

  /**
   * Retrieve cached HMRC response
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @returns {Promise<Object|null>} Cached response or null
   */
  async getHMRCResponse(endpoint, params) {
    try {
      const paramsHash = this._hashObject(params);
      const key = `${this.prefixes.hmrcResponse}:${endpoint}:${paramsHash}`;
      
      const result = await this.cache.get(key);
      
      if (result) {
        this.logger.debug(`Cache hit for HMRC ${endpoint}`);
        return result.response;
      }
      
      this.logger.debug(`Cache miss for HMRC ${endpoint}`);
      return null;
    } catch (error) {
      this.logger.error('Failed to get HMRC response:', error);
      return null;
    }
  }

  /**
   * Cache user's HMRC business IDs
   * @param {string} nino - National Insurance Number
   * @param {Array} businessIds - Array of business IDs
   * @returns {Promise<boolean>} Success status
   */
  async cacheBusinessIds(nino, businessIds) {
    try {
      const key = `${this.prefixes.hmrcBusiness}:${nino}:ids`;
      const value = {
        nino,
        businessIds,
        timestamp: Date.now()
      };

      // Tag for user-based invalidation
      await this._addToTag(`hmrc:user:${nino}`, key);
      
      const success = await this.cache.set(key, value, this.ttl.hmrcBusinessIds);
      
      this.logger.debug(`Cached ${businessIds.length} business IDs for ${nino}`);
      return success;
    } catch (error) {
      this.logger.error('Failed to cache business IDs:', error);
      return false;
    }
  }

  /**
   * Cache HMRC obligations
   * @param {string} nino - National Insurance Number
   * @param {Array} obligations - Tax obligations
   * @returns {Promise<boolean>} Success status
   */
  async cacheObligations(nino, obligations) {
    try {
      const key = `${this.prefixes.hmrcObligations}:${nino}`;
      const value = {
        nino,
        obligations,
        timestamp: Date.now(),
        count: obligations.length
      };

      // Tag for user-based invalidation
      await this._addToTag(`hmrc:user:${nino}`, key);
      
      const success = await this.cache.set(key, value, this.ttl.hmrcObligations);
      
      this.logger.debug(`Cached ${obligations.length} obligations for ${nino}`);
      return success;
    } catch (error) {
      this.logger.error('Failed to cache obligations:', error);
      return false;
    }
  }

  /**
   * Cache HMRC rate limit information
   * @param {string} endpoint - API endpoint
   * @param {Object} limits - Rate limit information
   * @returns {Promise<boolean>} Success status
   */
  async cacheRateLimit(endpoint, limits) {
    try {
      const key = `${this.prefixes.hmrcRateLimit}:${endpoint}`;
      const value = {
        endpoint,
        ...limits,
        timestamp: Date.now()
      };

      const success = await this.cache.set(key, value, this.ttl.hmrcRateLimit);
      
      this.logger.debug(`Cached rate limit for ${endpoint}: ${limits.remaining}/${limits.limit}`);
      return success;
    } catch (error) {
      this.logger.error('Failed to cache rate limit:', error);
      return false;
    }
  }

  /**
   * Get current rate limit status
   * @param {string} endpoint - API endpoint
   * @returns {Promise<Object|null>} Rate limit info or null
   */
  async getRateLimit(endpoint) {
    try {
      const key = `${this.prefixes.hmrcRateLimit}:${endpoint}`;
      return await this.cache.get(key);
    } catch (error) {
      this.logger.error('Failed to get rate limit:', error);
      return null;
    }
  }

  /**
   * Invalidate all HMRC cache for user
   * @param {string} nino - National Insurance Number
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidateHMRCCache(nino) {
    try {
      const tags = [`hmrc:user:${nino}`];
      return await this.cache.tagBasedInvalidation(tags);
    } catch (error) {
      this.logger.error('Failed to invalidate HMRC cache:', error);
      return 0;
    }
  }

  // ====== SPREADSHEET PROCESSING CACHE ======

  /**
   * Cache spreadsheet processing result
   * @param {string} fileId - File identifier
   * @param {Object} result - Processing result
   * @param {number} customTtl - Custom TTL (optional)
   * @returns {Promise<boolean>} Success status
   */
  async cacheSpreadsheetProcessingResult(fileId, result, customTtl = null) {
    try {
      const key = `${this.prefixes.spreadsheetProcessing}:${fileId}:result`;
      const value = {
        fileId,
        result: {
          ...result,
          processedAt: Date.now(),
          businessType: result.businessType || 'sole_trader',
          totalTransactions: result.totalTransactions || 0,
          categorizedTransactions: result.categorizedTransactions || 0,
          averageConfidence: result.averageConfidence || 0
        },
        timestamp: Date.now(),
        status: result.status || 'completed'
      };

      // Tag for file-based invalidation
      await this._addToTag(`spreadsheet:${fileId}`, key);
      
      const success = await this.cache.set(key, value, customTtl || this.ttl.spreadsheetProcessing);
      
      this.logger.debug(`Cached spreadsheet processing result for file ${fileId}`);
      return success;
    } catch (error) {
      this.logger.error('Failed to cache spreadsheet processing result:', error);
      return false;
    }
  }

  /**
   * Get spreadsheet processing status and results
   * @param {string} fileId - File identifier
   * @returns {Promise<Object|null>} Processing status or null
   */
  async getSpreadsheetProcessingStatus(fileId) {
    try {
      const resultKey = `${this.prefixes.spreadsheetProcessing}:${fileId}:result`;
      const progressKey = `${this.prefixes.progress}:${fileId}`;
      
      const [result, progress] = await Promise.all([
        this.cache.get(resultKey),
        this.cache.get(progressKey)
      ]);

      return {
        result,
        progress,
        fileId
      };
    } catch (error) {
      this.logger.error('Failed to get spreadsheet processing status:', error);
      return null;
    }
  }

  /**
   * Cache file metadata
   * @param {string} fileId - File identifier
   * @param {Object} metadata - File metadata
   * @returns {Promise<boolean>} Success status
   */
  async cacheFileMetadata(fileId, metadata) {
    try {
      const key = `${this.prefixes.fileMetadata}:${fileId}`;
      const value = {
        fileId,
        ...metadata,
        timestamp: Date.now()
      };

      // Tag for file-based invalidation
      await this._addToTag(`file:${fileId}`, key);
      
      const success = await this.cache.set(key, value, this.ttl.fileMetadata);
      
      this.logger.debug(`Cached metadata for file ${fileId}`);
      return success;
    } catch (error) {
      this.logger.error('Failed to cache file metadata:', error);
      return false;
    }
  }

  /**
   * Cache validation results
   * @param {string} fileId - File identifier
   * @param {Array} errors - Validation errors/warnings
   * @returns {Promise<boolean>} Success status
   */
  async cacheValidationResults(fileId, errors) {
    try {
      const key = `${this.prefixes.validation}:${fileId}`;
      const value = {
        fileId,
        errors,
        errorCount: errors.length,
        timestamp: Date.now()
      };

      // Tag for file-based invalidation
      await this._addToTag(`file:${fileId}`, key);
      
      const success = await this.cache.set(key, value, this.ttl.validationResults);
      
      this.logger.debug(`Cached ${errors.length} validation results for file ${fileId}`);
      return success;
    } catch (error) {
      this.logger.error('Failed to cache validation results:', error);
      return false;
    }
  }

  /**
   * Set spreadsheet processing progress
   * @param {string} fileId - File identifier
   * @param {number} percentage - Progress percentage (0-100)
   * @param {string} stage - Current processing stage
   * @param {Object} details - Additional progress details
   * @returns {Promise<boolean>} Success status
   */
  async setSpreadsheetProcessingProgress(fileId, percentage, stage, details = {}) {
    try {
      const key = `${this.prefixes.progress}:${fileId}`;
      const value = {
        fileId,
        percentage: Math.min(100, Math.max(0, percentage)),
        stage,
        details: {
          ...details,
          rowsProcessed: details.rowsProcessed || 0,
          transactionsCategorized: details.transactionsCategorized || 0,
          currentRow: details.currentRow || 0,
          businessType: details.businessType || 'sole_trader'
        },
        timestamp: Date.now(),
        isComplete: percentage >= 100
      };

      const success = await this.cache.set(key, value, this.ttl.processingProgress);
      
      this.logger.debug(`Set spreadsheet processing progress for file ${fileId}: ${percentage}% (${stage})`);
      return success;
    } catch (error) {
      this.logger.error('Failed to set spreadsheet processing progress:', error);
      return false;
    }
  }

  /**
   * Clear all spreadsheet processing cache for file
   * @param {string} fileId - File identifier
   * @returns {Promise<number>} Number of keys cleared
   */
  async clearSpreadsheetProcessingCache(fileId) {
    try {
      const tags = [`spreadsheet:${fileId}`];
      const cleared = await this.cache.tagBasedInvalidation(tags);
      
      this.logger.debug(`Cleared ${cleared} spreadsheet cache entries for file ${fileId}`);
      return cleared;
    } catch (error) {
      this.logger.error('Failed to clear spreadsheet processing cache:', error);
      return 0;
    }
  }

  // ====== BULK OPERATIONS ======

  /**
   * Bulk cache AI categorization results for spreadsheet processing
   * @param {Array} categorizationResults - Array of AI categorization results
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @returns {Promise<Object>} Success/failure counts
   */
  async bulkCacheAICategorizationResults(categorizationResults, businessType = 'sole_trader') {
    try {
      let successCount = 0;
      let failureCount = 0;

      const operations = categorizationResults.map(async (result) => {
        try {
          const success = await this.cacheAICategorizationResult(
            result.transactionHash,
            result.hmrcCategory,
            result.confidence,
            { ...result.metadata, businessType }
          );
          if (success) successCount++;
          else failureCount++;
        } catch (error) {
          failureCount++;
          this.logger.error(`Failed to cache AI categorization for ${result.transactionHash}:`, error);
        }
      });

      await Promise.all(operations);

      this.logger.info(`Bulk AI categorization caching (${businessType}): ${successCount} success, ${failureCount} failures`);
      return { successCount, failureCount, total: categorizationResults.length };
    } catch (error) {
      this.logger.error('Bulk AI categorization caching failed:', error);
      return { successCount: 0, failureCount: categorizationResults.length, total: categorizationResults.length };
    }
  }

  /**
   * Bulk cache spreadsheet processing results
   * @param {Array} fileResults - Array of spreadsheet processing results
   * @returns {Promise<Object>} Success/failure counts
   */
  async bulkCacheSpreadsheetResults(fileResults) {
    try {
      let successCount = 0;
      let failureCount = 0;

      const operations = fileResults.map(async (result) => {
        try {
          const success = await this.cacheSpreadsheetProcessingResult(
            result.fileId,
            result.result,
            result.ttl
          );
          if (success) successCount++;
          else failureCount++;
        } catch (error) {
          failureCount++;
          this.logger.error(`Failed to cache spreadsheet result for ${result.fileId}:`, error);
        }
      });

      await Promise.all(operations);

      this.logger.info(`Bulk spreadsheet caching: ${successCount} success, ${failureCount} failures`);
      return { successCount, failureCount, total: fileResults.length };
    } catch (error) {
      this.logger.error('Bulk spreadsheet caching failed:', error);
      return { successCount: 0, failureCount: fileResults.length, total: fileResults.length };
    }
  }

  /**
   * Bulk update spreadsheet processing progress
   * @param {Array} progressUpdates - Array of progress updates
   * @returns {Promise<Object>} Success/failure counts
   */
  async bulkUpdateSpreadsheetProgress(progressUpdates) {
    try {
      let successCount = 0;
      let failureCount = 0;

      const operations = progressUpdates.map(async (update) => {
        try {
          const success = await this.setSpreadsheetProcessingProgress(
            update.fileId,
            update.percentage,
            update.stage,
            update.details
          );
          if (success) successCount++;
          else failureCount++;
        } catch (error) {
          failureCount++;
          this.logger.error(`Failed to update spreadsheet progress for ${update.fileId}:`, error);
        }
      });

      await Promise.all(operations);

      this.logger.info(`Bulk spreadsheet progress update: ${successCount} success, ${failureCount} failures`);
      return { successCount, failureCount, total: progressUpdates.length };
    } catch (error) {
      this.logger.error('Bulk spreadsheet progress update failed:', error);
      return { successCount: 0, failureCount: progressUpdates.length, total: progressUpdates.length };
    }
  }

  // ====== CACHE INVALIDATION STRATEGIES ======

  /**
   * Invalidate cache based on business data changes
   * @param {string} changeType - Type of change (ai_model_update, spreadsheet_reprocessing, etc.)
   * @param {Object} changeContext - Context of the change
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidateBusinessData(changeType, changeContext) {
    try {
      let invalidatedCount = 0;

      switch (changeType) {
        case 'ai_model_update':
          // Invalidate all AI categorization caches when model is updated
          const aiPattern = `${this.prefixes.aiCategorization}:*`;
          invalidatedCount += await this.cache.flushPattern(aiPattern);
          
          // Also invalidate related HMRC categories
          const hmrcPattern = `${this.prefixes.hmrcCategories}:*`;
          invalidatedCount += await this.cache.flushPattern(hmrcPattern);
          break;

        case 'hmrc_categories_update':
          // Invalidate HMRC category caches for specific business type
          if (changeContext.businessType) {
            const categoryKey = `${this.prefixes.hmrcCategories}:${changeContext.businessType}`;
            invalidatedCount += await this.cache.delete(categoryKey) ? 1 : 0;
          } else {
            // Invalidate all HMRC categories
            const pattern = `${this.prefixes.hmrcCategories}:*`;
            invalidatedCount += await this.cache.flushPattern(pattern);
          }
          break;

        case 'spreadsheet_reprocessing':
          // Clear all spreadsheet-related caches
          if (changeContext.fileId) {
            invalidatedCount += await this.clearSpreadsheetProcessingCache(changeContext.fileId);
          }
          break;

        case 'hmrc_data_update':
          // Invalidate HMRC caches for specific user
          if (changeContext.nino) {
            invalidatedCount += await this.invalidateHMRCCache(changeContext.nino);
          }
          break;

        case 'business_type_change':
          // Invalidate AI categorizations for specific business type
          if (changeContext.businessType) {
            invalidatedCount += await this.invalidateAICategorizationCache(changeContext.businessType);
          }
          break;

        case 'hmrc_rate_limit_reset':
          // Clear rate limit caches
          const rateLimitPattern = `${this.prefixes.hmrcRateLimit}:*`;
          invalidatedCount += await this.cache.flushPattern(rateLimitPattern);
          break;

        default:
          this.logger.warn(`Unknown change type for invalidation: ${changeType}`);
      }

      this.logger.info(`Invalidated ${invalidatedCount} cache entries for ${changeType}`);
      return invalidatedCount;
    } catch (error) {
      this.logger.error('Business data invalidation failed:', error);
      return 0;
    }
  }

  // ====== HELPER METHODS ======

  /**
   * Normalize transaction description for consistent mapping
   * @private
   */
  _normalizeDescription(description) {
    return description
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /**
   * Calculate mapping confidence based on frequency
   * @private
   */
  _calculateMappingConfidence(frequency) {
    // Simple confidence calculation based on frequency
    return Math.min(0.95, 0.5 + (frequency * 0.1));
  }

  /**
   * Hash a string for consistent key generation
   * @private
   */
  _hashString(str) {
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * Hash an object for consistent key generation
   * @private
   */
  _hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return this._hashString(str);
  }

  /**
   * Add key to tag for invalidation
   * @private
   */
  async _addToTag(tag, key) {
    try {
      const tagKey = `tag:${tag}`;
      await this.cache.addToSet(tagKey, key);
      // Set TTL on tag itself
      await this.cache.expire(tagKey, Math.max(...Object.values(this.ttl)));
    } catch (error) {
      this.logger.error(`Failed to add key to tag ${tag}:`, error);
    }
  }

  /**
   * Get cache statistics for business operations
   * @returns {Promise<Object>} Cache statistics
   */
  async getBusinessCacheStats() {
    try {
      const stats = {
        categorization: await this._getPatternStats(this.prefixes.categorization),
        categoryMapping: await this._getPatternStats(this.prefixes.categoryMapping),
        hmrcResponses: await this._getPatternStats(this.prefixes.hmrcResponse),
        fileProcessing: await this._getPatternStats(this.prefixes.fileProcessing),
        total: 0
      };

      stats.total = Object.values(stats).reduce((sum, stat) => 
        sum + (typeof stat === 'object' ? stat.count : 0), 0
      );

      return stats;
    } catch (error) {
      this.logger.error('Failed to get business cache stats:', error);
      return {};
    }
  }

  /**
   * Get statistics for a key pattern
   * @private
   */
  async _getPatternStats(pattern) {
    try {
      const keys = await this.cache.keys(`${pattern}:*`);
      return {
        count: keys.length,
        pattern,
        sampleKeys: keys.slice(0, 5)
      };
    } catch (error) {
      return { count: 0, pattern, error: error.message };
    }
  }

  /**
   * Warmup categorization mappings
   * @private
   */
  async _warmupCategorizationMappings() {
    try {
      const mappingsKey = 'categorization:common_mappings';
      const exists = await this.cache.exists(mappingsKey);
      
      if (!exists) {
        // Common categorization mappings for UK businesses
        const commonMappings = {
          'office supplies': 'office_costs',
          'stationery': 'office_costs',
          'printer paper': 'office_costs',
          'fuel': 'travel',
          'petrol': 'travel',
          'diesel': 'travel',
          'parking': 'travel',
          'software subscription': 'other_business_costs',
          'microsoft office': 'other_business_costs',
          'adobe creative': 'other_business_costs',
          'internet': 'office_costs',
          'phone bill': 'office_costs',
          'electricity': 'office_costs',
          'gas bill': 'office_costs',
          'rent': 'premises_costs',
          'office rent': 'premises_costs',
          'insurance': 'other_business_costs',
          'professional indemnity': 'other_business_costs',
          'accounting fees': 'other_business_costs',
          'legal fees': 'other_business_costs',
          'marketing': 'advertising',
          'google ads': 'advertising',
          'facebook ads': 'advertising',
          'business cards': 'advertising',
          'website hosting': 'other_business_costs',
          'domain name': 'other_business_costs'
        };

        // Cache each mapping individually
        for (const [description, category] of Object.entries(commonMappings)) {
          await this.cacheCategoryMapping(description, category, 5); // High frequency for common mappings
        }

        this.logger.info(`Warmed up ${Object.keys(commonMappings).length} common categorization mappings`);
        return Object.keys(commonMappings).length;
      }
      
      return 0;
    } catch (error) {
      this.logger.error('Failed to warmup categorization mappings:', error);
      return 0;
    }
  }
}

module.exports = BusinessCacheService;