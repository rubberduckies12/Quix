const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const userService = require('../../services/auth/user.service');
const jwtService = require('../../services/auth/jwt.service');
const notificationService = require('../../services/external/notification.service');
const logger = require('../../utils/logger.util');
const { AppError } = require('../../utils/error.util');

class AuthController {
  /**
   * Register new user
   * POST /auth/register
   */
  async register(req, res, next) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        email,
        password,
        firstName,
        lastName,
        utr,
        niNumber,
        tradingName,
        tradeDescription,
        businessStartDate,
        isLandlord,
        propertyCount,
        isVatRegistered,
        vatNumber
      } = req.body;

      // Check if user already exists
      const existingUser = await userService.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Account with this email already exists'
        });
      }

      // Check if UTR is already registered
      const existingUtr = await userService.findByUtr(utr);
      if (existingUtr) {
        return res.status(409).json({
          success: false,
          message: 'UTR is already registered with another account'
        });
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');

      // Create user data
      const userData = {
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        utr: utr.replace(/\s/g, ''),
        niNumber: niNumber ? niNumber.replace(/\s/g, '').toUpperCase() : null,
        tradingName: tradingName?.trim(),
        tradeDescription: tradeDescription?.trim(),
        businessStartDate: businessStartDate ? new Date(businessStartDate) : null,
        isLandlord: Boolean(isLandlord),
        propertyCount: isLandlord ? parseInt(propertyCount) || 0 : 0,
        isVatRegistered: Boolean(isVatRegistered),
        vatNumber: isVatRegistered ? vatNumber?.replace(/\s/g, '') : null,
        emailVerificationToken,
        emailVerified: false
      };

      // Create user
      const user = await userService.create(userData);

      // Send verification email
      try {
        await notificationService.sendEmailVerification(
          user.email,
          user.firstName,
          emailVerificationToken
        );
      } catch (error) {
        logger.error('Failed to send verification email:', error);
        // Don't fail registration if email fails
      }

      // Log registration
      logger.info(`User registered: ${user.email}`, {
        userId: user.id,
        email: user.email,
        utr: user.utr
      });

      res.status(201).json({
        success: true,
        message: 'Account created successfully. Please check your email to verify your account.',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            emailVerified: user.emailVerified
          }
        }
      });

    } catch (error) {
      logger.error('Registration error:', error);
      next(new AppError('Registration failed', 500));
    }
  }

  /**
   * User login
   * POST /auth/login
   */
  async login(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const { email, password } = req.body;

      // Find user by email
      const user = await userService.findByEmailWithPassword(email.toLowerCase().trim());
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated. Please contact support.'
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if email is verified
      if (!user.emailVerified) {
        return res.status(401).json({
          success: false,
          message: 'Please verify your email address before logging in',
          code: 'EMAIL_NOT_VERIFIED'
        });
      }

      // Generate tokens
      const accessToken = jwtService.generateAccessToken(user.id);
      const refreshToken = jwtService.generateRefreshToken(user.id);

      // Update last login
      await userService.updateLastLogin(user.id);

      // Log successful login
      logger.info(`User logged in: ${user.email}`, {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            utr: user.utr,
            isLandlord: user.isLandlord,
            isVatRegistered: user.isVatRegistered,
            emailVerified: user.emailVerified
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '24h'
          }
        }
      });

    } catch (error) {
      logger.error('Login error:', error);
      next(new AppError('Login failed', 500));
    }
  }

  /**
   * Refresh access token
   * POST /auth/refresh-token
   */
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = jwtService.verifyRefreshToken(refreshToken);
      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }

      // Find user
      const user = await userService.findById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      // Generate new access token
      const newAccessToken = jwtService.generateAccessToken(user.id);

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '24h'
        }
      });

    } catch (error) {
      logger.error('Token refresh error:', error);
      next(new AppError('Token refresh failed', 500));
    }
  }

  /**
   * User logout
   * POST /auth/logout
   */
  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.id;

      // In a production environment, you would invalidate the tokens
      // This could involve adding them to a blacklist or removing from a whitelist
      // For now, we'll just log the logout

      if (userId) {
        logger.info(`User logged out: ${req.user.email}`, {
          userId,
          ip: req.ip
        });
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      next(new AppError('Logout failed', 500));
    }
  }

  /**
   * Forgot password
   * POST /auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Valid email is required'
        });
      }

      const { email } = req.body;

      // Always return success to prevent email enumeration
      const response = {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      };

      const user = await userService.findByEmail(email.toLowerCase().trim());
      if (!user || !user.isActive) {
        return res.json(response);
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

      // Save reset token
      await userService.setPasswordResetToken(user.id, resetToken, resetTokenExpires);

      // Send reset email
      try {
        await notificationService.sendPasswordReset(
          user.email,
          user.firstName,
          resetToken
        );
      } catch (error) {
        logger.error('Failed to send password reset email:', error);
      }

      logger.info(`Password reset requested: ${user.email}`, {
        userId: user.id,
        ip: req.ip
      });

      res.json(response);

    } catch (error) {
      logger.error('Forgot password error:', error);
      next(new AppError('Password reset request failed', 500));
    }
  }

  /**
   * Reset password
   * POST /auth/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { token, password } = req.body;

      // Find user by reset token
      const user = await userService.findByPasswordResetToken(token);
      if (!user || !user.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Check if token is expired
      if (new Date() > user.passwordResetExpires) {
        return res.status(400).json({
          success: false,
          message: 'Reset token has expired. Please request a new one.'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Update password and clear reset token
      await userService.updatePassword(user.id, passwordHash);

      logger.info(`Password reset completed: ${user.email}`, {
        userId: user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.'
      });

    } catch (error) {
      logger.error('Reset password error:', error);
      next(new AppError('Password reset failed', 500));
    }
  }

  /**
   * Verify email
   * POST /auth/verify-email
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      // Find user by verification token
      const user = await userService.findByEmailVerificationToken(token);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      if (user.emailVerified) {
        return res.json({
          success: true,
          message: 'Email is already verified'
        });
      }

      // Verify email
      await userService.verifyEmail(user.id);

      logger.info(`Email verified: ${user.email}`, {
        userId: user.id
      });

      res.json({
        success: true,
        message: 'Email verified successfully. You can now log in.'
      });

    } catch (error) {
      logger.error('Email verification error:', error);
      next(new AppError('Email verification failed', 500));
    }
  }

  /**
   * Get current user
   * GET /auth/me
   */
  async getCurrentUser(req, res, next) {
    try {
      const userId = req.user.id;

      const user = await userService.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            utr: user.utr,
            niNumber: user.ni_number,
            tradingName: user.trading_name,
            tradeDescription: user.trade_description,
            businessStartDate: user.business_start_date,
            isLandlord: user.is_landlord,
            propertyCount: user.property_count,
            isVatRegistered: user.is_vat_registered,
            vatNumber: user.vat_number,
            vatScheme: user.vat_scheme,
            taxYearStart: user.tax_year_start,
            taxYearEnd: user.tax_year_end,
            accountingMethod: user.accounting_method,
            mtdEligible: user.mtd_eligible,
            quarterlyReportingRequired: user.quarterly_reporting_required,
            emailVerified: user.email_verified,
            lastLogin: user.last_login,
            createdAt: user.created_at
          }
        }
      });

    } catch (error) {
      logger.error('Get current user error:', error);
      next(new AppError('Failed to fetch user data', 500));
    }
  }

  /**
   * Resend verification email
   * POST /auth/resend-verification
   */
  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const user = await userService.findByEmail(email.toLowerCase().trim());
      if (!user || !user.isActive) {
        return res.json({
          success: true,
          message: 'If an account with that email exists, a verification email has been sent.'
        });
      }

      if (user.emailVerified) {
        return res.json({
          success: true,
          message: 'Email is already verified'
        });
      }

      // Generate new verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      await userService.updateEmailVerificationToken(user.id, emailVerificationToken);

      // Send verification email
      try {
        await notificationService.sendEmailVerification(
          user.email,
          user.firstName,
          emailVerificationToken
        );
      } catch (error) {
        logger.error('Failed to send verification email:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to send verification email'
        });
      }

      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      logger.error('Resend verification error:', error);
      next(new AppError('Failed to resend verification email', 500));
    }
  }
}

module.exports = new AuthController();