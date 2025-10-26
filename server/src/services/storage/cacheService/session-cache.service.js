const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Session Cache Service for MTD Tax Bridge Application
 * Handles user authentication sessions, HMRC OAuth tokens, and security features
 */
class SessionCacheService {
  constructor(cacheService, logger) {
    this.cache = cacheService;
    this.logger = logger;
    
    // Session and token TTL configurations (in seconds)
    this.ttl = {
      userSession: 24 * 3600,          // 24 hours
      jwtSession: 8 * 3600,            // 8 hours
      hmrcAccessToken: 4 * 3600,       // 4 hours (HMRC standard)
      hmrcRefreshToken: 18 * 30 * 24 * 3600, // 18 months
      activeUser: 30 * 60,             // 30 minutes
      auditLog: 30 * 24 * 3600,        // 30 days
      sessionCleanup: 7 * 24 * 3600     // 7 days for cleanup tracking
    };
    
    // Cache key prefixes
    this.prefixes = {
      userSession: 'session:user',
      jwtSession: 'session:jwt',
      hmrcTokens: 'hmrc:tokens',
      activeUsers: 'active:users',
      sessionLimit: 'session:limit',
      auditLog: 'audit:auth',
      expiredSessions: 'expired:sessions',
      tokenRefresh: 'token:refresh'
    };
    
    // Security configuration
    this.security = {
      encryptionKey: process.env.SESSION_ENCRYPTION_KEY || crypto.randomBytes(32),
      maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 5,
      tokenRefreshBuffer: 300, // 5 minutes before expiry
      auditRetention: 30 * 24 * 3600 // 30 days
    };
  }

  // ====== JWT SESSION MANAGEMENT ======

  /**
   * Store user session with JWT
   * @param {string} userId - User identifier
   * @param {string} sessionId - Session identifier
   * @param {Object} sessionData - Session data
   * @param {string} jwtToken - JWT token
   * @returns {Promise<boolean>} Success status
   */
  async storeUserSession(userId, sessionId, sessionData, jwtToken) {
    try {
      // Check concurrent session limit
      const currentSessions = await this._getCurrentSessionCount(userId);
      if (currentSessions >= this.security.maxConcurrentSessions) {
        await this._evictOldestSession(userId);
      }

      // Encrypt sensitive session data
      const encryptedData = this._encryptSensitiveData({
        ...sessionData,
        userId,
        sessionId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        jwtToken,
        userAgent: sessionData.userAgent || '',
        ipAddress: sessionData.ipAddress || ''
      });

      // Store session data
      const sessionKey = `${this.prefixes.userSession}:${userId}:${sessionId}`;
      const jwtKey = `${this.prefixes.jwtSession}:${sessionId}`;
      
      // Store both mappings
      const [sessionSuccess, jwtSuccess] = await Promise.all([
        this.cache.set(sessionKey, encryptedData, this.ttl.userSession),
        this.cache.set(jwtKey, { userId, sessionId, token: jwtToken }, this.ttl.jwtSession)
      ]);

      // Add to user's session list
      await this._addToUserSessions(userId, sessionId);

      // Track active user
      await this._trackActiveUser(userId);

      // Audit log
      await this._auditLog('session_created', userId, {
        sessionId,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent
      });

      this.logger.info(`Session created for user ${userId}: ${sessionId}`);
      return sessionSuccess && jwtSuccess;
    } catch (error) {
      this.logger.error('Failed to store user session:', error);
      return false;
    }
  }

  /**
   * Retrieve user session by session ID
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object|null>} Session data or null
   */
  async getUserSession(sessionId) {
    try {
      const jwtKey = `${this.prefixes.jwtSession}:${sessionId}`;
      const jwtData = await this.cache.get(jwtKey);
      
      if (!jwtData) {
        return null;
      }

      const sessionKey = `${this.prefixes.userSession}:${jwtData.userId}:${sessionId}`;
      const encryptedSession = await this.cache.get(sessionKey);
      
      if (!encryptedSession) {
        // Clean up orphaned JWT reference
        await this.cache.delete(jwtKey);
        return null;
      }

      const sessionData = this._decryptSensitiveData(encryptedSession);
      
      // Update last activity
      await this._updateLastActivity(sessionData.userId, sessionId);
      
      return sessionData;
    } catch (error) {
      this.logger.error('Failed to retrieve user session:', error);
      return null;
    }
  }

  /**
   * Validate JWT token and retrieve session
   * @param {string} token - JWT token
   * @returns {Promise<Object|null>} Session data or null
   */
  async validateJWTSession(token) {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const sessionId = decoded.sessionId;
      
      if (!sessionId) {
        return null;
      }

      const session = await this.getUserSession(sessionId);
      
      if (!session || session.jwtToken !== token) {
        return null;
      }

      return session;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        this.logger.debug('JWT token expired');
      } else {
        this.logger.error('JWT validation failed:', error);
      }
      return null;
    }
  }

  /**
   * Invalidate user session
   * @param {string} userId - User identifier
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} Success status
   */
  async invalidateSession(userId, sessionId) {
    try {
      const sessionKey = `${this.prefixes.userSession}:${userId}:${sessionId}`;
      const jwtKey = `${this.prefixes.jwtSession}:${sessionId}`;
      
      // Get session data for audit
      const sessionData = await this.cache.get(sessionKey);
      
      // Remove session data
      const [sessionDeleted, jwtDeleted] = await Promise.all([
        this.cache.delete(sessionKey),
        this.cache.delete(jwtKey)
      ]);

      // Remove from user's session list
      await this._removeFromUserSessions(userId, sessionId);

      // Audit log
      await this._auditLog('session_invalidated', userId, {
        sessionId,
        reason: 'manual_logout'
      });

      this.logger.info(`Session invalidated for user ${userId}: ${sessionId}`);
      return sessionDeleted || jwtDeleted;
    } catch (error) {
      this.logger.error('Failed to invalidate session:', error);
      return false;
    }
  }

  /**
   * Invalidate all sessions for a user
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Number of sessions invalidated
   */
  async invalidateAllUserSessions(userId) {
    try {
      const userSessionsKey = `${this.prefixes.sessionLimit}:${userId}`;
      const sessionIds = await this.cache.getSetMembers(userSessionsKey);
      
      let invalidatedCount = 0;
      
      for (const sessionId of sessionIds) {
        const success = await this.invalidateSession(userId, sessionId);
        if (success) invalidatedCount++;
      }

      // Clear the session list
      await this.cache.delete(userSessionsKey);

      // Audit log
      await this._auditLog('all_sessions_invalidated', userId, {
        count: invalidatedCount,
        reason: 'security_action'
      });

      this.logger.info(`Invalidated ${invalidatedCount} sessions for user ${userId}`);
      return invalidatedCount;
    } catch (error) {
      this.logger.error('Failed to invalidate all user sessions:', error);
      return 0;
    }
  }

  // ====== HMRC OAUTH TOKEN CACHING ======

  /**
   * Store HMRC OAuth tokens
   * @param {string} userId - User identifier
   * @param {Object} tokens - OAuth tokens
   * @returns {Promise<boolean>} Success status
   */
  async storeHMRCTokens(userId, tokens) {
    try {
      const tokenKey = `${this.prefixes.hmrcTokens}:${userId}`;
      
      // Encrypt tokens for security
      const encryptedTokens = this._encryptSensitiveData({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: tokens.tokenType || 'bearer',
        expiresAt: tokens.expiresAt || (Date.now() + (tokens.expiresIn * 1000)),
        scope: tokens.scope,
        userId,
        storedAt: Date.now()
      });

      const success = await this.cache.set(tokenKey, encryptedTokens, this.ttl.hmrcRefreshToken);

      // Schedule automatic refresh
      if (tokens.expiresIn) {
        await this._scheduleTokenRefresh(userId, tokens.expiresAt);
      }

      // Audit log
      await this._auditLog('hmrc_tokens_stored', userId, {
        expiresAt: tokens.expiresAt,
        scope: tokens.scope
      });

      this.logger.info(`HMRC tokens stored for user ${userId}`);
      return success;
    } catch (error) {
      this.logger.error('Failed to store HMRC tokens:', error);
      return false;
    }
  }

  /**
   * Retrieve HMRC OAuth tokens
   * @param {string} userId - User identifier
   * @returns {Promise<Object|null>} OAuth tokens or null
   */
  async getHMRCTokens(userId) {
    try {
      const tokenKey = `${this.prefixes.hmrcTokens}:${userId}`;
      const encryptedTokens = await this.cache.get(tokenKey);
      
      if (!encryptedTokens) {
        return null;
      }

      const tokens = this._decryptSensitiveData(encryptedTokens);
      
      // Check if tokens are expired
      if (this._areTokensExpired(tokens)) {
        this.logger.debug(`HMRC tokens expired for user ${userId}`);
        return null;
      }

      // Check if tokens need refresh soon
      if (this._shouldRefreshToken(tokens)) {
        this.logger.debug(`HMRC tokens need refresh for user ${userId}`);
        // Trigger automatic refresh in background
        this._triggerTokenRefresh(userId, tokens);
      }

      return tokens;
    } catch (error) {
      this.logger.error('Failed to retrieve HMRC tokens:', error);
      return null;
    }
  }

  /**
   * Refresh HMRC OAuth tokens
   * @param {string} userId - User identifier
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object|null>} New tokens or null
   */
  async refreshHMRCTokens(userId, refreshToken) {
    try {
      // Check if refresh is already in progress
      const refreshKey = `${this.prefixes.tokenRefresh}:${userId}`;
      const refreshInProgress = await this.cache.get(refreshKey);
      
      if (refreshInProgress) {
        this.logger.debug(`Token refresh already in progress for user ${userId}`);
        return null;
      }

      // Mark refresh as in progress
      await this.cache.set(refreshKey, { inProgress: true, startedAt: Date.now() }, 300);

      try {
        // This would integrate with HMRC OAuth service
        const newTokens = await this._performTokenRefresh(refreshToken);
        
        if (newTokens) {
          // Store new tokens
          await this.storeHMRCTokens(userId, newTokens);
          
          // Audit log
          await this._auditLog('hmrc_tokens_refreshed', userId, {
            expiresAt: newTokens.expiresAt
          });
          
          this.logger.info(`HMRC tokens refreshed for user ${userId}`);
          return newTokens;
        }
      } finally {
        // Clear refresh lock
        await this.cache.delete(refreshKey);
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to refresh HMRC tokens:', error);
      return null;
    }
  }

  /**
   * Invalidate HMRC tokens
   * @param {string} userId - User identifier
   * @returns {Promise<boolean>} Success status
   */
  async invalidateHMRCTokens(userId) {
    try {
      const tokenKey = `${this.prefixes.hmrcTokens}:${userId}`;
      const refreshKey = `${this.prefixes.tokenRefresh}:${userId}`;
      
      const [tokenDeleted, refreshDeleted] = await Promise.all([
        this.cache.delete(tokenKey),
        this.cache.delete(refreshKey)
      ]);

      // Audit log
      await this._auditLog('hmrc_tokens_invalidated', userId, {
        reason: 'manual_revocation'
      });

      this.logger.info(`HMRC tokens invalidated for user ${userId}`);
      return tokenDeleted;
    } catch (error) {
      this.logger.error('Failed to invalidate HMRC tokens:', error);
      return false;
    }
  }

  // ====== ACTIVE USER TRACKING ======

  /**
   * Track active user
   * @param {string} userId - User identifier
   * @returns {Promise<boolean>} Success status
   */
  async _trackActiveUser(userId) {
    try {
      const activeKey = `${this.prefixes.activeUsers}:${userId}`;
      const userData = {
        userId,
        lastSeen: Date.now(),
        sessionCount: await this._getCurrentSessionCount(userId)
      };

      return await this.cache.set(activeKey, userData, this.ttl.activeUser);
    } catch (error) {
      this.logger.error('Failed to track active user:', error);
      return false;
    }
  }

  /**
   * Get active users count
   * @returns {Promise<number>} Number of active users
   */
  async getActiveUsersCount() {
    try {
      const pattern = `${this.prefixes.activeUsers}:*`;
      const keys = await this.cache.keys(pattern);
      return keys.length;
    } catch (error) {
      this.logger.error('Failed to get active users count:', error);
      return 0;
    }
  }

  /**
   * Get detailed active users information
   * @returns {Promise<Array>} Array of active user data
   */
  async getActiveUsers() {
    try {
      const pattern = `${this.prefixes.activeUsers}:*`;
      const keys = await this.cache.keys(pattern);
      
      const activeUsers = [];
      for (const key of keys) {
        const userData = await this.cache.get(key);
        if (userData) {
          activeUsers.push(userData);
        }
      }

      return activeUsers.sort((a, b) => b.lastSeen - a.lastSeen);
    } catch (error) {
      this.logger.error('Failed to get active users:', error);
      return [];
    }
  }

  // ====== BULK TOKEN OPERATIONS ======

  /**
   * Bulk store HMRC tokens for multiple users
   * @param {Array} tokenData - Array of user token data
   * @returns {Promise<Object>} Success/failure counts
   */
  async bulkStoreHMRCTokens(tokenData) {
    try {
      let successCount = 0;
      let failureCount = 0;

      const operations = tokenData.map(async (data) => {
        try {
          const success = await this.storeHMRCTokens(data.userId, data.tokens);
          if (success) successCount++;
          else failureCount++;
        } catch (error) {
          failureCount++;
          this.logger.error(`Failed to store tokens for user ${data.userId}:`, error);
        }
      });

      await Promise.all(operations);

      this.logger.info(`Bulk token storage: ${successCount} success, ${failureCount} failures`);
      return { successCount, failureCount, total: tokenData.length };
    } catch (error) {
      this.logger.error('Bulk token storage failed:', error);
      return { successCount: 0, failureCount: tokenData.length, total: tokenData.length };
    }
  }

  /**
   * Bulk refresh tokens for multiple users
   * @param {Array} userIds - Array of user IDs
   * @returns {Promise<Object>} Refresh results
   */
  async bulkRefreshTokens(userIds) {
    try {
      let successCount = 0;
      let failureCount = 0;
      const results = [];

      const operations = userIds.map(async (userId) => {
        try {
          const tokens = await this.getHMRCTokens(userId);
          if (tokens && tokens.refreshToken) {
            const newTokens = await this.refreshHMRCTokens(userId, tokens.refreshToken);
            if (newTokens) {
              successCount++;
              results.push({ userId, success: true, tokens: newTokens });
            } else {
              failureCount++;
              results.push({ userId, success: false, error: 'Refresh failed' });
            }
          } else {
            failureCount++;
            results.push({ userId, success: false, error: 'No tokens found' });
          }
        } catch (error) {
          failureCount++;
          results.push({ userId, success: false, error: error.message });
        }
      });

      await Promise.all(operations);

      this.logger.info(`Bulk token refresh: ${successCount} success, ${failureCount} failures`);
      return { successCount, failureCount, total: userIds.length, results };
    } catch (error) {
      this.logger.error('Bulk token refresh failed:', error);
      return { successCount: 0, failureCount: userIds.length, total: userIds.length, results: [] };
    }
  }

  // ====== CLEANUP MECHANISMS ======

  /**
   * Clean up expired sessions and tokens
   * @returns {Promise<Object>} Cleanup statistics
   */
  async cleanupExpiredData() {
    try {
      const startTime = Date.now();
      
      const stats = {
        expiredSessions: 0,
        expiredTokens: 0,
        orphanedJWTs: 0,
        cleanupTime: 0
      };

      // Clean expired sessions
      stats.expiredSessions = await this._cleanupExpiredSessions();
      
      // Clean expired tokens
      stats.expiredTokens = await this._cleanupExpiredTokens();
      
      // Clean orphaned JWT references
      stats.orphanedJWTs = await this._cleanupOrphanedJWTs();
      
      // Clean old audit logs
      await this._cleanupOldAuditLogs();

      stats.cleanupTime = Date.now() - startTime;

      this.logger.info('Session cleanup completed:', stats);
      return stats;
    } catch (error) {
      this.logger.error('Session cleanup failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Schedule automatic cleanup
   * @param {number} intervalMs - Cleanup interval in milliseconds
   * @returns {NodeJS.Timeout} Cleanup interval timer
   */
  scheduleCleanup(intervalMs = 3600000) { // Default: 1 hour
    return setInterval(async () => {
      try {
        await this.cleanupExpiredData();
      } catch (error) {
        this.logger.error('Scheduled cleanup failed:', error);
      }
    }, intervalMs);
  }

  // ====== AUDIT LOGGING ======

  /**
   * Log authentication events
   * @private
   */
  async _auditLog(event, userId, details = {}) {
    try {
      const auditKey = `${this.prefixes.auditLog}:${Date.now()}:${userId}`;
      const auditData = {
        event,
        userId,
        timestamp: Date.now(),
        details,
        ipAddress: details.ipAddress || 'unknown',
        userAgent: details.userAgent || 'unknown'
      };

      await this.cache.set(auditKey, auditData, this.ttl.auditLog);
    } catch (error) {
      this.logger.error('Audit logging failed:', error);
    }
  }

  /**
   * Get audit logs for user
   * @param {string} userId - User identifier
   * @param {number} limit - Maximum number of logs
   * @returns {Promise<Array>} Audit log entries
   */
  async getAuditLogs(userId, limit = 100) {
    try {
      const pattern = `${this.prefixes.auditLog}:*:${userId}`;
      const keys = await this.cache.keys(pattern);
      
      // Sort by timestamp (newest first)
      keys.sort((a, b) => {
        const timestampA = parseInt(a.split(':')[2]);
        const timestampB = parseInt(b.split(':')[2]);
        return timestampB - timestampA;
      });

      const limitedKeys = keys.slice(0, limit);
      const logs = [];

      for (const key of limitedKeys) {
        const logData = await this.cache.get(key);
        if (logData) {
          logs.push(logData);
        }
      }

      return logs;
    } catch (error) {
      this.logger.error('Failed to get audit logs:', error);
      return [];
    }
  }

  // ====== HELPER METHODS ======

  /**
   * Encrypt sensitive data
   * @private
   */
  _encryptSensitiveData(data) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.security.encryptionKey);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted: true,
        iv: iv.toString('hex'),
        data: encrypted
      };
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      return data;
    }
  }

  /**
   * Decrypt sensitive data
   * @private
   */
  _decryptSensitiveData(encryptedData) {
    try {
      if (!encryptedData.encrypted) {
        return encryptedData;
      }
      
      const decipher = crypto.createDecipher('aes-256-cbc', this.security.encryptionKey);
      
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      return null;
    }
  }

  /**
   * Get current session count for user
   * @private
   */
  async _getCurrentSessionCount(userId) {
    try {
      const userSessionsKey = `${this.prefixes.sessionLimit}:${userId}`;
      const sessionIds = await this.cache.getSetMembers(userSessionsKey);
      return sessionIds.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Add session to user's session list
   * @private
   */
  async _addToUserSessions(userId, sessionId) {
    try {
      const userSessionsKey = `${this.prefixes.sessionLimit}:${userId}`;
      await this.cache.addToSet(userSessionsKey, sessionId);
      await this.cache.expire(userSessionsKey, this.ttl.userSession);
    } catch (error) {
      this.logger.error('Failed to add to user sessions:', error);
    }
  }

  /**
   * Remove session from user's session list
   * @private
   */
  async _removeFromUserSessions(userId, sessionId) {
    try {
      const userSessionsKey = `${this.prefixes.sessionLimit}:${userId}`;
      await this.cache.removeFromSet(userSessionsKey, sessionId);
    } catch (error) {
      this.logger.error('Failed to remove from user sessions:', error);
    }
  }

  /**
   * Evict oldest session when limit exceeded
   * @private
   */
  async _evictOldestSession(userId) {
    try {
      const userSessionsKey = `${this.prefixes.sessionLimit}:${userId}`;
      const sessionIds = await this.cache.getSetMembers(userSessionsKey);
      
      if (sessionIds.length === 0) return;

      // Find oldest session
      let oldestSessionId = null;
      let oldestTime = Date.now();

      for (const sessionId of sessionIds) {
        const sessionKey = `${this.prefixes.userSession}:${userId}:${sessionId}`;
        const sessionData = await this.cache.get(sessionKey);
        
        if (sessionData) {
          const decrypted = this._decryptSensitiveData(sessionData);
          if (decrypted && decrypted.createdAt < oldestTime) {
            oldestTime = decrypted.createdAt;
            oldestSessionId = sessionId;
          }
        }
      }

      if (oldestSessionId) {
        await this.invalidateSession(userId, oldestSessionId);
        
        // Audit log
        await this._auditLog('session_evicted', userId, {
          sessionId: oldestSessionId,
          reason: 'concurrent_limit_exceeded'
        });
      }
    } catch (error) {
      this.logger.error('Failed to evict oldest session:', error);
    }
  }

  /**
   * Update last activity timestamp
   * @private
   */
  async _updateLastActivity(userId, sessionId) {
    try {
      const sessionKey = `${this.prefixes.userSession}:${userId}:${sessionId}`;
      const encryptedSession = await this.cache.get(sessionKey);
      
      if (encryptedSession) {
        const sessionData = this._decryptSensitiveData(encryptedSession);
        sessionData.lastActivity = Date.now();
        
        const reencrypted = this._encryptSensitiveData(sessionData);
        await this.cache.set(sessionKey, reencrypted, this.ttl.userSession);
      }
    } catch (error) {
      this.logger.error('Failed to update last activity:', error);
    }
  }

  /**
   * Check if tokens are expired
   * @private
   */
  _areTokensExpired(tokens) {
    if (!tokens.expiresAt) return false;
    return Date.now() >= tokens.expiresAt;
  }

  /**
   * Check if tokens should be refreshed soon
   * @private
   */
  _shouldRefreshToken(tokens) {
    if (!tokens.expiresAt) return false;
    return Date.now() >= (tokens.expiresAt - (this.security.tokenRefreshBuffer * 1000));
  }

  /**
   * Schedule token refresh
   * @private
   */
  async _scheduleTokenRefresh(userId, expiresAt) {
    try {
      const refreshTime = expiresAt - (this.security.tokenRefreshBuffer * 1000);
      const delay = Math.max(0, refreshTime - Date.now());
      
      setTimeout(async () => {
        const tokens = await this.getHMRCTokens(userId);
        if (tokens && tokens.refreshToken) {
          await this.refreshHMRCTokens(userId, tokens.refreshToken);
        }
      }, delay);
    } catch (error) {
      this.logger.error('Failed to schedule token refresh:', error);
    }
  }

  /**
   * Trigger token refresh in background
   * @private
   */
  _triggerTokenRefresh(userId, tokens) {
    // Non-blocking refresh
    setImmediate(async () => {
      try {
        await this.refreshHMRCTokens(userId, tokens.refreshToken);
      } catch (error) {
        this.logger.error(`Background token refresh failed for user ${userId}:`, error);
      }
    });
  }

  /**
   * Perform actual token refresh with HMRC
   * @private
   */
  async _performTokenRefresh(refreshToken) {
    // This would integrate with your HMRC OAuth service
    // For now, return mock data structure
    return {
      accessToken: 'new_access_token',
      refreshToken: 'new_refresh_token',
      expiresIn: 14400, // 4 hours
      expiresAt: Date.now() + 14400000,
      tokenType: 'bearer',
      scope: 'read:self-assessment'
    };
  }

  /**
   * Clean up expired sessions
   * @private
   */
  async _cleanupExpiredSessions() {
    try {
      let cleanedCount = 0;
      const pattern = `${this.prefixes.userSession}:*`;
      const keys = await this.cache.keys(pattern);

      for (const key of keys) {
        const ttl = await this.cache.ttl(key);
        if (ttl === -2) { // Key expired
          await this.cache.delete(key);
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to clean expired sessions:', error);
      return 0;
    }
  }

  /**
   * Clean up expired tokens
   * @private
   */
  async _cleanupExpiredTokens() {
    try {
      let cleanedCount = 0;
      const pattern = `${this.prefixes.hmrcTokens}:*`;
      const keys = await this.cache.keys(pattern);

      for (const key of keys) {
        const encryptedTokens = await this.cache.get(key);
        if (encryptedTokens) {
          const tokens = this._decryptSensitiveData(encryptedTokens);
          if (tokens && this._areTokensExpired(tokens)) {
            await this.cache.delete(key);
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to clean expired tokens:', error);
      return 0;
    }
  }

  /**
   * Clean up orphaned JWT references
   * @private
   */
  async _cleanupOrphanedJWTs() {
    try {
      let cleanedCount = 0;
      const pattern = `${this.prefixes.jwtSession}:*`;
      const keys = await this.cache.keys(pattern);

      for (const key of keys) {
        const jwtData = await this.cache.get(key);
        if (jwtData) {
          const sessionKey = `${this.prefixes.userSession}:${jwtData.userId}:${jwtData.sessionId}`;
          const sessionExists = await this.cache.exists(sessionKey);
          
          if (!sessionExists) {
            await this.cache.delete(key);
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to clean orphaned JWTs:', error);
      return 0;
    }
  }

  /**
   * Clean up old audit logs
   * @private
   */
  async _cleanupOldAuditLogs() {
    try {
      const cutoffTime = Date.now() - this.security.auditRetention * 1000;
      const pattern = `${this.prefixes.auditLog}:*`;
      const keys = await this.cache.keys(pattern);

      let cleanedCount = 0;
      for (const key of keys) {
        const timestamp = parseInt(key.split(':')[2]);
        if (timestamp < cutoffTime) {
          await this.cache.delete(key);
          cleanedCount++;
        }
      }

      this.logger.debug(`Cleaned ${cleanedCount} old audit log entries`);
      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to clean old audit logs:', error);
      return 0;
    }
  }
}

module.exports = SessionCacheService;