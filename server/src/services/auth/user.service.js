const pool = require('../../config/database.config');
const logger = require('../../utils/logger.util');
const { AppError } = require('../../utils/error.util');

class UserService {
  /**
   * Create a new user
   */
  async create(userData) {
    const client = await pool.connect();
    
    try {
      const query = `
        INSERT INTO users (
          email, password_hash, first_name, last_name, utr, ni_number,
          trading_name, trade_description, business_start_date, 
          is_landlord, property_count, is_vat_registered, vat_number,
          email_verification_token, email_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, email, first_name, last_name, utr, is_landlord, 
                  is_vat_registered, email_verified, created_at
      `;
      
      const values = [
        userData.email,
        userData.passwordHash,
        userData.firstName,
        userData.lastName,
        userData.utr,
        userData.niNumber,
        userData.tradingName,
        userData.tradeDescription,
        userData.businessStartDate,
        userData.isLandlord,
        userData.propertyCount,
        userData.isVatRegistered,
        userData.vatNumber,
        userData.emailVerificationToken,
        userData.emailVerified
      ];
      
      const result = await client.query(query, values);
      return result.rows[0];
      
    } catch (error) {
      logger.error('Error creating user:', error);
      if (error.code === '23505') { // Unique violation
        if (error.constraint === 'users_email_key') {
          throw new AppError('Email already exists', 409);
        }
        if (error.constraint === 'users_utr_key') {
          throw new AppError('UTR already registered', 409);
        }
      }
      throw new AppError('Failed to create user', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT id, email, first_name, last_name, phone, utr, ni_number,
               trading_name, trade_description, business_start_date,
               is_landlord, property_count, is_vat_registered, vat_number,
               vat_scheme, tax_year_start, tax_year_end, accounting_method,
               mtd_eligible, quarterly_reporting_required, email_verified,
               is_active, last_login, created_at
        FROM users 
        WHERE email = $1
      `;
      
      const result = await client.query(query, [email]);
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Find user by email with password (for login)
   */
  async findByEmailWithPassword(email) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT id, email, password_hash, first_name, last_name, utr,
               is_landlord, is_vat_registered, email_verified, is_active
        FROM users 
        WHERE email = $1
      `;
      
      const result = await client.query(query, [email]);
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Error finding user by email with password:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Find user by UTR
   */
  async findByUtr(utr) {
    const client = await pool.connect();
    
    try {
      const query = 'SELECT id, email, utr FROM users WHERE utr = $1';
      const result = await client.query(query, [utr]);
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Error finding user by UTR:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Find user by ID
   */
  async findById(id) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT id, email, first_name, last_name, phone, date_of_birth,
               address_line_1, address_line_2, city, postcode, utr, ni_number,
               trading_name, trade_description, business_start_date,
               business_address_same_as_home, business_address, business_postcode,
               is_landlord, property_count, is_vat_registered, vat_number,
               vat_scheme, vat_registration_date, flat_rate_percentage,
               tax_year_start, tax_year_end, accounting_method,
               mtd_eligible, income_threshold_met, quarterly_reporting_required,
               currency, timezone, notification_preferences,
               email_verified, is_active, last_login, created_at, updated_at
        FROM users 
        WHERE id = $1 AND is_active = true
      `;
      
      const result = await client.query(query, [id]);
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Find user by email verification token
   */
  async findByEmailVerificationToken(token) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT id, email, first_name, email_verified
        FROM users 
        WHERE email_verification_token = $1
      `;
      
      const result = await client.query(query, [token]);
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Error finding user by verification token:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Find user by password reset token
   */
  async findByPasswordResetToken(token) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT id, email, first_name, password_reset_expires, is_active
        FROM users 
        WHERE password_reset_token = $1
      `;
      
      const result = await client.query(query, [token]);
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Error finding user by reset token:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId) {
    const client = await pool.connect();
    
    try {
      const query = `
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP 
        WHERE id = $1
      `;
      
      await client.query(query, [userId]);
      
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Set password reset token
   */
  async setPasswordResetToken(userId, token, expires) {
    const client = await pool.connect();
    
    try {
      const query = `
        UPDATE users 
        SET password_reset_token = $1, password_reset_expires = $2
        WHERE id = $3
      `;
      
      await client.query(query, [token, expires, userId]);
      
    } catch (error) {
      logger.error('Error setting password reset token:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Update password and clear reset token
   */
  async updatePassword(userId, passwordHash) {
    const client = await pool.connect();
    
    try {
      const query = `
        UPDATE users 
        SET password_hash = $1, 
            password_reset_token = NULL, 
            password_reset_expires = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      
      await client.query(query, [passwordHash, userId]);
      
    } catch (error) {
      logger.error('Error updating password:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(userId) {
    const client = await pool.connect();
    
    try {
      const query = `
        UPDATE users 
        SET email_verified = true, 
            email_verification_token = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      
      await client.query(query, [userId]);
      
    } catch (error) {
      logger.error('Error verifying email:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Update email verification token
   */
  async updateEmailVerificationToken(userId, token) {
    const client = await pool.connect();
    
    try {
      const query = `
        UPDATE users 
        SET email_verification_token = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      
      await client.query(query, [token, userId]);
      
    } catch (error) {
      logger.error('Error updating email verification token:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }

  /**
   * Deactivate user account
   */
  async deactivate(userId) {
    const client = await pool.connect();
    
    try {
      const query = `
        UPDATE users 
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      
      await client.query(query, [userId]);
      
    } catch (error) {
      logger.error('Error deactivating user:', error);
      throw new AppError('Database error', 500);
    } finally {
      client.release();
    }
  }
}

module.exports = new UserService();