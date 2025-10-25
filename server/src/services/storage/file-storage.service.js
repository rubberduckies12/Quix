// filepath: /Users/tommyrowe/Documents/development/projects/active/quix/server/src/services/storage/file-storage.service.js

const { Storage } = require('@google-cloud/storage');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const crypto = require('crypto');
const path = require('path');
const mime = require('mime-types');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const sharp = require('sharp');
const { promisify } = require('util');
const fs = require('fs');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

const logger = require('../../utils/logger.util');
const DateUtil = require('../../utils/date.util');
const { ValidationError, AppError, SecurityError } = require('../../utils/error.util');
const CacheService = require('../cache.service');
const QueueService = require('../queue.service');
const NotificationService = require('../notification.service');
const AuditService = require('../audit.service');
const VirusScanService = require('../security/virus-scan.service');
const UserService = require('../user.service');

/**
 * Comprehensive File Storage Service for MTD Tax Bridge
 * Handles secure file upload, storage, and processing with Google Cloud Storage
 */
class FileStorageService {
  constructor() {
    this.initializeServices();
    this.initializeStorage();
    this.initializeConfiguration();
    this.setupFileProcessingQueue();
  }

  /**
   * Initialize dependent services
   */
  initializeServices() {
    this.cacheService = new CacheService();
    this.queueService = new QueueService();
    this.notificationService = new NotificationService();
    this.auditService = new AuditService();
    this.virusScanService = new VirusScanService();
    this.userService = new UserService();
  }

  /**
   * Initialize Google Cloud Storage
   */
  initializeStorage() {
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE
    });

    // Environment-specific bucket configuration
    this.buckets = {
      development: process.env.GCS_BUCKET_DEV || 'quix-files-dev',
      staging: process.env.GCS_BUCKET_STAGING || 'quix-files-staging',
      production: process.env.GCS_BUCKET_PROD || 'quix-files-prod'
    };

    this.currentBucket = this.buckets[process.env.NODE_ENV] || this.buckets.development;
    this.bucket = this.storage.bucket(this.currentBucket);
  }

  /**
   * Initialize service configuration
   */
  initializeConfiguration() {
    this.config = {
      // File size limits (in bytes)
      maxFileSizes: {
        spreadsheet: 10 * 1024 * 1024, // 10MB
        image: 5 * 1024 * 1024,        // 5MB
        pdf: 25 * 1024 * 1024,         // 25MB
        default: 10 * 1024 * 1024       // 10MB
      },

      // Supported file types
      supportedTypes: {
        spreadsheet: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
          'text/csv' // .csv
        ],
        image: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp'
        ],
        pdf: [
          'application/pdf'
        ]
      },

      // Magic number validation for security
      magicNumbers: {
        'image/jpeg': [0xFF, 0xD8, 0xFF],
        'image/png': [0x89, 0x50, 0x4E, 0x47],
        'application/pdf': [0x25, 0x50, 0x44, 0x46],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4B, 0x03, 0x04]
      },

      // File retention policies (in days)
      retentionPolicies: {
        tax_documents: 7 * 365, // 7 years
        receipts: 7 * 365,      // 7 years
        spreadsheets: 7 * 365,  // 7 years
        temporary: 30,          // 30 days
        failed_uploads: 7       // 7 days
      },

      // Storage classes for lifecycle management
      storageClasses: {
        hot: 'STANDARD',
        warm: 'NEARLINE',
        cold: 'COLDLINE',
        archive: 'ARCHIVE'
      },

      // Rate limiting
      rateLimits: {
        uploadsPerHour: 50,
        downloadsPerHour: 200,
        totalSizePerDay: 100 * 1024 * 1024 // 100MB
      }
    };
  }

  /**
   * Setup file processing queue
   */
  setupFileProcessingQueue() {
    this.queueService.createQueue('file-processing', {
      concurrency: 5,
      retries: 3,
      backoff: 'exponential'
    });

    this.queueService.process('file-processing', this.processUploadedFile.bind(this));
  }

  // =====================================================
  // MAIN FILE OPERATIONS
  // =====================================================

  /**
   * Upload file with comprehensive security and metadata handling
   * @param {Object} file - Multer file object or file buffer
   * @param {string} userId - User ID for isolation
   * @param {Object} metadata - Additional file metadata
   * @returns {Object} Upload result with file information
   */
  async uploadFile(file, userId, metadata = {}) {
    try {
      // Validate user and rate limits
      await this.validateUserAccess(userId);
      await this.checkRateLimits(userId, 'upload');

      // Validate file
      const validationResult = await this.validateFile(file, metadata.fileType);
      if (!validationResult.valid) {
        throw new ValidationError(`File validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Generate secure file path
      const fileId = this.generateFileId();
      const securePath = this.generateSecureFilePath(userId, fileId, file.originalname);

      // Calculate file hash for deduplication
      const fileHash = await this.calculateFileHash(file.buffer || file.path);
      
      // Check for duplicates
      const existingFile = await this.findDuplicateFile(userId, fileHash);
      if (existingFile && metadata.allowDuplicates !== true) {
        logger.logInfo('Duplicate file detected', { userId, fileHash, existingFileId: existingFile.id });
        return {
          success: true,
          fileId: existingFile.id,
          isDuplicate: true,
          message: 'File already exists'
        };
      }

      // Scan for viruses
      const virusScanResult = await this.virusScanService.scanFile(file.buffer || file.path);
      if (!virusScanResult.clean) {
        throw new SecurityError('File failed virus scan', 'VIRUS_DETECTED', {
          threats: virusScanResult.threats
        });
      }

      // Prepare file metadata
      const fileMetadata = {
        id: fileId,
        userId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        hash: fileHash,
        uploadedAt: new Date(),
        status: 'uploaded',
        fileType: metadata.fileType || this.detectFileType(file.mimetype),
        tags: metadata.tags || [],
        description: metadata.description || '',
        version: 1,
        processingStatus: 'pending',
        ...metadata
      };

      // Upload to Google Cloud Storage
      const gcsFile = this.bucket.file(securePath);
      const uploadResult = await this.performCloudUpload(gcsFile, file, fileMetadata);

      // Store metadata in database
      await this.storeFileMetadata(fileMetadata);

      // Queue for background processing
      await this.queueFileForProcessing(fileId, userId, fileMetadata.fileType);

      // Audit the upload
      await this.auditService.logFileOperation({
        action: 'upload',
        userId,
        fileId,
        fileName: file.originalname,
        fileSize: file.size,
        success: true
      });

      logger.logInfo('File uploaded successfully', {
        userId,
        fileId,
        fileName: file.originalname,
        size: file.size,
        type: fileMetadata.fileType
      });

      return {
        success: true,
        fileId,
        fileName: file.originalname,
        size: file.size,
        type: fileMetadata.fileType,
        uploadedAt: fileMetadata.uploadedAt,
        processingStatus: 'queued',
        signedUrl: uploadResult.signedUrl
      };

    } catch (error) {
      logger.logError('File upload failed', {
        userId,
        fileName: file?.originalname,
        error: error.message
      });

      await this.auditService.logFileOperation({
        action: 'upload',
        userId,
        fileName: file?.originalname,
        success: false,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Download file with access control and audit logging
   * @param {string} fileId - File ID
   * @param {string} userId - Requesting user ID
   * @param {Object} options - Download options
   * @returns {Object} Download result with stream or signed URL
   */
  async downloadFile(fileId, userId, options = {}) {
    try {
      // Validate access
      await this.validateUserAccess(userId);
      await this.checkRateLimits(userId, 'download');

      // Get file metadata
      const fileMetadata = await this.getFileMetadata(fileId);
      if (!fileMetadata) {
        throw new ValidationError('File not found');
      }

      // Check ownership
      if (fileMetadata.userId !== userId) {
        throw new SecurityError('Access denied', 'UNAUTHORIZED_FILE_ACCESS');
      }

      // Check if file exists in storage
      const filePath = this.generateSecureFilePath(userId, fileId, fileMetadata.originalName);
      const gcsFile = this.bucket.file(filePath);
      const [exists] = await gcsFile.exists();

      if (!exists) {
        throw new ValidationError('File not found in storage');
      }

      let result;

      if (options.generateSignedUrl) {
        // Generate signed URL for direct download
        result = await this.generateSignedURL(fileId, options.expirationTime);
      } else {
        // Stream file directly
        const downloadStream = gcsFile.createReadStream();
        result = {
          stream: downloadStream,
          metadata: fileMetadata
        };
      }

      // Audit the download
      await this.auditService.logFileOperation({
        action: 'download',
        userId,
        fileId,
        fileName: fileMetadata.originalName,
        success: true,
        method: options.generateSignedUrl ? 'signed_url' : 'stream'
      });

      logger.logInfo('File downloaded', {
        userId,
        fileId,
        fileName: fileMetadata.originalName,
        method: options.generateSignedUrl ? 'signed_url' : 'stream'
      });

      return result;

    } catch (error) {
      logger.logError('File download failed', {
        userId,
        fileId,
        error: error.message
      });

      await this.auditService.logFileOperation({
        action: 'download',
        userId,
        fileId,
        success: false,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Delete file with audit trail
   * @param {string} fileId - File ID
   * @param {string} userId - Requesting user ID
   * @param {Object} options - Deletion options
   * @returns {Object} Deletion result
   */
  async deleteFile(fileId, userId, options = {}) {
    try {
      // Validate access
      await this.validateUserAccess(userId);

      // Get file metadata
      const fileMetadata = await this.getFileMetadata(fileId);
      if (!fileMetadata) {
        throw new ValidationError('File not found');
      }

      // Check ownership
      if (fileMetadata.userId !== userId) {
        throw new SecurityError('Access denied', 'UNAUTHORIZED_FILE_ACCESS');
      }

      // Check if file is under legal hold
      if (fileMetadata.legalHold) {
        throw new ValidationError('File is under legal hold and cannot be deleted');
      }

      // Soft delete by default for audit trail
      if (!options.hardDelete) {
        await this.softDeleteFile(fileId, userId);
      } else {
        await this.hardDeleteFile(fileId, userId, fileMetadata);
      }

      // Audit the deletion
      await this.auditService.logFileOperation({
        action: options.hardDelete ? 'hard_delete' : 'soft_delete',
        userId,
        fileId,
        fileName: fileMetadata.originalName,
        success: true
      });

      logger.logInfo('File deleted', {
        userId,
        fileId,
        fileName: fileMetadata.originalName,
        type: options.hardDelete ? 'hard' : 'soft'
      });

      return {
        success: true,
        fileId,
        deletionType: options.hardDelete ? 'permanent' : 'soft',
        deletedAt: new Date()
      };

    } catch (error) {
      logger.logError('File deletion failed', {
        userId,
        fileId,
        error: error.message
      });

      await this.auditService.logFileOperation({
        action: 'delete',
        userId,
        fileId,
        success: false,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * List user files with filtering and pagination
   * @param {string} userId - User ID
   * @param {Object} filters - Search and filter options
   * @returns {Object} Paginated file list
   */
  async listUserFiles(userId, filters = {}) {
    try {
      // Validate access
      await this.validateUserAccess(userId);

      const {
        page = 1,
        limit = 20,
        fileType,
        status,
        tags,
        dateFrom,
        dateTo,
        search,
        sortBy = 'uploadedAt',
        sortOrder = 'desc'
      } = filters;

      // Build query
      const query = this.buildFileListQuery(userId, filters);
      
      // Execute query with pagination
      const result = await this.executeFileListQuery(query, {
        page,
        limit,
        sortBy,
        sortOrder
      });

      // Calculate usage statistics
      const usageStats = await this.calculateUserStorageUsage(userId);

      logger.logInfo('File list retrieved', {
        userId,
        page,
        limit,
        totalFiles: result.total,
        fileType,
        status
      });

      return {
        files: result.files,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit)
        },
        usage: usageStats,
        filters: {
          fileType,
          status,
          tags,
          dateFrom,
          dateTo,
          search
        }
      };

    } catch (error) {
      logger.logError('File list retrieval failed', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate signed URL for temporary file access
   * @param {string} fileId - File ID
   * @param {number} expirationTime - Expiration time in minutes
   * @returns {Object} Signed URL result
   */
  async generateSignedURL(fileId, expirationTime = 60) {
    try {
      // Get file metadata
      const fileMetadata = await this.getFileMetadata(fileId);
      if (!fileMetadata) {
        throw new ValidationError('File not found');
      }

      // Generate secure file path
      const filePath = this.generateSecureFilePath(
        fileMetadata.userId, 
        fileId, 
        fileMetadata.originalName
      );

      const gcsFile = this.bucket.file(filePath);
      const [exists] = await gcsFile.exists();

      if (!exists) {
        throw new ValidationError('File not found in storage');
      }

      // Generate signed URL
      const expirationDate = new Date();
      expirationDate.setMinutes(expirationDate.getMinutes() + expirationTime);

      const [signedUrl] = await gcsFile.getSignedUrl({
        action: 'read',
        expires: expirationDate,
        responseDisposition: `attachment; filename="${fileMetadata.originalName}"`
      });

      // Cache the signed URL
      await this.cacheService.set(
        `signed_url:${fileId}`,
        { url: signedUrl, expiresAt: expirationDate },
        expirationTime * 60
      );

      logger.logInfo('Signed URL generated', {
        fileId,
        expirationTime,
        expiresAt: expirationDate
      });

      return {
        signedUrl,
        expiresAt: expirationDate,
        fileName: fileMetadata.originalName,
        fileSize: fileMetadata.size
      };

    } catch (error) {
      logger.logError('Signed URL generation failed', {
        fileId,
        error: error.message
      });
      throw error;
    }
  }

  // =====================================================
  // SPREADSHEET PROCESSING
  // =====================================================

  /**
   * Parse spreadsheet and extract transaction data
   * @param {string} fileId - File ID
   * @returns {Object} Parsed spreadsheet data
   */
  async parseSpreadsheet(fileId) {
    try {
      const fileMetadata = await this.getFileMetadata(fileId);
      if (!fileMetadata) {
        throw new ValidationError('File not found');
      }

      if (fileMetadata.fileType !== 'spreadsheet') {
        throw new ValidationError('File is not a spreadsheet');
      }

      // Download file for processing
      const filePath = this.generateSecureFilePath(
        fileMetadata.userId, 
        fileId, 
        fileMetadata.originalName
      );
      const gcsFile = this.bucket.file(filePath);
      
      // Create temporary local file for processing
      const tempFilePath = `/tmp/${fileId}-${Date.now()}`;
      await gcsFile.download({ destination: tempFilePath });

      let parsedData;

      try {
        if (fileMetadata.mimeType === 'text/csv') {
          parsedData = await this.parseCSVFile(tempFilePath);
        } else {
          parsedData = await this.parseExcelFile(tempFilePath);
        }

        // Validate spreadsheet structure
        const validation = this.validateSpreadsheetStructure(parsedData);
        if (!validation.valid) {
          throw new ValidationError(`Invalid spreadsheet structure: ${validation.errors.join(', ')}`);
        }

        // Update processing status
        await this.updateFileProcessingStatus(fileId, 'completed', {
          rowsProcessed: parsedData.rows.length,
          columnsDetected: parsedData.headers.length,
          validationResult: validation
        });

        // Generate processing report
        const report = this.generateProcessingReport(fileId, parsedData, validation);

        return {
          success: true,
          fileId,
          data: parsedData,
          validation,
          report,
          processedAt: new Date()
        };

      } finally {
        // Cleanup temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }

    } catch (error) {
      await this.updateFileProcessingStatus(fileId, 'failed', {
        error: error.message
      });

      logger.logError('Spreadsheet parsing failed', {
        fileId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Parse CSV file
   * @param {string} filePath - Local file path
   * @returns {Object} Parsed CSV data
   */
  async parseCSVFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = {
        headers: [],
        rows: [],
        metadata: {
          encoding: 'utf8',
          delimiter: ',',
          totalRows: 0
        }
      };

      let headersParsed = false;

      fs.createReadStream(filePath)
        .pipe(csv({
          skipEmptyLines: true,
          skipLinesWithError: true
        }))
        .on('headers', (headers) => {
          results.headers = headers;
          headersParsed = true;
        })
        .on('data', (row) => {
          if (headersParsed) {
            results.rows.push(row);
            results.metadata.totalRows++;
          }
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(new AppError(`CSV parsing failed: ${error.message}`));
        });
    });
  }

  /**
   * Parse Excel file
   * @param {string} filePath - Local file path
   * @returns {Object} Parsed Excel data
   */
  async parseExcelFile(filePath) {
    try {
      const workbook = xlsx.readFile(filePath, {
        cellText: false,
        cellNF: false,
        cellHTML: false
      });

      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = xlsx.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false
      });

      if (jsonData.length === 0) {
        throw new ValidationError('Spreadsheet is empty');
      }

      const headers = jsonData[0];
      const rows = jsonData.slice(1).map(row => {
        const rowObject = {};
        headers.forEach((header, index) => {
          rowObject[header] = row[index] || '';
        });
        return rowObject;
      });

      return {
        headers,
        rows,
        metadata: {
          sheetName,
          totalSheets: workbook.SheetNames.length,
          totalRows: rows.length,
          totalColumns: headers.length,
          sheetNames: workbook.SheetNames
        }
      };

    } catch (error) {
      throw new AppError(`Excel parsing failed: ${error.message}`);
    }
  }

  /**
   * Validate spreadsheet structure
   * @param {Object} parsedData - Parsed spreadsheet data
   * @returns {Object} Validation result
   */
  validateSpreadsheetStructure(parsedData) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      requiredColumns: ['date', 'description', 'amount'],
      detectedColumns: []
    };

    // Check for required columns (flexible matching)
    const headers = parsedData.headers.map(h => h.toLowerCase().trim());
    validation.detectedColumns = headers;

    const requiredPatterns = {
      date: /^(date|transaction_?date|posted_?date|value_?date)$/i,
      description: /^(description|memo|details|reference|narrative)$/i,
      amount: /^(amount|value|debit|credit|transaction_?amount)$/i
    };

    Object.entries(requiredPatterns).forEach(([required, pattern]) => {
      const found = headers.some(header => pattern.test(header));
      if (!found) {
        validation.errors.push(`Missing required column: ${required}`);
        validation.valid = false;
      }
    });

    // Check minimum number of rows
    if (parsedData.rows.length < 1) {
      validation.errors.push('Spreadsheet must contain at least one data row');
      validation.valid = false;
    }

    // Check maximum number of rows (performance limit)
    if (parsedData.rows.length > 10000) {
      validation.warnings.push('Large spreadsheet detected (>10,000 rows). Processing may take longer.');
    }

    // Validate data types in sample rows
    if (parsedData.rows.length > 0) {
      const sampleSize = Math.min(10, parsedData.rows.length);
      const sample = parsedData.rows.slice(0, sampleSize);
      
      sample.forEach((row, index) => {
        // Check for amount column data type
        const amountColumns = headers.filter(h => requiredPatterns.amount.test(h));
        amountColumns.forEach(col => {
          const value = row[col];
          if (value && isNaN(parseFloat(value.toString().replace(/[£$,]/g, '')))) {
            validation.warnings.push(`Row ${index + 2}: Amount value "${value}" may not be numeric`);
          }
        });

        // Check for date column format
        const dateColumns = headers.filter(h => requiredPatterns.date.test(h));
        dateColumns.forEach(col => {
          const value = row[col];
          if (value && isNaN(Date.parse(value))) {
            validation.warnings.push(`Row ${index + 2}: Date value "${value}" may not be a valid date`);
          }
        });
      });
    }

    return validation;
  }

  // =====================================================
  // FILE VALIDATION & SECURITY
  // =====================================================

  /**
   * Comprehensive file validation
   * @param {Object} file - File object
   * @param {string} expectedType - Expected file type
   * @returns {Object} Validation result
   */
  async validateFile(file, expectedType) {
    const validation = {
      valid: true,
      errors: []
    };

    // Basic file checks
    if (!file) {
      validation.errors.push('No file provided');
      validation.valid = false;
      return validation;
    }

    if (!file.originalname) {
      validation.errors.push('File must have a name');
      validation.valid = false;
    }

    if (!file.size || file.size === 0) {
      validation.errors.push('File is empty');
      validation.valid = false;
    }

    // File size validation
    const detectedType = this.detectFileType(file.mimetype);
    const maxSize = this.config.maxFileSizes[detectedType] || this.config.maxFileSizes.default;
    
    if (file.size > maxSize) {
      validation.errors.push(`File too large. Maximum size: ${this.formatFileSize(maxSize)}`);
      validation.valid = false;
    }

    // MIME type validation
    if (!this.isValidMimeType(file.mimetype, detectedType)) {
      validation.errors.push(`Invalid file type: ${file.mimetype}`);
      validation.valid = false;
    }

    // Magic number validation (if file buffer available)
    if (file.buffer && !await this.validateMagicNumbers(file.buffer, file.mimetype)) {
      validation.errors.push('File content does not match file extension');
      validation.valid = false;
    }

    // File extension validation
    if (!this.isValidFileExtension(file.originalname, detectedType)) {
      validation.errors.push('Invalid file extension');
      validation.valid = false;
    }

    // Expected type validation
    if (expectedType && detectedType !== expectedType) {
      validation.errors.push(`Expected ${expectedType} file, got ${detectedType}`);
      validation.valid = false;
    }

    return validation;
  }

  /**
   * Validate magic numbers for security
   * @param {Buffer} buffer - File buffer
   * @param {string} mimeType - MIME type
   * @returns {boolean} Validation result
   */
  async validateMagicNumbers(buffer, mimeType) {
    const expectedMagic = this.config.magicNumbers[mimeType];
    if (!expectedMagic) {
      return true; // No magic number defined, skip validation
    }

    const fileHeader = Array.from(buffer.slice(0, expectedMagic.length));
    return expectedMagic.every((byte, index) => fileHeader[index] === byte);
  }

  /**
   * Check if MIME type is valid for file type
   * @param {string} mimeType - MIME type
   * @param {string} fileType - Detected file type
   * @returns {boolean} Validation result
   */
  isValidMimeType(mimeType, fileType) {
    const validTypes = this.config.supportedTypes[fileType];
    return validTypes && validTypes.includes(mimeType);
  }

  /**
   * Check if file extension is valid
   * @param {string} filename - File name
   * @param {string} fileType - File type
   * @returns {boolean} Validation result
   */
  isValidFileExtension(filename, fileType) {
    const extension = path.extname(filename).toLowerCase();
    
    const validExtensions = {
      spreadsheet: ['.xlsx', '.xls', '.csv'],
      image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      pdf: ['.pdf']
    };

    const valid = validExtensions[fileType];
    return valid && valid.includes(extension);
  }

  /**
   * Detect file type from MIME type
   * @param {string} mimeType - MIME type
   * @returns {string} File type
   */
  detectFileType(mimeType) {
    for (const [type, mimeTypes] of Object.entries(this.config.supportedTypes)) {
      if (mimeTypes.includes(mimeType)) {
        return type;
      }
    }
    return 'unknown';
  }

  // =====================================================
  // USER ACCESS & RATE LIMITING
  // =====================================================

  /**
   * Validate user access
   * @param {string} userId - User ID
   */
  async validateUserAccess(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    if (!user.isActive) {
      throw new SecurityError('User account is inactive', 'ACCOUNT_INACTIVE');
    }

    return user;
  }

  /**
   * Check rate limits for file operations
   * @param {string} userId - User ID
   * @param {string} operation - Operation type
   */
  async checkRateLimits(userId, operation) {
    const rateLimitKey = `rate_limit:${userId}:${operation}`;
    const currentHour = new Date().getHours();
    const hourlyKey = `${rateLimitKey}:${currentHour}`;

    const currentCount = await this.cacheService.get(hourlyKey) || 0;
    const limit = this.config.rateLimits[`${operation}sPerHour`];

    if (currentCount >= limit) {
      throw new SecurityError(
        `Rate limit exceeded for ${operation}`,
        'RATE_LIMIT_EXCEEDED',
        { limit, current: currentCount }
      );
    }

    // Increment counter
    await this.cacheService.increment(hourlyKey, 1, 3600); // 1 hour TTL
  }

  // =====================================================
  // FILE PROCESSING QUEUE
  // =====================================================

  /**
   * Queue file for background processing
   * @param {string} fileId - File ID
   * @param {string} userId - User ID
   * @param {string} fileType - File type
   */
  async queueFileForProcessing(fileId, userId, fileType) {
    const job = {
      fileId,
      userId,
      fileType,
      queuedAt: new Date(),
      priority: this.calculateProcessingPriority(fileType, userId)
    };

    await this.queueService.add('file-processing', job, {
      priority: job.priority,
      attempts: 3,
      backoff: 'exponential'
    });

    await this.updateFileProcessingStatus(fileId, 'queued');

    logger.logInfo('File queued for processing', {
      fileId,
      userId,
      fileType,
      priority: job.priority
    });
  }

  /**
   * Process uploaded file (queue worker)
   * @param {Object} job - Queue job
   */
  async processUploadedFile(job) {
    const { fileId, userId, fileType } = job.data;

    try {
      await this.updateFileProcessingStatus(fileId, 'processing');

      let processingResult;

      switch (fileType) {
        case 'spreadsheet':
          processingResult = await this.parseSpreadsheet(fileId);
          break;
        case 'image':
          processingResult = await this.processImage(fileId);
          break;
        case 'pdf':
          processingResult = await this.processPDF(fileId);
          break;
        default:
          processingResult = { success: true, message: 'No processing required' };
      }

      await this.updateFileProcessingStatus(fileId, 'completed', processingResult);

      // Notify user of completion
      await this.notificationService.sendFileProcessingComplete(userId, {
        fileId,
        fileName: processingResult.fileName,
        result: processingResult
      });

      logger.logInfo('File processing completed', {
        fileId,
        userId,
        fileType,
        success: processingResult.success
      });

    } catch (error) {
      await this.updateFileProcessingStatus(fileId, 'failed', {
        error: error.message,
        timestamp: new Date()
      });

      // Notify user of failure
      await this.notificationService.sendFileProcessingFailed(userId, {
        fileId,
        error: error.message
      });

      logger.logError('File processing failed', {
        fileId,
        userId,
        fileType,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Calculate processing priority
   * @param {string} fileType - File type
   * @param {string} userId - User ID
   * @returns {number} Priority level
   */
  calculateProcessingPriority(fileType, userId) {
    // Higher number = higher priority
    let priority = 5; // Default priority

    // Prioritize spreadsheets (main feature)
    if (fileType === 'spreadsheet') {
      priority += 3;
    }

    // Prioritize premium users (if applicable)
    // This would check user subscription level
    // if (userIsPremium) priority += 2;

    return priority;
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Generate unique file ID
   * @returns {string} File ID
   */
  generateFileId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate secure file path
   * @param {string} userId - User ID
   * @param {string} fileId - File ID
   * @param {string} originalName - Original filename
   * @returns {string} Secure file path
   */
  generateSecureFilePath(userId, fileId, originalName) {
    const userHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
    const fileExtension = path.extname(originalName);
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    return `users/${userHash}/${year}/${month}/${fileId}${fileExtension}`;
  }

  /**
   * Calculate file hash
   * @param {Buffer|string} fileData - File buffer or path
   * @returns {string} SHA-256 hash
   */
  async calculateFileHash(fileData) {
    const hash = crypto.createHash('sha256');
    
    if (Buffer.isBuffer(fileData)) {
      hash.update(fileData);
    } else {
      // File path - read file
      const buffer = fs.readFileSync(fileData);
      hash.update(buffer);
    }
    
    return hash.digest('hex');
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Perform cloud upload with retry logic
   * @param {Object} gcsFile - GCS file object
   * @param {Object} file - File to upload
   * @param {Object} metadata - File metadata
   * @returns {Object} Upload result
   */
  async performCloudUpload(gcsFile, file, metadata) {
    const uploadOptions = {
      metadata: {
        metadata: {
          userId: metadata.userId,
          fileId: metadata.id,
          uploadedAt: metadata.uploadedAt.toISOString(),
          originalName: metadata.originalName
        },
        contentType: metadata.mimeType,
        cacheControl: 'private, max-age=0'
      },
      resumable: file.size > 5 * 1024 * 1024, // Use resumable upload for files >5MB
      validation: 'crc32c'
    };

    let uploadStream;
    let uploadPromise;

    if (file.buffer) {
      // Upload from buffer
      uploadPromise = gcsFile.save(file.buffer, uploadOptions);
    } else {
      // Upload from file path
      uploadStream = fs.createReadStream(file.path);
      uploadPromise = pipeline(uploadStream, gcsFile.createWriteStream(uploadOptions));
    }

    await uploadPromise;

    // Generate initial signed URL
    const [signedUrl] = await gcsFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    return { signedUrl };
  }

  /**
   * Soft delete file (mark as deleted)
   * @param {string} fileId - File ID
   * @param {string} userId - User ID
   */
  async softDeleteFile(fileId, userId) {
    // Update metadata to mark as deleted
    await this.updateFileMetadata(fileId, {
      deletedAt: new Date(),
      deletedBy: userId,
      status: 'deleted'
    });
  }

  /**
   * Hard delete file (remove from storage)
   * @param {string} fileId - File ID
   * @param {string} userId - User ID
   * @param {Object} fileMetadata - File metadata
   */
  async hardDeleteFile(fileId, userId, fileMetadata) {
    // Delete from cloud storage
    const filePath = this.generateSecureFilePath(userId, fileId, fileMetadata.originalName);
    const gcsFile = this.bucket.file(filePath);
    
    try {
      await gcsFile.delete();
    } catch (error) {
      logger.logWarning('Failed to delete file from storage', {
        fileId,
        filePath,
        error: error.message
      });
    }

    // Remove metadata from database
    await this.removeFileMetadata(fileId);
  }

  /**
   * Process image files
   * @param {string} fileId - File ID
   * @returns {Object} Processing result
   */
  async processImage(fileId) {
    // Placeholder for image processing (OCR, thumbnail generation, etc.)
    const fileMetadata = await this.getFileMetadata(fileId);
    
    // Generate thumbnail using Sharp
    const filePath = this.generateSecureFilePath(
      fileMetadata.userId, 
      fileId, 
      fileMetadata.originalName
    );
    
    // Implementation would include OCR for receipt text extraction
    return {
      success: true,
      message: 'Image processed successfully',
      thumbnailGenerated: true,
      ocrExtracted: false // Would be true if OCR is implemented
    };
  }

  /**
   * Process PDF files
   * @param {string} fileId - File ID
   * @returns {Object} Processing result
   */
  async processPDF(fileId) {
    // Placeholder for PDF processing (text extraction, validation, etc.)
    return {
      success: true,
      message: 'PDF processed successfully',
      textExtracted: false, // Would be true if text extraction is implemented
      pageCount: 1
    };
  }

  // =====================================================
  // DATABASE OPERATIONS (PLACEHOLDER IMPLEMENTATIONS)
  // These would connect to your actual database
  // =====================================================

  /**
   * Store file metadata in database
   * @param {Object} metadata - File metadata
   */
  async storeFileMetadata(metadata) {
    // Implementation would store in your database
    logger.logInfo('File metadata stored', { fileId: metadata.id });
  }

  /**
   * Get file metadata from database
   * @param {string} fileId - File ID
   * @returns {Object} File metadata
   */
  async getFileMetadata(fileId) {
    // Implementation would retrieve from your database
    // Placeholder return for testing
    return null;
  }

  /**
   * Update file metadata
   * @param {string} fileId - File ID
   * @param {Object} updates - Metadata updates
   */
  async updateFileMetadata(fileId, updates) {
    // Implementation would update in your database
    logger.logInfo('File metadata updated', { fileId, updates: Object.keys(updates) });
  }

  /**
   * Remove file metadata from database
   * @param {string} fileId - File ID
   */
  async removeFileMetadata(fileId) {
    // Implementation would remove from your database
    logger.logInfo('File metadata removed', { fileId });
  }

  /**
   * Update file processing status
   * @param {string} fileId - File ID
   * @param {string} status - Processing status
   * @param {Object} details - Additional details
   */
  async updateFileProcessingStatus(fileId, status, details = {}) {
    // Implementation would update processing status in database
    logger.logInfo('File processing status updated', {
      fileId,
      status,
      details: Object.keys(details)
    });
  }

  /**
   * Find duplicate file by hash
   * @param {string} userId - User ID
   * @param {string} fileHash - File hash
   * @returns {Object} Existing file if found
   */
  async findDuplicateFile(userId, fileHash) {
    // Implementation would search database for existing file with same hash
    return null;
  }

  /**
   * Build file list query
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Query object
   */
  buildFileListQuery(userId, filters) {
    // Implementation would build database query based on filters
    return { userId, filters };
  }

  /**
   * Execute file list query
   * @param {Object} query - Query object
   * @param {Object} options - Query options
   * @returns {Object} Query results
   */
  async executeFileListQuery(query, options) {
    // Implementation would execute database query
    return {
      files: [],
      total: 0
    };
  }

  /**
   * Calculate user storage usage
   * @param {string} userId - User ID
   * @returns {Object} Storage usage statistics
   */
  async calculateUserStorageUsage(userId) {
    // Implementation would calculate from database
    return {
      totalFiles: 0,
      totalSize: 0,
      usageByType: {},
      quotaUsed: 0,
      quotaLimit: 1024 * 1024 * 1024 // 1GB default
    };
  }

  /**
   * Generate processing report
   * @param {string} fileId - File ID
   * @param {Object} parsedData - Parsed data
   * @param {Object} validation - Validation result
   * @returns {Object} Processing report
   */
  generateProcessingReport(fileId, parsedData, validation) {
    return {
      fileId,
      processedAt: new Date(),
      summary: {
        totalRows: parsedData.rows.length,
        totalColumns: parsedData.headers.length,
        validationPassed: validation.valid,
        errorsFound: validation.errors.length,
        warningsFound: validation.warnings.length
      },
      details: {
        headers: parsedData.headers,
        sampleData: parsedData.rows.slice(0, 5), // First 5 rows
        validation
      }
    };
  }
}

module.exports = FileStorageService;