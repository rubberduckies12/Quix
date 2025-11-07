const { pool } = require('../database/utilities/dbconnect');
const { encryptionUtil } = require('../utils/encryption.util');
const authTokenUtil = require('../utils/generate-auth-token.util');
const { AppError } = require('../utils/errors.util');

class LoginService {
  /**
   * Authenticate user and generate token
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<Object>} Login response with token and user data
   */
  async login(email, password) {
    try {
      console.log('🔐 Login attempt for:', email);
      
      // Validate input
      this.validateLoginInput(email, password);
      
      // Find user by email
      const user = await this.findUserByEmail(email);
      
      // Verify password
      await this.verifyPassword(password, user.password_hash);
      
      // Generate JWT token
      const token = this.generateAuthToken(user);
      
      // Update last login (optional)
      await this.updateLastLogin(user.account_id);
      
      console.log('✅ Login successful for:', email);
      
      return {
        success: true,
        message: 'Login successful',
        token: token,
        user: {
          accountId: user.account_id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          kycCompleted: user.ni_number_hash !== null,
          createdAt: user.created_at
        }
      };
      
    } catch (error) {
      console.error('❌ Login failed for:', email, '-', error.message);
      throw error;
    }
  }

  /**
   * Validate login input data
   * @param {string} email - Email to validate
   * @param {string} password - Password to validate
   */
  validateLoginInput(email, password) {
    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
    }

    if (!this.isValidEmail(email)) {
      throw new AppError('Valid email address is required', 400, 'VALIDATION_ERROR');
    }

    if (password.length < 8) {
      throw new AppError('Invalid email or password', 401, 'AUTHENTICATION_FAILED');
    }

    console.log('✅ Login input validation passed');
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Find user by email
   * @param {string} email - User's email
   * @returns {Promise<Object>} User data
   */
  async findUserByEmail(email) {
    const query = `
      SELECT 
        account_id, 
        first_name, 
        last_name, 
        email, 
        password_hash, 
        ni_number_hash,
        created_at,
        updated_at
      FROM accounts 
      WHERE email = $1
    `;
    
    const result = await pool.query(query, [email.toLowerCase().trim()]);
    
    if (result.rows.length === 0) {
      throw new AppError('Invalid email or password', 401, 'AUTHENTICATION_FAILED');
    }
    
    console.log('✅ User found in database');
    return result.rows[0];
  }

  /**
   * Verify password against hash
   * @param {string} password - Plain text password
   * @param {string} passwordHash - Hashed password from database
   */
  async verifyPassword(password, passwordHash) {
    const isValidPassword = await encryptionUtil.verifyPassword(password, passwordHash);
    
    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401, 'AUTHENTICATION_FAILED');
    }
    
    console.log('✅ Password verification successful');
  }

  /**
   * Generate JWT authentication token
   * @param {Object} user - User data from database
   * @returns {string} JWT token
   */
  generateAuthToken(user) {
    const tokenData = {
      accountId: user.account_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name
    };
    
    const token = authTokenUtil.generateToken(tokenData);
    console.log('✅ JWT token generated');
    
    return token;
  }

  /**
   * Update user's last login timestamp (optional feature)
   * @param {number} accountId - User's account ID
   */
  async updateLastLogin(accountId) {
    try {
      const query = 'UPDATE accounts SET updated_at = CURRENT_TIMESTAMP WHERE account_id = $1';
      await pool.query(query, [accountId]);
      console.log('✅ Last login timestamp updated');
    } catch (error) {
      // Non-critical error - log but don't fail the login
      console.warn('⚠️ Failed to update last login timestamp:', error.message);
    }
  }

  /**
   * Verify if a token is valid (for middleware/session checking)
   * @param {string} token - JWT token to verify
   * @returns {Promise<Object>} User data if token is valid
   */
  async verifyToken(token) {
    try {
      const decoded = authTokenUtil.verifyToken(token);
      
      // Optionally verify user still exists in database
      const user = await this.findUserById(decoded.id);
      
      return {
        accountId: user.account_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        kycCompleted: user.ni_number_hash !== null
      };
      
    } catch (error) {
      throw new AppError('Invalid or expired token', 401, 'TOKEN_INVALID');
    }
  }

  /**
   * Find user by ID (for token verification)
   * @param {number} accountId - User's account ID
   * @returns {Promise<Object>} User data
   */
  async findUserById(accountId) {
    const query = `
      SELECT 
        account_id, 
        first_name, 
        last_name, 
        email, 
        ni_number_hash,
        created_at
      FROM accounts 
      WHERE account_id = $1
    `;
    
    const result = await pool.query(query, [accountId]);
    
    if (result.rows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    return result.rows[0];
  }

  /**
   * Logout user (for future session management)
   * @param {string} token - JWT token to invalidate
   * @returns {Promise<Object>} Logout response
   */
  async logout(token) {
    try {
      // For basic JWT, we can't invalidate tokens server-side
      // This is mainly for frontend to clear the token
      // In future, you could add token blacklisting here
      
      console.log('ℹ️ Logout requested - token should be cleared on frontend');
      
      return {
        success: true,
        message: 'Logout successful'
      };
      
    } catch (error) {
      console.error('❌ Logout error:', error.message);
      return {
        success: true,
        message: 'Logout completed'
      };
    }
  }

  /**
   * Check if user account is locked or suspended
   * @param {Object} user - User data
   * @returns {boolean} True if account is active
   */
  isAccountActive(user) {
    // Add account status checks here in the future
    // For now, all accounts are active
    return true;
  }

  /**
   * Get login statistics (admin feature)
   * @returns {Promise<Object>} Login statistics
   */
  async getLoginStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN updated_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as active_last_24h,
          COUNT(CASE WHEN updated_at >= NOW() - INTERVAL '7 days' THEN 1 END) as active_last_7_days,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_last_30_days
        FROM accounts
      `;
      
      const result = await pool.query(query);
      return result.rows[0];
      
    } catch (error) {
      console.error('❌ Get login stats failed:', error.message);
      throw new AppError('Failed to retrieve login statistics', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Password reset initiation (placeholder for future implementation)
   * @param {string} email - User's email for password reset
   * @returns {Promise<Object>} Reset response
   */
  async initiatePasswordReset(email) {
    try {
      // Validate email exists
      const user = await this.findUserByEmail(email);
      
      // In a real implementation:
      // 1. Generate secure reset token
      // 2. Store token with expiry in database
      // 3. Send reset email
      
      console.log('ℹ️ Password reset initiated for:', email);
      
      return {
        success: true,
        message: 'Password reset instructions sent to your email'
      };
      
    } catch (error) {
      // Don't reveal if email exists or not for security
      return {
        success: true,
        message: 'If the email exists, password reset instructions have been sent'
      };
    }
  }
}

module.exports = new LoginService();