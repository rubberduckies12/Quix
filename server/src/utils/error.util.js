const logger = require('./logger.util');
const { validationResult } = require('express-validator');

// =====================================================
// CORE ERROR CLASSES
// =====================================================

/**
 * Base application error class
 */
class AppError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} errorCode - Application-specific error code
   * @param {Object} details - Additional error details
   * @param {boolean} isOperational - Whether error is operational (expected)
   */
  constructor(message, statusCode = 500, errorCode = null, details = {}, isOperational = true) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.errorCode,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
        details: this.details,
        ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
      }
    };
  }
}

/**
 * Validation error for input validation failures
 */
class ValidationError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {Array} errors - Array of validation errors
   * @param {string} field - Field that failed validation
   */
  constructor(message = 'Validation failed', errors = [], field = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
    this.field = field;
    this.details = { errors, field };
  }

  /**
   * Create from Joi validation result
   */
  static fromJoi(joiError) {
    const errors = joiError.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    return new ValidationError('Validation failed', errors);
  }

  /**
   * Create from express-validator result
   */
  static fromExpressValidator(req) {
    const validationErrors = validationResult(req);
    if (validationErrors.isEmpty()) return null;

    const errors = validationErrors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    return new ValidationError('Validation failed', errors);
  }
}

/**
 * Authentication error for login/token failures
 */
class AuthenticationError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {string} reason - Specific reason for auth failure
   */
  constructor(message = 'Authentication required', reason = null) {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.reason = reason;
    this.details = { reason };
  }
}

/**
 * Authorization error for permission denied
 */
class AuthorizationError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {string} requiredPermission - Required permission
   * @param {string} resource - Resource being accessed
   */
  constructor(message = 'Access denied', requiredPermission = null, resource = null) {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.requiredPermission = requiredPermission;
    this.resource = resource;
    this.details = { requiredPermission, resource };
  }
}

/**
 * Not found error for missing resources
 */
class NotFoundError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {string} resource - Resource type that wasn't found
   * @param {string} identifier - Resource identifier
   */
  constructor(message = 'Resource not found', resource = null, identifier = null) {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.resource = resource;
    this.identifier = identifier;
    this.details = { resource, identifier };
  }
}

/**
 * Rate limit error with retry information
 */
class RateLimitError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {number} retryAfter - Seconds until retry allowed
   * @param {string} limitType - Type of rate limit (auth, api, upload)
   */
  constructor(message = 'Rate limit exceeded', retryAfter = 60, limitType = 'general') {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter;
    this.limitType = limitType;
    this.details = { retryAfter, limitType };
  }
}

/**
 * HMRC API error with specific handling
 */
class HMRCError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {string} hmrcErrorCode - HMRC-specific error code
   * @param {number} hmrcStatusCode - HMRC response status
   * @param {string} operation - HMRC operation that failed
   * @param {Object} context - Additional context
   */
  constructor(message, hmrcErrorCode, hmrcStatusCode = 502, operation = null, context = {}) {
    const userMessage = HMRCError.getUserFriendlyMessage(hmrcErrorCode, message);
    super(userMessage, 502, 'HMRC_ERROR');
    
    this.hmrcErrorCode = hmrcErrorCode;
    this.hmrcStatusCode = hmrcStatusCode;
    this.operation = operation;
    this.originalMessage = message;
    this.details = { 
      hmrcErrorCode, 
      hmrcStatusCode, 
      operation, 
      originalMessage: message,
      ...context 
    };
  }

  /**
   * Convert HMRC error codes to user-friendly messages
   */
  static getUserFriendlyMessage(errorCode, originalMessage) {
    const errorMessages = {
      'INVALID_UTR': 'The UTR provided is not valid. Please check and try again.',
      'NOT_FOUND': 'The requested information could not be found in HMRC systems.',
      'CLIENT_OR_AGENT_NOT_AUTHORISED': 'You are not authorised to access this information.',
      'INVALID_DATE_RANGE': 'The date range provided is not valid.',
      'INVALID_TAX_YEAR': 'The tax year provided is not valid.',
      'QUARTERLY_PERIOD_NOT_ENDED': 'The quarterly period has not ended yet.',
      'EARLY_SUBMISSION': 'This submission is too early. Please wait until the period has ended.',
      'LATE_SUBMISSION': 'This submission is late. Additional penalties may apply.',
      'DUPLICATE_SUBMISSION': 'A submission for this period has already been made.',
      'INVALID_PAYLOAD': 'The submission data format is incorrect.',
      'SERVICE_UNAVAILABLE': 'HMRC services are temporarily unavailable. Please try again later.',
      'INTERNAL_SERVER_ERROR': 'HMRC services are experiencing issues. Please try again later.',
      'TOO_MANY_REQUESTS': 'Too many requests to HMRC. Please wait before trying again.',
      'UNAUTHORIZED': 'Your HMRC authorization has expired. Please re-authorize your account.',
      'FORBIDDEN': 'Access to this HMRC service is forbidden.',
      'MATCHING_FAILED': 'Unable to match your details with HMRC records.',
      'INVALID_NINO': 'The National Insurance number is not valid.',
      'INVALID_CALCULATION_ID': 'The calculation ID is not valid.',
      'NO_SUBMISSION_EXIST': 'No submission exists for this period.',
      'INVALID_CORRELATIONID': 'Invalid correlation ID in the request.'
    };

    return errorMessages[errorCode] || originalMessage || 'An error occurred while communicating with HMRC.';
  }

  /**
   * Create HMRC error from API response
   */
  static fromResponse(response, operation = null) {
    const { status, data } = response;
    let errorCode = 'UNKNOWN_ERROR';
    let message = 'Unknown HMRC error';

    if (data && data.code) {
      errorCode = data.code;
      message = data.message || message;
    }

    return new HMRCError(message, errorCode, status, operation, {
      response: {
        status,
        headers: response.headers,
        data: data
      }
    });
  }
}

/**
 * File processing error for spreadsheet operations
 */
class FileProcessingError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {string} fileName - Name of file being processed
   * @param {number} row - Row number where error occurred
   * @param {string} column - Column where error occurred
   * @param {Object} context - Additional context
   */
  constructor(message, fileName = null, row = null, column = null, context = {}) {
    super(message, 400, 'FILE_PROCESSING_ERROR');
    this.fileName = fileName;
    this.row = row;
    this.column = column;
    this.details = { fileName, row, column, ...context };
  }
}

/**
 * Database operation error
 */
class DatabaseError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {string} operation - Database operation
   * @param {string} table - Database table
   * @param {Object} context - Additional context
   */
  constructor(message, operation = null, table = null, context = {}) {
    super(message, 500, 'DATABASE_ERROR');
    this.operation = operation;
    this.table = table;
    this.details = { operation, table, ...context };
  }

  /**
   * Create from Sequelize error
   */
  static fromSequelize(error, operation = null) {
    let message = 'Database operation failed';
    let statusCode = 500;

    // Handle specific Sequelize errors
    switch (error.name) {
      case 'SequelizeValidationError':
        statusCode = 400;
        message = 'Data validation failed';
        const validationErrors = error.errors.map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }));
        return new ValidationError(message, validationErrors);

      case 'SequelizeUniqueConstraintError':
        statusCode = 409;
        message = 'A record with this information already exists';
        break;

      case 'SequelizeForeignKeyConstraintError':
        statusCode = 400;
        message = 'Referenced record does not exist';
        break;

      case 'SequelizeConnectionError':
        message = 'Database connection failed';
        break;

      case 'SequelizeTimeoutError':
        message = 'Database operation timed out';
        break;

      default:
        message = error.message || message;
    }

    return new DatabaseError(message, operation, error.table, {
      sequelizeError: error.name,
      originalMessage: error.message
    });
  }
}

// =====================================================
// ERROR UTILITIES
// =====================================================

/**
 * Sanitize sensitive data from error objects and logs
 */
class ErrorSanitizer {
  static sensitiveFields = [
    'password', 'token', 'accessToken', 'refreshToken', 'authorization',
    'utr', 'niNumber', 'vatNumber', 'bankAccount', 'sortCode',
    'email', 'phone', 'address', 'postcode'
  ];

  /**
   * Sanitize object for logging
   */
  static sanitize(obj, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth || obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitize(item, maxDepth, currentDepth + 1));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = this.maskValue(value);
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitize(value, maxDepth, currentDepth + 1);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if field name is sensitive
   */
  static isSensitiveField(fieldName) {
    const lowerField = fieldName.toLowerCase();
    return this.sensitiveFields.some(sensitive => 
      lowerField.includes(sensitive.toLowerCase())
    );
  }

  /**
   * Mask sensitive values
   */
  static maskValue(value) {
    if (!value) return value;
    
    const str = String(value);
    if (str.length <= 4) return '***';
    
    return str.substring(0, 2) + '*'.repeat(Math.max(str.length - 4, 3)) + str.substring(str.length - 2);
  }
}

/**
 * Async error handler wrapper for Express routes
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create standardized error response
 */
const createErrorResponse = (error, req) => {
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.errorCode || 'UNKNOWN_ERROR',
      statusCode: error.statusCode || 500,
      timestamp: error.timestamp || new Date().toISOString()
    }
  };

  // Add request ID if available
  if (req.id) {
    response.error.requestId = req.id;
  }

  // Add specific error details
  if (error instanceof ValidationError) {
    response.error.validation = error.errors;
  }

  if (error instanceof RateLimitError) {
    response.error.retryAfter = error.retryAfter;
  }

  if (error instanceof HMRCError) {
    response.error.hmrc = {
      code: error.hmrcErrorCode,
      operation: error.operation
    };
  }

  if (error instanceof FileProcessingError) {
    response.error.file = {
      name: error.fileName,
      row: error.row,
      column: error.column
    };
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
};

// =====================================================
// EXPRESS MIDDLEWARE
// =====================================================

/**
 * Global error handler middleware
 */
const errorHandler = (error, req, res, next) => {
  let processedError = error;

  // Convert non-AppError instances to AppError
  if (!(error instanceof AppError)) {
    processedError = convertToAppError(error);
  }

  // Log error with context
  logErrorWithContext(processedError, req);

  // Create response
  const response = createErrorResponse(processedError, req);

  // Set retry-after header for rate limit errors
  if (processedError instanceof RateLimitError) {
    res.set('Retry-After', processedError.retryAfter);
  }

  // Send response
  res.status(processedError.statusCode).json(response);
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(
    `Route ${req.method} ${req.originalUrl} not found`,
    'route',
    req.originalUrl
  );
  next(error);
};

/**
 * Convert various error types to AppError
 */
const convertToAppError = (error) => {
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token', 'INVALID_TOKEN');
  }

  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired', 'TOKEN_EXPIRED');
  }

  // Multer file upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new ValidationError('File size too large', [{
      field: 'file',
      message: 'File exceeds maximum allowed size',
      limit: error.limit
    }]);
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return new ValidationError('Too many files', [{
      field: 'files',
      message: 'Exceeds maximum file count',
      limit: error.limit
    }]);
  }

  // Database errors
  if (error.name && error.name.startsWith('Sequelize')) {
    return DatabaseError.fromSequelize(error);
  }

  // PostgreSQL errors
  if (error.code) {
    switch (error.code) {
      case '23505': // Unique violation
        return new ValidationError('Duplicate value', [{
          field: error.constraint,
          message: 'Value already exists'
        }]);
      
      case '23503': // Foreign key violation
        return new ValidationError('Invalid reference', [{
          field: error.constraint,
          message: 'Referenced record does not exist'
        }]);
      
      case '23502': // Not null violation
        return new ValidationError('Missing required field', [{
          field: error.column,
          message: 'Field is required'
        }]);
    }
  }

  // Default to generic server error
  return new AppError(
    process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    500,
    'INTERNAL_ERROR',
    {},
    false
  );
};

/**
 * Log error with request context
 */
const logErrorWithContext = (error, req) => {
  const context = {
    error: {
      name: error.name,
      message: error.message,
      code: error.errorCode,
      statusCode: error.statusCode,
      stack: error.stack
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id
    }
  };

  // Add user context if available
  if (req.user) {
    context.user = {
      id: req.user.id,
      email: ErrorSanitizer.maskValue(req.user.email)
    };
  }

  // Add request body (sanitized)
  if (req.body && Object.keys(req.body).length > 0) {
    context.request.body = ErrorSanitizer.sanitize(req.body);
  }

  // Log with appropriate level
  const logLevel = error.statusCode >= 500 ? 'error' : 'warn';
  logger.log(logLevel, `${error.name}: ${error.message}`, context);

  // Log security events
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    logger.logSecurity(`Security event: ${error.name}`, {
      ...context,
      reason: error.reason || error.requiredPermission
    });
  }

  // Log HMRC events
  if (error instanceof HMRCError) {
    logger.logHMRC(`HMRC error: ${error.hmrcErrorCode}`, {
      ...context,
      operation: error.operation,
      hmrcStatusCode: error.hmrcStatusCode
    });
  }
};

// =====================================================
// VALIDATION HELPERS
// =====================================================

/**
 * Create validation error from Joi result
 */
const handleJoiValidation = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    throw ValidationError.fromJoi(error);
  }
  return value;
};

/**
 * Middleware to validate request using express-validator
 */
const validateRequest = (req, res, next) => {
  const error = ValidationError.fromExpressValidator(req);
  if (error) {
    return next(error);
  }
  next();
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  HMRCError,
  FileProcessingError,
  DatabaseError,

  // Utilities
  ErrorSanitizer,
  asyncHandler,
  createErrorResponse,

  // Middleware
  errorHandler,
  notFoundHandler,
  validateRequest,

  // Helpers
  handleJoiValidation,
  convertToAppError,
  logErrorWithContext
};