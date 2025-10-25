const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class EncryptionUtil {
  constructor() {
    // Encryption settings
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltRounds = 12;
    
    // Get encryption key from environment
    this.encryptionKey = this.deriveKey(process.env.ENCRYPTION_KEY || 'fallback-key-change-in-production');
  }

  // =====================================================
  // PASSWORD HASHING (for user authentication)
  // =====================================================
  
  /**
   * Hash password using bcrypt
   */
  async hashPassword(password) {
    if (!password) throw new Error('Password required');
    return await bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password, hash) {
    if (!password || !hash) return false;
    return await bcrypt.compare(password, hash);
  }

  // =====================================================
  // SYMMETRIC ENCRYPTION (for sensitive data storage)
  // =====================================================
  
  /**
   * Encrypt sensitive data (HMRC tokens, personal info)
   */
  encrypt(plaintext) {
    if (!plaintext) return null;
    
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine iv + tag + encrypted data
      return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error('Encryption failed: ' + error.message);
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData) {
    if (!encryptedData) return null;
    
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) throw new Error('Invalid encrypted data format');
      
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: ' + error.message);
    }
  }

  // =====================================================
  // HMRC TOKEN ENCRYPTION (OAuth tokens)
  // =====================================================
  
  /**
   * Encrypt HMRC OAuth tokens for database storage
   */
  encryptHMRCTokens(tokens) {
    if (!tokens) return null;
    
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
      scope: tokens.scope,
      encrypted_at: new Date().toISOString()
    };
    
    return this.encrypt(JSON.stringify(tokenData));
  }

  /**
   * Decrypt HMRC OAuth tokens from database
   */
  decryptHMRCTokens(encryptedTokens) {
    if (!encryptedTokens) return null;
    
    try {
      const decryptedData = this.decrypt(encryptedTokens);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('Failed to decrypt HMRC tokens:', error.message);
      return null;
    }
  }

  // =====================================================
  // JWT TOKEN MANAGEMENT
  // =====================================================
  
  /**
   * Generate JWT access token
   */
  generateAccessToken(payload, expiresIn = '24h') {
    return jwt.sign(
      {
        ...payload,
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { 
        expiresIn,
        issuer: 'mtd-tax-bridge',
        audience: 'mtd-users'
      }
    );
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(payload, expiresIn = '7d') {
    return jwt.sign(
      {
        userId: payload.userId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_REFRESH_SECRET,
      { 
        expiresIn,
        issuer: 'mtd-tax-bridge',
        audience: 'mtd-users'
      }
    );
  }

  /**
   * Verify JWT token
   */
  verifyToken(token, type = 'access') {
    try {
      const secret = type === 'refresh' ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
      const decoded = jwt.verify(token, secret, {
        issuer: 'mtd-tax-bridge',
        audience: 'mtd-users'
      });
      
      if (decoded.type !== type) {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      throw new Error('Token verification failed: ' + error.message);
    }
  }

  // =====================================================
  // SECURE RANDOM TOKENS (email verification, password reset)
  // =====================================================
  
  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken(userId, email) {
    const payload = {
      userId,
      email,
      type: 'email_verification',
      timestamp: Date.now()
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(userId, email) {
    const payload = {
      userId,
      email,
      type: 'password_reset',
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex') // Prevent replay attacks
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  /**
   * Verify special purpose token
   */
  verifySpecialToken(token, expectedType) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.type !== expectedType) {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      throw new Error('Token verification failed: ' + error.message);
    }
  }

  // =====================================================
  // DATA HASHING (for deduplication, integrity)
  // =====================================================
  
  /**
   * Generate hash for file deduplication
   */
  generateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generate hash for data integrity
   */
  generateDataHash(data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Generate HMAC for API request signing
   */
  generateHMAC(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  // =====================================================
  // PERSONAL DATA ENCRYPTION (GDPR compliance)
  // =====================================================
  
  /**
   * Encrypt personally identifiable information
   */
  encryptPII(data) {
    if (!data) return null;
    
    const piiData = {
      data,
      encrypted_at: new Date().toISOString(),
      version: '1.0'
    };
    
    return this.encrypt(JSON.stringify(piiData));
  }

  /**
   * Decrypt personally identifiable information
   */
  decryptPII(encryptedData) {
    if (!encryptedData) return null;
    
    try {
      const decryptedData = this.decrypt(encryptedData);
      const piiData = JSON.parse(decryptedData);
      return piiData.data;
    } catch (error) {
      console.error('Failed to decrypt PII:', error.message);
      return null;
    }
  }

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================
  
  /**
   * Derive encryption key from master key
   */
  deriveKey(masterKey) {
    return crypto.pbkdf2Sync(masterKey, 'mtd-salt', 100000, this.keyLength, 'sha512');
  }

  /**
   * Generate secure session ID
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data, fields = ['password', 'token', 'utr', 'ni_number']) {
    if (!data || typeof data !== 'object') return data;
    
    const masked = { ...data };
    
    fields.forEach(field => {
      if (masked[field]) {
        const value = masked[field].toString();
        if (value.length <= 4) {
          masked[field] = '***';
        } else {
          masked[field] = value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
        }
      }
    });
    
    return masked;
  }

  /**
   * Constant-time string comparison (prevents timing attacks)
   */
  secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    
    if (a.length !== b.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Generate API key for external integrations
   */
  generateApiKey(prefix = 'mtd') {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(16).toString('hex');
    return `${prefix}_${timestamp}_${random}`;
  }
}

module.exports = new EncryptionUtil();