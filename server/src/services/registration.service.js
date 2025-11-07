const { pool } = require('../database/utilities/dbconnect');
const { encryptionUtil } = require('../utils/encryption.util');
const { AppError } = require('../utils/errors.util');

class RegistrationService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {string} userData.firstName - User's first name
   * @param {string} userData.lastName - User's last name
   * @param {string} userData.email - User's email address
   * @param {string} userData.password - User's password
   * @param {string} [userData.niNumber] - Optional NI number
   * @returns {Promise<Object>} Created user data (without sensitive info)
   */
  async registerUser(userData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log('🔐 Starting user registration process...');
      
      // Validate input data
      this.validateRegistrationData(userData);
      
      // Check if user already exists
      await this.checkUserExists(client, userData.email);
      
      // Process sensitive data
      const processedData = await this.processSensitiveData(userData);
      
      // Insert user into database
      const newUser = await this.insertUser(client, processedData);
      
      await client.query('COMMIT');
      console.log('✅ User registration successful');
      
      return {
        accountId: newUser.account_id,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        email: newUser.email,
        createdAt: newUser.created_at
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Registration failed:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate registration data
   * @param {Object} userData - User data to validate
   */
  validateRegistrationData(userData) {
    const { firstName, lastName, email, password, niNumber } = userData;
    
    // Required fields
    if (!firstName || firstName.trim().length < 2) {
      throw new AppError('First name must be at least 2 characters long', 400, 'VALIDATION_ERROR');
    }
    
    if (!lastName || lastName.trim().length < 2) {
      throw new AppError('Last name must be at least 2 characters long', 400, 'VALIDATION_ERROR');
    }
    
    if (!email || !this.isValidEmail(email)) {
      throw new AppError('Valid email address is required', 400, 'VALIDATION_ERROR');
    }
    
    if (!password || password.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400, 'VALIDATION_ERROR');
    }
    
    if (!this.isStrongPassword(password)) {
      throw new AppError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character', 400, 'VALIDATION_ERROR');
    }
    
    // Optional NI number validation
    if (niNumber && !encryptionUtil.validateNINumber(niNumber)) {
      throw new AppError('Invalid National Insurance number format', 400, 'VALIDATION_ERROR');
    }
    
    console.log('✅ Registration data validation passed');
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
   * Check password strength
   * @param {string} password - Password to check
   * @returns {boolean} True if strong enough
   */
  isStrongPassword(password) {
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongRegex.test(password);
  }

  /**
   * Check if user already exists
   * @param {Object} client - Database client
   * @param {string} email - Email to check
   */
  async checkUserExists(client, email) {
    const existingUser = await client.query(
      'SELECT account_id FROM accounts WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (existingUser.rows.length > 0) {
      throw new AppError('Email address is already registered', 409, 'USER_EXISTS');
    }
    
    console.log('✅ Email availability check passed');
  }

  /**
   * Process sensitive data (hash password, hash NI number)
   * @param {Object} userData - Raw user data
   * @returns {Promise<Object>} Processed user data
   */
  async processSensitiveData(userData) {
    console.log('🔐 Processing sensitive data...');
    
    const processed = {
      firstName: userData.firstName.trim(),
      lastName: userData.lastName.trim(),
      email: userData.email.toLowerCase().trim(),
      passwordHash: null,
      niNumberHash: null
    };
    
    // Hash password using bcrypt
    processed.passwordHash = await encryptionUtil.hashPassword(userData.password);
    console.log('✅ Password hashed successfully');
    
    // Process NI number if provided (using one-way hash)
    if (userData.niNumber) {
      processed.niNumberHash = encryptionUtil.hashNINumber(userData.niNumber);
      console.log('✅ NI number hashed successfully');
    }
    
    return processed;
  }

  /**
   * Insert user into database
   * @param {Object} client - Database client
   * @param {Object} processedData - Processed user data
   * @returns {Promise<Object>} Created user record
   */
  async insertUser(client, processedData) {
    const query = `
      INSERT INTO accounts (first_name, last_name, email, password_hash, ni_number_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING account_id, first_name, last_name, email, created_at
    `;
    
    const values = [
      processedData.firstName,
      processedData.lastName,
      processedData.email,
      processedData.passwordHash,
      processedData.niNumberHash
    ];
    
    const result = await client.query(query, values);
    
    if (result.rows.length === 0) {
      throw new AppError('Failed to create user account', 500, 'DATABASE_ERROR');
    }
    
    console.log('✅ User inserted into database successfully');
    return result.rows[0];
  }

  /**
   * Authenticate user login
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<Object>} User data if authentication successful
   */
  async authenticateUser(email, password) {
    try {
      console.log('🔐 Starting user authentication...');
      
      if (!email || !password) {
        throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
      }
      
      // Find user by email
      const query = 'SELECT * FROM accounts WHERE email = $1';
      const result = await pool.query(query, [email.toLowerCase()]);
      
      if (result.rows.length === 0) {
        throw new AppError('Invalid email or password', 401, 'AUTHENTICATION_FAILED');
      }
      
      const user = result.rows[0];
      
      // Verify password
      const isValidPassword = await encryptionUtil.verifyPassword(password, user.password_hash);
      
      if (!isValidPassword) {
        throw new AppError('Invalid email or password', 401, 'AUTHENTICATION_FAILED');
      }
      
      console.log('✅ User authentication successful');
      
      // Return user data without sensitive information
      return {
        accountId: user.account_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        createdAt: user.created_at
      };
      
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Get user by ID (for session management)
   * @param {number} accountId - User's account ID
   * @returns {Promise<Object>} User data
   */
  async getUserById(accountId) {
    try {
      if (!accountId || isNaN(accountId)) {
        throw new AppError('Valid account ID is required', 400, 'VALIDATION_ERROR');
      }
      
      const query = `
        SELECT account_id, first_name, last_name, email, created_at 
        FROM accounts 
        WHERE account_id = $1
      `;
      const result = await pool.query(query, [accountId]);
      
      if (result.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      return {
        accountId: result.rows[0].account_id,
        firstName: result.rows[0].first_name,
        lastName: result.rows[0].last_name,
        email: result.rows[0].email,
        createdAt: result.rows[0].created_at
      };
      
    } catch (error) {
      console.error('❌ Get user by ID failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if email is available
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} True if available
   */
  async isEmailAvailable(email) {
    try {
      if (!email || !this.isValidEmail(email)) {
        return false;
      }
      
      const query = 'SELECT account_id FROM accounts WHERE email = $1';
      const result = await pool.query(query, [email.toLowerCase()]);
      
      return result.rows.length === 0;
      
    } catch (error) {
      console.error('❌ Email availability check failed:', error.message);
      return false;
    }
  }

  /**
   * Update user password
   * @param {number} accountId - User's account ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} True if password updated successfully
   */
  async updatePassword(accountId, currentPassword, newPassword) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current user data
      const user = await this.getUserById(accountId);
      const userQuery = 'SELECT password_hash FROM accounts WHERE account_id = $1';
      const userResult = await client.query(userQuery, [accountId]);
      
      if (userResult.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      // Verify current password
      const isValidCurrentPassword = await encryptionUtil.verifyPassword(
        currentPassword, 
        userResult.rows[0].password_hash
      );
      
      if (!isValidCurrentPassword) {
        throw new AppError('Current password is incorrect', 401, 'AUTHENTICATION_FAILED');
      }
      
      // Validate new password
      if (!newPassword || newPassword.length < 8) {
        throw new AppError('New password must be at least 8 characters long', 400, 'VALIDATION_ERROR');
      }
      
      if (!this.isStrongPassword(newPassword)) {
        throw new AppError('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character', 400, 'VALIDATION_ERROR');
      }
      
      // Hash new password
      const newPasswordHash = await encryptionUtil.hashPassword(newPassword);
      
      // Update password in database
      const updateQuery = 'UPDATE accounts SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE account_id = $2';
      await client.query(updateQuery, [newPasswordHash, accountId]);
      
      await client.query('COMMIT');
      console.log('✅ Password updated successfully');
      
      return true;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Password update failed:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user statistics (admin functionality)
   * @returns {Promise<Object>} User statistics
   */
  async getUserStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as users_last_24h,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as users_last_7_days,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as users_last_30_days,
          COUNT(CASE WHEN ni_number_hash IS NOT NULL THEN 1 END) as users_with_ni
        FROM accounts
      `;
      
      const result = await pool.query(query);
      return result.rows[0];
      
    } catch (error) {
      console.error('❌ Get user stats failed:', error.message);
      throw error;
    }
  }
}

module.exports = new RegistrationService();