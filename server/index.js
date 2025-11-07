const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Import database connection
const { testConnection } = require('./src/database/utilities/dbconnect');

// Import routes
const filesRoutes = require('./src/routes/files');
const submissionsRoutes = require('./src/routes/submissions');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Request parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Compression for better performance
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Quix MTD API',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/files', filesRoutes);
app.use('/api/submissions', submissionsRoutes);

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Quix MTD API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      files: '/api/files',
      upload: '/api/files/process',
      config: '/api/files/config'
    }
  });
});

// 404 handler - FIXED: Use (req, res, next) instead of app.use('*', ...)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    console.log('🔄 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Failed to connect to database');
      process.exit(1);
    }

    // Start HTTP server
    app.listen(PORT, () => {
      console.log('🚀 Server started successfully!');
      console.log(`📍 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}`);
      console.log('📋 Available endpoints:');
      console.log(`   GET  /health - Health check`);
      console.log(`   GET  /api/files/config - Upload configuration`);
      console.log(`   POST /api/files/process - Process spreadsheet`);
      console.log(`   POST /api/files/validate - Validate file`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;