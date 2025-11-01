const multer = require('multer');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const path = require('path');
const fs = require('fs').promises;
const { createReadStream } = require('fs');
const { AppError, ValidationError, createFieldError } = require('../utils/errors.util');
const { sanitizeString } = require('../utils/validation.util');

/**
 * Spreadsheet Upload Service
 * Handles file uploads, parsing, and preparation for AI-powered categorization
 * NO REQUIRED COLUMNS - AI figures out what's what!
 */
class UploadService {
  constructor() {
    this.config = {
      // File upload constraints
      upload: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedExtensions: ['.xlsx', '.xls', '.csv'],
        allowedMimeTypes: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/csv'
        ],
        uploadDir: process.env.UPLOAD_DIR || './uploads',
        tempDir: process.env.TEMP_DIR || './temp'
      },

      // Data validation rules
      validation: {
        maxRows: 10000, // Maximum transactions per upload
        minRows: 1,     // Minimum transactions required
        minColumns: 2,  // Minimum columns (we need at least some data!)
        maxColumns: 50  // Reasonable limit to prevent abuse
      },

      // Error codes
      errorCodes: {
        FILE_TOO_LARGE: 'FILE_TOO_LARGE',
        INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
        FILE_PARSING_FAILED: 'FILE_PARSING_FAILED',
        INVALID_DATA_FORMAT: 'INVALID_DATA_FORMAT',
        TOO_MANY_ROWS: 'TOO_MANY_ROWS',
        TOO_MANY_COLUMNS: 'TOO_MANY_COLUMNS',
        INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
        UPLOAD_DIRECTORY_ERROR: 'UPLOAD_DIRECTORY_ERROR'
      }
    };

    // Initialize multer for file uploads
    this.upload = this._initializeMulter();
    this._ensureDirectories();
  }

  /**
   * Initialize multer configuration
   * @private
   */
  _initializeMulter() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.config.upload.tempDir);
      },
      filename: (req, file, cb) => {
        const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedName = sanitizeString(file.originalname);
        cb(null, `upload-${uniqueId}-${sanitizedName}`);
      }
    });

    const fileFilter = (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      
      if (!this.config.upload.allowedExtensions.includes(ext)) {
        return cb(new ValidationError(
          `Invalid file type. Allowed types: ${this.config.upload.allowedExtensions.join(', ')}`,
          [createFieldError('file', 'INVALID_FILE_TYPE', `File type ${ext} not allowed`)],
          'file'
        ));
      }

      if (!this.config.upload.allowedMimeTypes.includes(file.mimetype)) {
        return cb(new ValidationError(
          `Invalid MIME type: ${file.mimetype}`,
          [createFieldError('file', 'INVALID_MIME_TYPE', `MIME type ${file.mimetype} not allowed`)],
          'file'
        ));
      }

      cb(null, true);
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.config.upload.maxFileSize,
        files: 1
      }
    });
  }

  /**
   * Ensure upload directories exist
   * @private
   */
  async _ensureDirectories() {
    try {
      await fs.mkdir(this.config.upload.uploadDir, { recursive: true });
      await fs.mkdir(this.config.upload.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directories:', error.message);
    }
  }

  /**
   * Process uploaded spreadsheet file - AI will figure out the columns!
   * @param {Object} file - Multer file object
   * @param {Object} options - Processing options
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Object} Raw spreadsheet data ready for AI categorization
   */
  async processSpreadsheet(file, options = {}, progressCallback = null) {
    let tempFilePath = null;
    
    try {
      if (!file) {
        throw new ValidationError('No file provided', [], 'file');
      }

      tempFilePath = file.path;
      console.log(`Processing spreadsheet: ${file.originalname} (${file.size} bytes)`);

      if (progressCallback) {
        progressCallback({
          stage: 'validation',
          stageDescription: 'Validating file',
          completed: 20,
          total: 100,
          percentage: 20
        });
      }

      // Step 1: Validate file
      this._validateFile(file);

      if (progressCallback) {
        progressCallback({
          stage: 'parsing',
          stageDescription: 'Parsing spreadsheet data',
          completed: 60,
          total: 100,
          percentage: 60
        });
      }

      // Step 2: Parse file and extract ALL data - let AI figure out what's what
      const rawData = await this._parseFile(file);

      if (progressCallback) {
        progressCallback({
          stage: 'processing',
          stageDescription: 'Processing raw data for AI analysis',
          completed: 80,
          total: 100,
          percentage: 80
        });
      }

      // Step 3: Basic validation and structure - no column mapping needed!
      const processedData = this._processRawData(rawData, options);

      if (progressCallback) {
        progressCallback({
          stage: 'finalization',
          stageDescription: 'Finalizing data structure',
          completed: 90,
          total: 100,
          percentage: 90
        });
      }

      // Step 4: Create data structure for AI categorization
      const finalData = this._createAIReadyData(processedData, file, options);

      if (progressCallback) {
        progressCallback({
          stage: 'complete',
          stageDescription: 'Upload processing complete - ready for AI',
          completed: 100,
          total: 100,
          percentage: 100
        });
      }

      console.log(`Spreadsheet processing complete: ${finalData.rawRows.length} rows ready for AI analysis`);
      return finalData;

    } catch (error) {
      console.error('Spreadsheet processing failed:', error.message);
      throw new AppError(
        `Failed to process spreadsheet: ${error.message}`,
        500,
        this.config.errorCodes.FILE_PARSING_FAILED
      );
    } finally {
      // Clean up temporary file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary file:', cleanupError.message);
        }
      }
    }
  }

  /**
   * Validate uploaded file
   * @param {Object} file - Multer file object
   * @private
   */
  _validateFile(file) {
    if (file.size > this.config.upload.maxFileSize) {
      throw new ValidationError(
        `File too large. Maximum size: ${this.config.upload.maxFileSize / 1024 / 1024}MB`,
        [createFieldError('file', 'FILE_TOO_LARGE', `File size ${file.size} exceeds limit`)],
        'file'
      );
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.config.upload.allowedExtensions.includes(ext)) {
      throw new ValidationError(
        `Invalid file extension: ${ext}`,
        [createFieldError('file', 'INVALID_FILE_TYPE', `Extension ${ext} not allowed`)],
        'file'
      );
    }
  }

  /**
   * Parse file based on extension
   * @param {Object} file - Multer file object
   * @returns {Array} Raw spreadsheet data
   * @private
   */
  async _parseFile(file) {
    const ext = path.extname(file.originalname).toLowerCase();
    
    try {
      if (ext === '.csv') {
        return await this._parseCSV(file.path);
      } else if (ext === '.xlsx' || ext === '.xls') {
        return this._parseExcel(file.path);
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }
    } catch (error) {
      throw new AppError(
        `Failed to parse ${ext} file: ${error.message}`,
        400,
        this.config.errorCodes.FILE_PARSING_FAILED
      );
    }
  }

  /**
   * Parse CSV file
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Array>} Parsed CSV data
   * @private
   */
  _parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      createReadStream(filePath)
        .pipe(csv({
          skipEmptyLines: true,
          skipLinesWithError: false, // Keep errors for AI to analyze
          mapHeaders: ({ header }) => header.trim() // Clean up headers but keep original names
        }))
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', () => {
          if (results.length === 0) {
            reject(new Error('CSV file is empty or contains no valid data'));
          } else {
            resolve(results);
          }
        })
        .on('error', (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        });
    });
  }

  /**
   * Parse Excel file
   * @param {string} filePath - Path to Excel file
   * @returns {Array} Parsed Excel data
   * @private
   */
  _parseExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      
      if (!sheetName) {
        throw new Error('Excel file contains no sheets');
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // Return array of arrays first
        defval: '', // Default value for empty cells
        blankrows: false // Skip blank rows
      });

      if (jsonData.length === 0) {
        throw new Error('Excel sheet is empty');
      }

      // Convert to objects but keep ALL original column names
      const headers = jsonData[0].map(header => 
        typeof header === 'string' ? header.trim() : String(header).trim()
      );
      
      const dataRows = jsonData.slice(1);
      const objects = dataRows.map((row, index) => {
        const obj = {
          _rowNumber: index + 2 // Track original row number
        };
        headers.forEach((header, colIndex) => {
          const value = row[colIndex];
          // Keep the original header name - don't lowercase or modify!
          obj[header] = value !== undefined && value !== null ? String(value).trim() : '';
        });
        return obj;
      });

      return objects;

    } catch (error) {
      throw new Error(`Excel parsing error: ${error.message}`);
    }
  }

  /**
   * Process raw data - minimal validation, let AI handle the rest
   * @param {Array} rawData - Raw spreadsheet data
   * @param {Object} options - Processing options
   * @returns {Object} Minimally processed data
   * @private
   */
  _processRawData(rawData, options) {
    // Basic validation only
    if (!Array.isArray(rawData) || rawData.length === 0) {
      throw new ValidationError('Spreadsheet contains no data', [], 'data');
    }

    if (rawData.length > this.config.validation.maxRows) {
      throw new ValidationError(
        `Too many rows. Maximum allowed: ${this.config.validation.maxRows}`,
        [createFieldError('data', 'TOO_MANY_ROWS', `Found ${rawData.length} rows`)],
        'data'
      );
    }

    if (rawData.length < this.config.validation.minRows) {
      throw new ValidationError(
        `Insufficient data. Minimum required: ${this.config.validation.minRows} row`,
        [createFieldError('data', 'INSUFFICIENT_DATA', `Found ${rawData.length} rows`)],
        'data'
      );
    }

    // Check column count
    const sampleRow = rawData[0];
    const columnCount = Object.keys(sampleRow).length;
    
    if (columnCount < this.config.validation.minColumns) {
      throw new ValidationError(
        `Insufficient columns. Minimum required: ${this.config.validation.minColumns}`,
        [createFieldError('data', 'INSUFFICIENT_COLUMNS', `Found ${columnCount} columns`)],
        'data'
      );
    }

    if (columnCount > this.config.validation.maxColumns) {
      throw new ValidationError(
        `Too many columns. Maximum allowed: ${this.config.validation.maxColumns}`,
        [createFieldError('data', 'TOO_MANY_COLUMNS', `Found ${columnCount} columns`)],
        'data'
      );
    }

    // Process each row - minimal cleaning only
    const processedRows = rawData.map((row, index) => {
      const cleanedRow = {
        _originalRowIndex: index,
        _rowNumber: row._rowNumber || (index + 1)
      };

      // Clean up each cell value but keep original column names
      Object.keys(row).forEach(columnName => {
        if (columnName.startsWith('_')) {
          cleanedRow[columnName] = row[columnName];
        } else {
          const value = row[columnName];
          // Minimal sanitization - just trim whitespace
          cleanedRow[columnName] = typeof value === 'string' ? value.trim() : String(value || '');
        }
      });

      return cleanedRow;
    });

    // Filter out completely empty rows
    const nonEmptyRows = processedRows.filter(row => {
      const values = Object.keys(row)
        .filter(key => !key.startsWith('_'))
        .map(key => row[key])
        .filter(value => value && value.trim() !== '');
      
      return values.length > 0;
    });

    if (nonEmptyRows.length === 0) {
      throw new ValidationError(
        'No non-empty rows found in spreadsheet',
        [createFieldError('data', 'NO_DATA', 'All rows are empty')],
        'data'
      );
    }

    return {
      rows: nonEmptyRows,
      totalRows: rawData.length,
      processedRows: nonEmptyRows.length,
      emptyRowsRemoved: rawData.length - nonEmptyRows.length,
      columnNames: Object.keys(nonEmptyRows[0]).filter(key => !key.startsWith('_')),
      columnCount: Object.keys(nonEmptyRows[0]).filter(key => !key.startsWith('_')).length
    };
  }

  /**
   * Create final data structure for AI categorization
   * @param {Object} processedData - Processed data
   * @param {Object} file - Original file object
   * @param {Object} options - Processing options
   * @returns {Object} AI-ready data structure
   * @private
   */
  _createAIReadyData(processedData, file, options) {
    const columnNames = processedData.columnNames;
    
    // Create sample of data for AI column analysis
    const sampleRows = processedData.rows.slice(0, Math.min(10, processedData.rows.length));

    return {
      metadata: {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
        totalRowsInFile: processedData.totalRows,
        processedRows: processedData.processedRows,
        emptyRowsRemoved: processedData.emptyRowsRemoved,
        detectedColumns: columnNames,
        columnCount: processedData.columnCount,
        processingOptions: options,
        aiInstructions: {
          note: 'AI should analyze the column names and sample data to identify date, description, amount, and other relevant fields',
          flexibility: 'User has not been asked to change their spreadsheet format - AI must adapt to their existing structure'
        },
        version: '1.0'
      },
      
      // Raw data for AI to analyze and categorize
      rawRows: processedData.rows,
      
      // Column information for AI analysis
      columnAnalysis: {
        detectedColumns: columnNames,
        sampleData: sampleRows,
        columnTypes: this._analyzeColumnTypes(sampleRows, columnNames),
        possibleMappings: this._suggestColumnMappings(columnNames)
      },
      
      // Summary for AI context
      summary: {
        totalRows: processedData.processedRows,
        dateRange: 'To be determined by AI analysis',
        amountSummary: 'To be determined by AI analysis',
        dataQuality: {
          hasEmptyRows: processedData.emptyRowsRemoved > 0,
          emptyRowsRemoved: processedData.emptyRowsRemoved,
          avgColumnsPerRow: processedData.columnCount,
          needsAIAnalysis: true
        }
      }
    };
  }

  /**
   * Analyze column types from sample data
   * @param {Array} sampleRows - Sample rows
   * @param {Array} columnNames - Column names
   * @returns {Object} Column type analysis
   * @private
   */
  _analyzeColumnTypes(sampleRows, columnNames) {
    const analysis = {};
    
    columnNames.forEach(colName => {
      const values = sampleRows
        .map(row => row[colName])
        .filter(val => val && val.trim() !== '');
      
      if (values.length === 0) {
        analysis[colName] = { type: 'empty', confidence: 0 };
        return;
      }

      // Basic pattern detection
      const hasNumbers = values.some(val => /[\d,.-]/.test(val));
      const hasDateLike = values.some(val => /\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(val));
      const hasCurrency = values.some(val => /[£$€]/.test(val) || /^\(?[\d,.-]+\)?$/.test(val.trim()));
      const avgLength = values.reduce((sum, val) => sum + val.length, 0) / values.length;

      let type = 'text';
      let confidence = 0.3;

      if (hasDateLike) {
        type = 'date_like';
        confidence = 0.8;
      } else if (hasCurrency || (hasNumbers && avgLength < 15)) {
        type = 'amount_like';
        confidence = 0.7;
      } else if (hasNumbers && avgLength > 15) {
        type = 'description_like';
        confidence = 0.6;
      } else if (avgLength > 20) {
        type = 'description_like';
        confidence = 0.7;
      }

      analysis[colName] = {
        type,
        confidence,
        sampleValues: values.slice(0, 3),
        avgLength,
        hasNumbers,
        hasDateLike,
        hasCurrency
      };
    });

    return analysis;
  }

  /**
   * Suggest possible column mappings for AI
   * @param {Array} columnNames - Column names
   * @returns {Object} Suggested mappings
   * @private
   */
  _suggestColumnMappings(columnNames) {
    const suggestions = {
      possibleDateColumns: [],
      possibleAmountColumns: [],
      possibleDescriptionColumns: [],
      possibleReferenceColumns: []
    };

    columnNames.forEach(colName => {
      const lowerName = colName.toLowerCase();
      
      // Date column suggestions
      if (lowerName.includes('date') || lowerName.includes('time') || 
          lowerName.includes('when') || lowerName.includes('day')) {
        suggestions.possibleDateColumns.push(colName);
      }
      
      // Amount column suggestions
      if (lowerName.includes('amount') || lowerName.includes('value') || 
          lowerName.includes('price') || lowerName.includes('cost') ||
          lowerName.includes('debit') || lowerName.includes('credit') ||
          lowerName.includes('balance') || lowerName.includes('total')) {
        suggestions.possibleAmountColumns.push(colName);
      }
      
      // Description column suggestions
      if (lowerName.includes('description') || lowerName.includes('detail') ||
          lowerName.includes('memo') || lowerName.includes('note') ||
          lowerName.includes('narrative') || lowerName.includes('info')) {
        suggestions.possibleDescriptionColumns.push(colName);
      }
      
      // Reference column suggestions
      if (lowerName.includes('ref') || lowerName.includes('id') ||
          lowerName.includes('number') || lowerName.includes('code')) {
        suggestions.possibleReferenceColumns.push(colName);
      }
    });

    return suggestions;
  }

  // ====== PUBLIC API METHODS ======

  /**
   * Get multer upload middleware
   * @returns {Function} Multer middleware
   */
  getUploadMiddleware() {
    return this.upload.single('spreadsheet');
  }

  /**
   * Get upload configuration
   * @returns {Object} Upload configuration
   */
  getUploadConfig() {
    return {
      maxFileSize: this.config.upload.maxFileSize,
      allowedExtensions: this.config.upload.allowedExtensions,
      allowedMimeTypes: this.config.upload.allowedMimeTypes,
      maxRows: this.config.validation.maxRows,
      flexibility: {
        noRequiredColumns: true,
        aiDeterminesStructure: true,
        userKeepsExistingFormat: true
      }
    };
  }

  /**
   * Validate file before upload (client-side validation helper)
   * @param {Object} fileInfo - File information
   * @returns {Object} Validation result
   */
  validateFileInfo(fileInfo) {
    const errors = [];

    if (fileInfo.size > this.config.upload.maxFileSize) {
      errors.push({
        field: 'size',
        code: 'FILE_TOO_LARGE',
        message: `File too large. Maximum size: ${this.config.upload.maxFileSize / 1024 / 1024}MB`
      });
    }

    const ext = path.extname(fileInfo.name).toLowerCase();
    if (!this.config.upload.allowedExtensions.includes(ext)) {
      errors.push({
        field: 'type',
        code: 'INVALID_FILE_TYPE',
        message: `Invalid file type. Allowed types: ${this.config.upload.allowedExtensions.join(', ')}`
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Create and export singleton instance
const uploadService = new UploadService();

module.exports = {
  UploadService,
  default: uploadService,
  
  // Export main methods
  processSpreadsheet: (file, options, progressCallback) =>
    uploadService.processSpreadsheet(file, options, progressCallback),
  getUploadMiddleware: () =>
    uploadService.getUploadMiddleware(),
  getUploadConfig: () =>
    uploadService.getUploadConfig(),
  validateFileInfo: (fileInfo) =>
    uploadService.validateFileInfo(fileInfo)
};