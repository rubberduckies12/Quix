/**
 * Comprehensive Error Utility for MTD Tax Bridge Application
 * Provides standardized error handling, custom error classes, and middleware
 */

// ====== CUSTOM ERROR CLASSES ======

/**
 * Base application error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      timestamp: this.timestamp
    };
  }
}

/**
 * Validation error for input validation failures (400 status)
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = [], field = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
    this.field = field;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors,
      field: this.field
    };
  }
}

/**
 * Authentication error for login/token issues (401 status)
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization error for permission issues (403 status)
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Not found error for missing resources (404 status)
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found', resource = null) {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.resource = resource;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      resource: this.resource
    };
  }
}

/**
 * File processing error for spreadsheet parsing issues
 */
class FileProcessingError extends AppError {
  constructor(message = 'File processing failed', fileName = null, details = {}) {
    super(message, 422, 'FILE_PROCESSING_ERROR');
    this.fileName = fileName;
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      fileName: this.fileName,
      details: this.details
    };
  }
}

/**
 * HMRC API error for government service failures
 */
class HMRCError extends AppError {
  constructor(message = 'HMRC service error', hmrcCode = null, endpoint = null) {
    super(message, 502, 'HMRC_ERROR');
    this.hmrcCode = hmrcCode;
    this.endpoint = endpoint;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      hmrcCode: this.hmrcCode,
      endpoint: this.endpoint
    };
  }
}

/**
 * Rate limit error for API throttling
 */
class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', retryAfter = null) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter
    };
  }
}

/**
 * Database error for database operation failures
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', operation = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.operation = operation;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation
    };
  }
}

// ====== ERROR RESPONSE FORMATTING ======

/**
 * Format error response for API responses
 * @param {Error} error - Error object to format
 * @param {Object} req - Express request object (optional)
 * @returns {Object} Standardized error response
 */
function formatErrorResponse(error, req = null) {
  const response = {
    success: false,
    error: {
      message: error.message || 'An error occurred',
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    }
  };

  // Add status code for HTTP responses
  if (error.statusCode) {
    response.error.statusCode = error.statusCode;
  }

  // Add specific error details for known error types
  if (error instanceof ValidationError) {
    response.error.type = 'validation';
    response.error.errors = error.errors;
    if (error.field) {
      response.error.field = error.field;
    }
  } else if (error instanceof FileProcessingError) {
    response.error.type = 'file_processing';
    response.error.fileName = error.fileName;
    response.error.details = error.details;
  } else if (error instanceof HMRCError) {
    response.error.type = 'hmrc_service';
    response.error.hmrcCode = error.hmrcCode;
    response.error.endpoint = error.endpoint;
  } else if (error instanceof NotFoundError) {
    response.error.type = 'not_found';
    response.error.resource = error.resource;
  } else if (error instanceof RateLimitError) {
    response.error.type = 'rate_limit';
    response.error.retryAfter = error.retryAfter;
  } else if (error instanceof DatabaseError) {
    response.error.type = 'database';
    response.error.operation = error.operation;
  } else {
    response.error.type = 'general';
  }

  // Add request context if available
  if (req) {
    response.error.requestId = req.id || req.headers['x-request-id'];
    response.error.path = req.path;
    response.error.method = req.method;
  }

  // Add helpful suggestions for common errors
  response.error.suggestion = createHelpfulSuggestion(error);

  return response;
}

/**
 * Convert technical errors to user-friendly messages
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 */
function createUserFriendlyMessage(error) {
  const friendlyMessages = {
    // Validation errors
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'INVALID_EMAIL': 'Please enter a valid email address.',
    'INVALID_PASSWORD': 'Password must be at least 8 characters long and contain letters and numbers.',
    'INVALID_UTR': 'Please enter a valid 10-digit UTR (Unique Taxpayer Reference).',
    'INVALID_POSTCODE': 'Please enter a valid UK postcode.',
    
    // Authentication errors
    'AUTHENTICATION_ERROR': 'Please log in to access this feature.',
    'INVALID_CREDENTIALS': 'Email or password is incorrect. Please try again.',
    'TOKEN_EXPIRED': 'Your session has expired. Please log in again.',
    
    // File processing errors
    'FILE_PROCESSING_ERROR': 'There was a problem processing your file. Please check the format and try again.',
    'INVALID_FILE_TYPE': 'Please upload an Excel (.xlsx, .xls) or CSV file.',
    'FILE_TOO_LARGE': 'File is too large. Please use a file smaller than 10MB.',
    'MISSING_COLUMNS': 'Your spreadsheet is missing required columns. Please check the template.',
    
    // HMRC errors
    'HMRC_ERROR': 'Unable to connect to HMRC services. Please try again later.',
    'HMRC_MAINTENANCE': 'HMRC services are currently undergoing maintenance. Please try again later.',
    
    // General errors
    'NOT_FOUND_ERROR': 'The requested information could not be found.',
    'RATE_LIMIT_ERROR': 'Too many requests. Please wait a moment and try again.',
    'DATABASE_ERROR': 'A temporary system error occurred. Please try again.',
    'NETWORK_ERROR': 'Connection problem. Please check your internet connection and try again.'
  };

  // Get specific message or fallback to error message
  const friendlyMessage = friendlyMessages[error.code] || 
                         friendlyMessages[error.name] || 
                         error.message ||
                         'An unexpected error occurred. Please try again.';

  return friendlyMessage;
}

/**
 * Create helpful suggestion for error resolution
 * @param {Error} error - Error object
 * @returns {string} Helpful suggestion
 */
function createHelpfulSuggestion(error) {
  const suggestions = {
    'VALIDATION_ERROR': 'Review the highlighted fields and correct any errors.',
    'AUTHENTICATION_ERROR': 'Try refreshing the page or logging in again.',
    'FILE_PROCESSING_ERROR': 'Check that your file follows the correct format. Download our template for guidance.',
    'HMRC_ERROR': 'HMRC services may be temporarily unavailable. Try again in a few minutes.',
    'NOT_FOUND_ERROR': 'Check the URL or navigate back to the main page.',
    'RATE_LIMIT_ERROR': 'Wait a few minutes before making another request.',
    'DATABASE_ERROR': 'If the problem persists, please contact support.'
  };

  return suggestions[error.code] || suggestions[error.name] || 'Contact support if the problem continues.';
}

/**
 * Remove sensitive data from error before logging
 * @param {Error} error - Error object to sanitize
 * @param {Object} context - Additional context to sanitize
 * @returns {Object} Sanitized error information
 */
function sanitizeErrorForLogging(error, context = {}) {
  const sensitiveFields = [
    'password', 'token', 'apiKey', 'secret', 'credential',
    'authorization', 'cookie', 'session', 'utr', 'niNumber'
  ];

  const sanitized = {
    name: error.name,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    stack: error.stack,
    timestamp: error.timestamp || new Date().toISOString()
  };

  // Add error-specific properties
  if (error instanceof ValidationError) {
    sanitized.errors = error.errors;
    sanitized.field = error.field;
  }

  // Sanitize context
  const sanitizedContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitizedContext[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitizedContext[key] = sanitizeObject(value, sensitiveFields);
    } else {
      sanitizedContext[key] = value;
    }
  }

  sanitized.context = sanitizedContext;
  return sanitized;
}

/**
 * Sanitize object by removing sensitive fields
 * @private
 */
function sanitizeObject(obj, sensitiveFields) {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, sensitiveFields);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ====== ERROR HANDLING MIDDLEWARE ======

/**
 * Global error handler middleware for Express
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function globalErrorHandler(logger = console) {
  return (err, req, res, next) => {
    // Log error with context
    logError(err, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      requestId: req.id
    }, logger);

    // Track error metrics
    trackErrorMetrics(err);

    // Handle different error types
    let statusCode = 500;
    let errorResponse;

    if (err instanceof AppError) {
      statusCode = err.statusCode;
      errorResponse = formatErrorResponse(err, req);
    } else if (err.name === 'ValidationError') {
      // Mongoose validation error
      const validationError = new ValidationError('Validation failed', 
        Object.values(err.errors).map(e => ({ field: e.path, message: e.message }))
      );
      statusCode = 400;
      errorResponse = formatErrorResponse(validationError, req);
    } else if (err.name === 'CastError') {
      // Mongoose cast error (invalid ObjectId)
      const notFoundError = new NotFoundError('Invalid ID format');
      statusCode = 400;
      errorResponse = formatErrorResponse(notFoundError, req);
    } else if (err.code === 11000) {
      // Mongoose duplicate key error
      const duplicateError = new ValidationError('Duplicate entry found');
      statusCode = 400;
      errorResponse = formatErrorResponse(duplicateError, req);
    } else {
      // Unknown error - don't leak details in production
      const genericError = process.env.NODE_ENV === 'production' 
        ? new AppError('Something went wrong')
        : err;
      errorResponse = formatErrorResponse(genericError, req);
    }

    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Wrapper for async route handlers to catch errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
function asyncErrorWrapper(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle 404 routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
}

// ====== VALIDATION ERROR HELPERS ======

/**
 * Process validation error arrays into standardized format
 * @param {Array} errors - Array of validation errors
 * @returns {ValidationError} Formatted validation error
 */
function handleValidationErrors(errors) {
  if (!Array.isArray(errors)) {
    return new ValidationError('Invalid validation errors format');
  }

  const formattedErrors = errors.map(error => ({
    field: error.field || error.path || 'unknown',
    message: error.message || error.error || 'Validation failed',
    code: error.code || 'INVALID_VALUE',
    value: error.value
  }));

  const message = `Validation failed for ${formattedErrors.length} field${formattedErrors.length !== 1 ? 's' : ''}`;
  
  return new ValidationError(message, formattedErrors);
}

/**
 * Create individual field error
 * @param {string} field - Field name
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {*} value - Invalid value
 * @returns {Object} Field error object
 */
function createFieldError(field, message, code = 'INVALID_VALUE', value = null) {
  return {
    field,
    message,
    code,
    value
  };
}

/**
 * Combine multiple validation errors
 * @param {...Array} errorArrays - Multiple arrays of errors
 * @returns {ValidationError} Combined validation error
 */
function aggregateErrors(...errorArrays) {
  const allErrors = errorArrays.flat().filter(Boolean);
  
  if (allErrors.length === 0) {
    return null;
  }

  return handleValidationErrors(allErrors);
}

// ====== LOGGING INTEGRATION ======

/**
 * Log error with request context
 * @param {Error} error - Error to log
 * @param {Object} context - Request context
 * @param {Object} logger - Logger instance
 */
function logError(error, context = {}, logger = console) {
  const sanitizedError = sanitizeErrorForLogging(error, context);
  
  // Determine log level based on error type
  const logLevel = error.statusCode >= 500 ? 'error' : 'warn';
  
  const logMessage = {
    level: logLevel,
    message: error.message,
    error: sanitizedError,
    timestamp: new Date().toISOString()
  };

  if (logger[logLevel]) {
    logger[logLevel]('Application Error:', logMessage);
  } else {
    logger.log('Application Error:', logMessage);
  }
}

/**
 * Track error metrics for monitoring
 * @param {Error} error - Error to track
 */
function trackErrorMetrics(error) {
  // This would integrate with your metrics system (e.g., Prometheus, DataDog)
  if (typeof global.errorMetrics === 'undefined') {
    global.errorMetrics = {};
  }

  const errorType = error.constructor.name;
  const errorCode = error.code || 'UNKNOWN';

  // Increment error counters
  global.errorMetrics[errorType] = (global.errorMetrics[errorType] || 0) + 1;
  global.errorMetrics[`code_${errorCode}`] = (global.errorMetrics[`code_${errorCode}`] || 0) + 1;

  // Track by status code
  if (error.statusCode) {
    global.errorMetrics[`status_${error.statusCode}`] = 
      (global.errorMetrics[`status_${error.statusCode}`] || 0) + 1;
  }
}

/**
 * Get error metrics summary
 * @returns {Object} Error metrics
 */
function getErrorMetrics() {
  return global.errorMetrics || {};
}

/**
 * Reset error metrics
 */
function resetErrorMetrics() {
  global.errorMetrics = {};
}

// ====== UTILITY FUNCTIONS ======

/**
 * Check if error is operational (expected) vs programming error
 * @param {Error} error - Error to check
 * @returns {boolean} True if operational error
 */
function isOperationalError(error) {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Create error from HTTP status code
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {AppError} Appropriate error instance
 */
function createErrorFromStatusCode(statusCode, message = null) {
  const defaultMessages = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };

  const errorMessage = message || defaultMessages[statusCode] || 'Unknown Error';

  switch (statusCode) {
    case 400:
      return new ValidationError(errorMessage);
    case 401:
      return new AuthenticationError(errorMessage);
    case 403:
      return new AuthorizationError(errorMessage);
    case 404:
      return new NotFoundError(errorMessage);
    case 422:
      return new FileProcessingError(errorMessage);
    case 429:
      return new RateLimitError(errorMessage);
    case 502:
      return new HMRCError(errorMessage);
    default:
      return new AppError(errorMessage, statusCode);
  }
}

// Export all error classes and utilities
module.exports = {
  // Error Classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  FileProcessingError,
  HMRCError,
  RateLimitError,
  DatabaseError,
  
  // Error Response Formatting
  formatErrorResponse,
  createUserFriendlyMessage,
  sanitizeErrorForLogging,
  
  // Error Handling Middleware
  globalErrorHandler,
  asyncErrorWrapper,
  notFoundHandler,
  
  // Validation Error Helpers
  handleValidationErrors,
  createFieldError,
  aggregateErrors,
  
  // Logging Integration
  logError,
  trackErrorMetrics,
  getErrorMetrics,
  resetErrorMetrics,
  
  // Utility Functions
  isOperationalError,
  createErrorFromStatusCode
};