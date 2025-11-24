const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');
const { AppError, ValidationError, createFieldError } = require('../utils/errors.util');
const { processSpreadsheet, getUploadMiddleware } = require('../services/upload.service');
const { processQuarterlySubmission } = require('../services/quarterly-submission.service');
const { processAnnualDeclaration } = require('../services/annual-submission.service');
const { processSpreadsheetLineByLine } = require('../utils/categorization.util');
const { validateTransaction, validateTransactionDescription, sanitizeString } = require('../utils/validation.util');

const router = express.Router();

// Rate limiting for file uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per 15 minutes
  message: {
    error: 'Too many file uploads',
    message: 'Please wait before uploading another file',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Input validation middleware
const validateProcessingRequest = [
  // TEMPORARILY DISABLE STRICT VALIDATION
  
  // body('submissionType')
  //   .isIn(['quarterly', 'annual'])
  //   .withMessage('Submission type must be quarterly or annual'),
    
  // body('businessType')
  //   .isIn(['sole_trader', 'landlord'])
  //   .withMessage('Business type must be sole_trader or landlord'),
    
  // body('quarter')
  //   .optional()
  //   .isIn(['q1', 'q2', 'q3', 'q4'])
  //   .withMessage('Quarter must be q1, q2, q3, or q4'),
    
  // // Conditional validation: quarter required for quarterly submissions
  // body('quarter').custom((value, { req }) => {
  //   if (req.body.submissionType === 'quarterly' && !value) {
  //     throw new Error('Quarter is required for quarterly submissions');
  //   }
  //   if (req.body.submissionType === 'annual' && value) {
  //     throw new Error('Quarter should not be provided for annual submissions');
  //   }
  //   return true;
  // })
];

/**
 * POST /api/files/process
 * Main endpoint for spreadsheet upload and processing
 * 
 * Body:
 * - submissionType: 'quarterly' | 'annual'
 * - businessType: 'sole_trader' | 'landlord'
 * - quarter: 'q1' | 'q2' | 'q3' | 'q4' (required for quarterly)
 * 
 * File: spreadsheet (.xlsx, .xls, .csv)
 */
router.post('/process', 
  uploadLimiter,
  getUploadMiddleware(),
  validateProcessingRequest,
  async (req, res) => {
    let currentStage = 'initialization';
    
    try {
      console.log('🔍 DEBUG - Received request body:', req.body);
      console.log('🔍 DEBUG - Received file:', req.file ? req.file.originalname : 'No file');

      const { submissionType, businessType, quarter, submissionOptions } = req.body;
      const file = req.file;
      const userId = 1; // TODO: Get from auth

      // Check for duplicate submissions before processing
      const SubmissionModel = require('../models/submission.models');
      const currentYear = new Date().getFullYear();
      const existingSubmissions = await SubmissionModel.getUserSubmissions(userId);
      
      // Normalize quarter format
      let normalizedQuarter = quarter;
      if (quarter && !quarter.startsWith('q')) {
        normalizedQuarter = `q${quarter}`;
      }
      
      const duplicateExists = existingSubmissions.some(existing => {
        if (submissionType === 'quarterly') {
          return existing.type === 'quarterly' && 
                 existing.quarter === normalizedQuarter?.toLowerCase() && 
                 existing.tax_year === currentYear;
        } else if (submissionType === 'yearly' || submissionType === 'annual') {
          return existing.type === 'annual' && existing.tax_year === currentYear;
        }
        return false;
      });

      if (duplicateExists) {
        const periodName = submissionType === 'quarterly' 
          ? normalizedQuarter?.toUpperCase() 
          : 'Annual';
        return res.status(409).json({
          success: false,
          error: 'Duplicate submission',
          message: `A submission for ${periodName} ${currentYear} already exists. Please delete the existing submission first if you want to re-upload.`
        });
      }

      // Parse submission options if provided
      let parsedSubmissionOptions = {};
      if (submissionOptions) {
        try {
          parsedSubmissionOptions = typeof submissionOptions === 'string' 
            ? JSON.parse(submissionOptions) 
            : submissionOptions;
        } catch (error) {
          console.warn('Failed to parse submission options:', error);
          parsedSubmissionOptions = {};
        }
      }

      console.log('🔍 DEBUG - Parsed submission options:', parsedSubmissionOptions);
      console.log('🔍 DEBUG - Spreadsheet type selected:', parsedSubmissionOptions.spreadsheetType || 'NONE');

      // Basic checks only
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          message: 'Please select a spreadsheet file to upload'
        });
      }

      if (!submissionType) {
        return res.status(400).json({
          success: false,
          error: 'Missing submission type',
          message: 'Please specify quarterly or annual submission'
        });
      }

      // Quarter is already normalized above, just verify format
      if (quarter && !normalizedQuarter.startsWith('q')) {
        normalizedQuarter = `q${quarter}`;
      }
      
      console.log('🔍 DEBUG - Quarter normalization:', {
        original: quarter,
        normalized: normalizedQuarter
      });

      console.log(`Processing ${submissionType} submission for ${businessType || 'sole_trader'}${normalizedQuarter ? ` (${normalizedQuarter})` : ''}`);

      // Initialize processing tracker
      currentStage = 'upload';
      const processingTracker = {
        upload: { completed: false, progress: 0 },
        categorization: { completed: false, progress: 0 },
        submission: { completed: false, progress: 0 }
      };

      // Progress callback for real-time updates
      const progressCallback = (progress) => {
        console.log(`Stage: ${progress.stage}, Progress: ${progress.percentage}%`);
        processingTracker[currentStage] = {
          completed: progress.percentage === 100,
          progress: progress.percentage,
          stage: progress.stage,
          description: progress.stageDescription
        };
      };

      // STEP 1: Process uploaded spreadsheet
      currentStage = 'upload';
      console.log('Step 1: Processing uploaded spreadsheet...');
      
      const uploadResult = await processSpreadsheet(file, {
        submissionType,
        businessType: businessType || 'sole_trader',
        quarter: normalizedQuarter
      }, progressCallback);

      console.log('✅ Upload result:', {
        rawRowsCount: uploadResult.rawRows?.length || 0,
        metadata: uploadResult.metadata
      });

      if (!uploadResult.rawRows || uploadResult.rawRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid data found in spreadsheet',
          message: 'The uploaded file contains no processable transaction data',
          uploadDetails: uploadResult.metadata
        });
      }

      // STEP 2: Process based on submission type
      currentStage = 'categorization';
      let categorizationResults;

      // Check if this is a multi-quarter spreadsheet
      const { hasSeparatelyDefinedQuarters } = require('../utils/quarterly-same-sheet-seperatley-defined.util');
      const isMultiQuarterSpreadsheet = submissionType === 'quarterly' && 
                                        hasSeparatelyDefinedQuarters(uploadResult.rawRows);

      // Check if user selected a specific spreadsheet type
      const userSelectedSpreadsheetType = parsedSubmissionOptions.spreadsheetType;
      const shouldUseQuarterlyService = submissionType === 'quarterly' && 
                                       (isMultiQuarterSpreadsheet || userSelectedSpreadsheetType);

      if (shouldUseQuarterlyService) {
        // Use quarterly submission service for multi-quarter OR when user specified a type
        const spreadsheetType = userSelectedSpreadsheetType || 'same_separated';
        
        console.log('Step 2: Processing quarterly submission...');
        console.log('🔍 DEBUG - Quarterly submission detected:', {
          quarter: normalizedQuarter,
          businessType: businessType || 'sole_trader',
          spreadsheetType: spreadsheetType,
          userSelected: !!userSelectedSpreadsheetType,
          autoDetected: isMultiQuarterSpreadsheet,
          rowCount: uploadResult.rawRows.length
        });

        categorizationResults = await processQuarterlySubmission(
          uploadResult.rawRows,
          {
            quarter: normalizedQuarter,
            businessType: businessType || 'sole_trader',
            spreadsheetType: spreadsheetType,
            userId: userId,
            taxYear: currentYear
          },
          progressCallback
        );

        console.log('✅ Quarterly submission results:', {
          quarter: categorizationResults.quarter,
          processingMethod: categorizationResults.processingMethod,
          spreadsheetType: spreadsheetType,
          successful: categorizationResults.summary.successful,
          personal: categorizationResults.summary.personal,
          errors: categorizationResults.summary.errors
        });

      } else {
        // Use categorization utility for annual AND single-quarter submissions
        const submissionDescription = submissionType === 'quarterly' 
          ? `single-quarter (${normalizedQuarter.toUpperCase()})` 
          : 'annual';
        
        console.log(`Step 2: Processing ${submissionDescription} submission...`);
        console.log('🔍 DEBUG - Sending to categorization:', {
          submissionType,
          quarter: normalizedQuarter || 'N/A',
          rowCount: uploadResult.rawRows.length,
          businessType: businessType || 'sole_trader',
          firstRow: uploadResult.rawRows[0]
        });
        
        categorizationResults = await processSpreadsheetLineByLine(
          uploadResult.rawRows,
          businessType || 'sole_trader',
          progressCallback
        );

        console.log(`✅ ${submissionDescription.charAt(0).toUpperCase() + submissionDescription.slice(1)} categorization results:`, {
          total: categorizationResults.totalRows,
          successful: categorizationResults.summary.successful,
          personal: categorizationResults.summary.personal,
          errors: categorizationResults.summary.errors
        });
      }

      if (categorizationResults.summary.successful === 0) {
        console.log('❌ No successful categorizations');
        return res.status(400).json({
          success: false,
          error: 'No transactions could be categorized successfully',
          message: 'All transactions either failed processing or were identified as personal',
          categorizationSummary: categorizationResults.summary,
          errors: categorizationResults.errors.slice(0, 5),
          debugInfo: {
            totalRows: categorizationResults.totalRows,
            successful: categorizationResults.summary.successful,
            personal: categorizationResults.summary.personal,
            errorCount: categorizationResults.summary.errors
          }
        });
      }

      // STEP 3: Return categorization results directly (no submission service)
      currentStage = 'complete';
      console.log(`✅ Successfully categorized ${submissionType} data`);
      
      const finalResponse = {
        success: true,
        submissionType,
        businessType: businessType || 'sole_trader',
        quarter: submissionType === 'quarterly' ? normalizedQuarter : undefined,
        processingTimestamp: new Date().toISOString(),
        
        // File processing summary
        fileProcessing: {
          fileName: uploadResult.metadata.fileName,
          fileSize: uploadResult.metadata.fileSize,
          totalRowsProcessed: uploadResult.metadata.processedRows,
          emptyRowsRemoved: uploadResult.metadata.emptyRowsRemoved,
          detectedColumns: uploadResult.metadata.detectedColumns
        },
        
        // Categorization summary
        categorization: {
          totalTransactions: categorizationResults.totalRows,
          successfullyProcessed: categorizationResults.summary.successful,
          personalTransactionsExcluded: categorizationResults.summary.personal,
          errorsEncountered: categorizationResults.summary.errors,
          aiCategorized: categorizationResults.summary.aiCategorized,
          manualReviewRequired: categorizationResults.summary.manualReviewRequired || 0
        },
        
        // Direct categorization results for frontend display
        categorizedData: {
          frontendSummary: categorizationResults.frontendSummary,
          summary: categorizationResults.summary,
          businessType: businessType || 'sole_trader',
          categoryTotals: categorizationResults.categoryTotals,
          processingDate: categorizationResults.processingDate
        },
        
        // Main submission data (just the categorization for now)
        submission: {
          categorizedTransactions: categorizationResults.categorizedTransactions,
          categoryTotals: categorizationResults.categoryTotals,
          summary: categorizationResults.summary,
          submissionType,
          quarter: normalizedQuarter,
          businessType: businessType || 'sole_trader'
        },
        
        // Processing details for debugging/review
        processingDetails: {
          uploadSuccess: true,
          categorizationSuccess: true,
          submissionSuccess: true,
          processingTime: Date.now(),
          stages: processingTracker,
          note: 'Using categorization utility only - submission services bypassed'
        },
        
        // Quality indicators
        dataQuality: {
          successRate: Math.round((categorizationResults.summary.successful / categorizationResults.totalRows) * 100),
          personalTransactionRate: Math.round((categorizationResults.summary.personal / categorizationResults.totalRows) * 100),
          errorRate: Math.round((categorizationResults.summary.errors / categorizationResults.totalRows) * 100),
          needsReview: (categorizationResults.summary.manualReviewRequired || 0) > 0,
          recommendedActions: generateRecommendedActions(categorizationResults, { summary: categorizationResults.summary })
        }
      };

      res.json(finalResponse);

    } catch (error) {
      console.error('❌ File processing failed:', error);
      console.error('Error stack:', error.stack);
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred during file processing',
        stage: currentStage || 'unknown',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      });
    }
  }
);

/**
 * GET /api/files/config
 * Get configuration information for file uploads
 */
router.get('/config', (req, res) => {
  try {
    res.json({
      success: true,
      uploadConfig: {
        maxFileSize: '10MB',
        allowedFormats: ['.xlsx', '.xls', '.csv'],
        maxRows: 10000,
        supportedBusinessTypes: ['sole_trader', 'landlord'],
        submissionTypes: ['quarterly', 'annual'],
        quarters: ['q1', 'q2', 'q3', 'q4']
      },
      processingInfo: {
        aiPowered: true,
        flexibleColumns: true,
        automaticCategorization: true,
        hmrcCompliant: true
      },
      deadlines: {
        quarterly: {
          q1: { period: 'Apr-Jul', deadline: '5 August' },
          q2: { period: 'Jul-Oct', deadline: '5 November' },
          q3: { period: 'Oct-Jan', deadline: '5 February' },
          q4: { period: 'Jan-Apr', deadline: '5 May' }
        },
        annual: {
          deadline: '31 January',
          note: 'Must be submitted after all quarterly submissions'
        }
      }
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration'
    });
  }
});

/**
 * POST /api/files/validate
 * Validate file before processing (lightweight check)
 */
router.post('/validate',
  uploadLimiter,
  getUploadMiddleware(),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided for validation'
        });
      }

      // Quick validation without full processing
      const uploadResult = await processSpreadsheet(req.file, { validateOnly: true });
      
      res.json({
        success: true,
        validation: {
          fileName: uploadResult.metadata.fileName,
          fileSize: uploadResult.metadata.fileSize,
          detectedColumns: uploadResult.metadata.detectedColumns,
          estimatedRows: uploadResult.metadata.processedRows,
          isValid: true,
          recommendations: generateFileRecommendations(uploadResult)
        }
      });

    } catch (error) {
      console.error('File validation failed:', error);
      res.status(400).json({
        success: false,
        error: 'File validation failed',
        message: error.message,
        recommendations: [
          'Ensure file is in .xlsx, .xls, or .csv format',
          'Check that file contains transaction data',
          'Verify file is not corrupted or empty'
        ]
      });
    }
  }
);

// ====== HELPER FUNCTIONS ======

/**
 * Generate recommended actions based on processing results
 * @param {Object} categorization - Categorization results
 * @param {Object} submission - Submission data
 * @returns {Array} Recommended actions
 */
function generateRecommendedActions(categorization, submission) {
  const actions = [];

  // Check for manual review items
  if (categorization.summary.manualReviewRequired > 0) {
    actions.push({
      priority: 'high',
      action: 'Review flagged transactions',
      description: `${categorization.summary.manualReviewRequired} transactions need manual review`,
      category: 'data_quality'
    });
  }

  // Check for high error rate
  if (categorization.summary.errors > categorization.totalRows * 0.1) {
    actions.push({
      priority: 'medium',
      action: 'Check data quality',
      description: 'High error rate detected - consider cleaning spreadsheet data',
      category: 'data_quality'
    });
  }

  // Check for high personal transaction rate
  if (categorization.summary.personal > categorization.totalRows * 0.2) {
    actions.push({
      priority: 'medium',
      action: 'Review personal transactions',
      description: 'High number of personal transactions detected',
      category: 'categorization'
    });
  }

  // Submission-specific recommendations
  if (submission.submission?.summary?.netProfitLoss < 0) {
    actions.push({
      priority: 'info',
      action: 'Review loss calculation',
      description: 'Business shows a loss - ensure all income is captured',
      category: 'financial'
    });
  }

  return actions;
}

/**
 * Generate file recommendations based on upload analysis
 * @param {Object} uploadResult - Upload analysis result
 * @returns {Array} File recommendations
 */
function generateFileRecommendations(uploadResult) {
  const recommendations = [];

  if (uploadResult.metadata.emptyRowsRemoved > 0) {
    recommendations.push('File contained empty rows which were automatically removed');
  }

  if (uploadResult.metadata.columnCount < 3) {
    recommendations.push('Consider including more columns (date, description, amount) for better categorization');
  }

  if (uploadResult.metadata.processedRows > 5000) {
    recommendations.push('Large file detected - processing may take longer than usual');
  }

  return recommendations;
}

// ====== ERROR HANDLING MIDDLEWARE ======

// Global error handler for this route
router.use((error, req, res, next) => {
  console.error('Files route error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large',
      message: 'Maximum file size is 10MB'
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Invalid file field',
      message: 'Use field name "spreadsheet" for file upload'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

module.exports = router;