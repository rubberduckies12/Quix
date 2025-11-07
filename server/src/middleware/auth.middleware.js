const authTokenUtil = require('../utils/generate-auth-token.util');

/**
 * Authentication middleware - requires valid JWT token
 */
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required'
      });
    }

    // Verify the token
    const decoded = authTokenUtil.verifyToken(authHeader);
    
    // Add user data to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName
    };
    
    console.log('✅ User authenticated:', req.user.email);
    next();
    
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

/**
 * Optional authentication middleware - adds user data if token is valid
 * Doesn't fail if no token is provided
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      req.user = null;
      return next();
    }

    const decoded = authTokenUtil.verifyToken(authHeader);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName
    };
    
    console.log('✅ Optional auth - User found:', req.user.email);
    next();
    
  } catch (error) {
    // For optional auth, we don't fail - just set user to null
    console.log('ℹ️ Optional auth - Invalid token, continuing without user');
    req.user = null;
    next();
  }
};

module.exports = {
  requireAuth,
  optionalAuth
};