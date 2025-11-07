const crypto = require('crypto');
const bcrypt = require('bcrypt');

class EncryptionUtil {
  constructor() {
    // AES-256-GCM configuration
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltRounds = 12; // bcrypt salt rounds
    
    // Get encryption key from environment variable
    this.encryptionKey = this.getEncryptionKey();
  }

  /**
   * Get or generate encryption key from environment
   * @returns {Buffer} 32-byte encryption key
   */
  getEncryptionKey() {
    const keyFromEnv = process.env.ENCRYPTION_KEY;
    
    if (keyFromEnv) {
      // Convert hex string to buffer
      return Buffer.from(keyFromEnv, 'hex');
    }
    
    // Generate new key if not in environment (development only)
    if (process.env.NODE_ENV === 'development') {
      const newKey = crypto.randomBytes(this.keyLength);
      console.warn('⚠️  No ENCRYPTION_KEY found. Generated temporary key for development:');
      console.warn(`   ENCRYPTION_KEY=${newKey.toString('hex')}`);
      console.warn('   Add this to your .env file for production!');
      return newKey;
    }
    
    throw new Error('ENCRYPTION_KEY environment variable is required for production');
  }

  /**
   * Encrypt sensitive data (NI numbers, etc.) using AES-256-GCM
   * @param {string} plaintext - Data to encrypt
   * @returns {string} Encrypted data as hex string (iv:tag:ciphertext)
   */
  encryptSensitiveData(plaintext) {
    try {
      if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Invalid input: plaintext must be a non-empty string');
      }

      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey, { iv });
      
      // Encrypt the data
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Return iv:tag:ciphertext format
      return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   * @param {string} encryptedData - Encrypted data in format (iv:tag:ciphertext)
   * @returns {string} Decrypted plaintext
   */
  decryptSensitiveData(encryptedData) {
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid input: encryptedData must be a non-empty string');
      }

      // Parse the encrypted data format
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const ciphertext = parts[2];

      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey, { iv });
      decipher.setAuthTag(tag);

      // Decrypt the data
      let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');

      return plaintext;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Invalid input: password must be a non-empty string');
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  /**
   * Verify password against hash using bcrypt
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, hash) {
    try {
      if (!password || !hash) {
        return false;
      }

      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Generate a secure random token for email verification, etc.
   * @param {number} length - Token length in bytes (default 32)
   * @returns {string} Hex string token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash NI number for database storage (one-way hash for privacy)
   * @param {string} niNumber - National Insurance number
   * @returns {string} Hashed NI number
   */
  hashNINumber(niNumber) {
    if (!niNumber) return null;
    
    // Normalize NI number (remove spaces, convert to uppercase)
    const normalized = niNumber.replace(/\s/g, '').toUpperCase();
    
    // Use SHA-256 with salt for one-way hashing
    const salt = process.env.NI_HASH_SALT || 'quix_ni_salt_2024';
    return crypto.createHash('sha256').update(normalized + salt).digest('hex');
  }

  /**
   * Validate NI number format
   * @param {string} niNumber - National Insurance number to validate
   * @returns {boolean} True if valid format
   */
  validateNINumber(niNumber) {
    if (!niNumber) return false;
    
    // Remove spaces and convert to uppercase
    const normalized = niNumber.replace(/\s/g, '').toUpperCase();
    
    // UK NI number format: 2 letters + 6 digits + 1 letter
    // Example: AB123456C
    const niRegex = /^[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z][0-9]{6}[A-D]$/;
    
    return niRegex.test(normalized);
  }

  /**
   * Generate encryption key for environment setup
   * @returns {string} New encryption key as hex string
   */
  static generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }
}

// Export singleton instance
const encryptionUtil = new EncryptionUtil();

module.exports = {
  encryptionUtil,
  EncryptionUtil
};