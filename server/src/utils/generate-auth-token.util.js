const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthTokenUtil {
  constructor() {
    // Get JWT secret from environment or generate one for development
    this.jwtSecret = process.env.JWT_SECRET || this.generateSecret();
    this.tokenExpiry = process.env.JWT_EXPIRY || '24h'; // 24 hours default
    
    this.warnIfMissingSecret();
  }

  /**
   * Generate a secure random secret for development
   * @returns {string} Random secret
   */
  generateSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Warn if JWT secret is not set in production
   */
  warnIfMissingSecret() {
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET must be set in production');
    } else if (!process.env.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET not found. Using generated secret for development:');
      console.warn(`   JWT_SECRET=${this.jwtSecret}`);
      console.warn('   Add this to your .env file!');
    }
  }

  /**
   * Generate JWT token for user
   * @param {Object} user - User data
   * @param {number} user.accountId - User's account ID
   * @param {string} user.email - User's email
   * @param {string} user.firstName - User's first name
   * @param {string} user.lastName - User's last name
   * @returns {string} JWT token
   */
  generateToken(user) {
    const payload = {
      id: user.accountId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiry
    });
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    try {
      // Remove 'Bearer ' prefix if present
      const cleanToken = token.replace(/^Bearer\s+/, '');
      return jwt.verify(cleanToken, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Create authentication middleware
   * @returns {Function} Express middleware
   */
  requireAuth() {
    return (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
          return res.status(401).json({
            success: false,
            error: 'Authorization header required'
          });
        }

        const decoded = this.verifyToken(authHeader);
        req.user = decoded;
        next();
        
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
    };
  }
}

// Export singleton instance
const authTokenUtil = new AuthTokenUtil();

module.exports = authTokenUtil;