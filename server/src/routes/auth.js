const express = require('express');
const registrationService = require('../services/registration.service');
const loginService = require('../services/login.service');
const { requireAuth, optionalAuth } = require('../middleware/auth.middleware');
const { AppError } = require('../utils/errors.util');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    console.log('📝 Registration request received');
    
    const { firstName, lastName, email, password } = req.body;
    
    // Register user using registration service
    const newUser = await registrationService.registerUser({
      firstName,
      lastName,
      email,
      password
      // Removed niNumber - not needed yet
    });
    
    // Generate token for immediate login after registration
    const token = await loginService.generateAuthToken({
      account_id: newUser.accountId,
      first_name: newUser.firstName,
      last_name: newUser.lastName,
      email: newUser.email
    });
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token: token,
      user: newUser
    });
    
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      console.error('❌ Unexpected registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req, res) => {
  try {
    console.log('🔑 Login request received');
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Authenticate user using login service
    const loginResult = await loginService.login(email, password);
    
    res.json(loginResult);
    
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      console.error('❌ Unexpected login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/logout', optionalAuth, async (req, res) => {
  try {
    console.log('👋 Logout request received');
    
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace(/^Bearer\s+/, '') : null;
    
    const logoutResult = await loginService.logout(token);
    
    res.json(logoutResult);
    
  } catch (error) {
    // Always succeed logout for better UX
    res.json({
      success: true,
      message: 'Logout completed'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    console.log('👤 Profile request for user:', req.user.email);
    
    // Get fresh user data from database
    const userData = await loginService.findUserById(req.user.id);
    
    res.json({
      success: true,
      user: {
        accountId: userData.account_id,
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        createdAt: userData.created_at
      }
    });
    
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      console.error('❌ Unexpected profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

/**
 * POST /api/auth/verify-token
 * Verify if token is still valid
 */
router.post('/verify-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required',
        code: 'TOKEN_MISSING'
      });
    }

    const token = authHeader.replace(/^Bearer\s+/, '');
    const userData = await loginService.verifyToken(token);
    
    res.json({
      success: true,
      valid: true,
      user: userData
    });
    
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        valid: false,
        error: error.message,
        code: error.code
      });
    } else {
      res.status(401).json({
        success: false,
        valid: false,
        error: 'Invalid or expired token'
      });
    }
  }
});

/**
 * GET /api/auth/check-email/:email
 * Check if email is available for registration
 */
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    const isAvailable = await registrationService.isEmailAvailable(email);
    
    res.json({
      success: true,
      available: isAvailable,
      message: isAvailable ? 'Email is available' : 'Email is already registered'
    });
    
  } catch (error) {
    console.error('❌ Email check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/auth/password
 * Update user password
 */
router.put('/password', requireAuth, async (req, res) => {
  try {
    console.log('🔐 Password update request from user:', req.user.email);
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }
    
    await registrationService.updatePassword(req.user.id, currentPassword, newPassword);
    
    res.json({
      success: true,
      message: 'Password updated successfully'
    });
    
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      console.error('❌ Unexpected password update error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
});

/**
 * GET /api/auth/stats
 * Get authentication statistics (admin only - for future use)
 */
router.get('/stats', async (req, res) => {
  try {
    // TODO: Add admin authentication middleware in the future
    console.log('📊 Auth stats requested');
    
    const userStats = await registrationService.getUserStats();
    const loginStats = await loginService.getLoginStats();
    
    res.json({
      success: true,
      stats: {
        users: userStats,
        logins: loginStats
      }
    });
    
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;