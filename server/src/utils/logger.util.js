const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, userId, email, ip, ...meta } = info;
    
    let logMessage = `${timestamp} [${level}]`;
    
    if (service) {
      logMessage += ` [${service}]`;
    }
    
    logMessage += `: ${message}`;
    
    // Add context information
    const context = [];
    if (userId) context.push(`userId=${userId}`);
    if (email) context.push(`email=${email}`);
    if (ip) context.push(`ip=${ip}`);
    
    if (context.length > 0) {
      logMessage += ` | ${context.join(', ')}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` | ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    return JSON.stringify({
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: info.service || 'mtd-tax-bridge',
      ...info
    });
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  defaultMeta: { 
    service: 'mtd-tax-bridge',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
    }),
    
    // Error file transport
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Combined file transport
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // HTTP requests log
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      level: 'http',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat
    })
  ]
});

// Add custom methods for specific use cases
logger.logAuth = (message, data = {}) => {
  logger.info(message, {
    category: 'auth',
    ...data
  });
};

logger.logDatabase = (message, data = {}) => {
  logger.debug(message, {
    category: 'database',
    ...data
  });
};

logger.logHMRC = (message, data = {}) => {
  logger.info(message, {
    category: 'hmrc',
    ...data
  });
};

logger.logProcessing = (message, data = {}) => {
  logger.info(message, {
    category: 'processing',
    ...data
  });
};

logger.logSecurity = (message, data = {}) => {
  logger.warn(message, {
    category: 'security',
    ...data
  });
};

logger.logAudit = (action, data = {}) => {
  logger.info(`AUDIT: ${action}`, {
    category: 'audit',
    action,
    timestamp: new Date().toISOString(),
    ...data
  });
};

// HTTP request logger middleware
logger.httpLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.http(`${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    sessionId: req.sessionID
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.url} - ${res.statusCode}`, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id
    });
  });
  
  next();
};

// Performance logger
logger.logPerformance = (operation, duration, data = {}) => {
  const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
  logger.log(level, `Performance: ${operation} took ${duration}ms`, {
    category: 'performance',
    operation,
    duration,
    ...data
  });
};

// Error logger with context
logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    ...context
  });
};

// Structured logging for different environments
if (process.env.NODE_ENV === 'production') {
  // In production, add additional structured logging
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'audit.log'),
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
      winston.format.printf((info) => {
        if (info.category === 'audit') {
          return JSON.stringify({
            timestamp: info.timestamp,
            level: info.level,
            action: info.action,
            userId: info.userId,
            ip: info.ip,
            details: info
          });
        }
        return JSON.stringify(info);
      })
    ),
    maxsize: 10485760, // 10MB for audit logs
    maxFiles: 20
  }));
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  logger.end();
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  logger.end();
});

module.exports = logger;