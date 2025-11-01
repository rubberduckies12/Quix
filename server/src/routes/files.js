const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');
const { AppError, ValidationError, createFieldError } = require('../utils/errors.util');
const { processSpreadsheet, getUploadMiddleware } = require('../services/upload.service');
const { processQuarterlySubmission } = require('../services/quarterly-submission.service');
const { processAnnualDeclaration } = require('../services/annual-submission.service');
const { processSpreadsheetLineByLine } = require('../utils/categorization.util');

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
  body('submissionType')
    .isIn(['quarterly', 'annual'])
    .withMessage('Submission type must be quarterly or annual'),
    
  body('businessType')
    .isIn(['sole_trader', 'landlord', 'vat_registered'])
    .withMessage('Business type must be sole_trader, landlord, or vat_registered'),
    
  body('quarter')
    .optional()
    .isIn(['q1', 'q2', 'q3', 'q4'])
    .withMessage('Quarter must be q1, q2, q3, or q4'),
    
  // Conditional validation: quarter required for quarterly submissions
  body('quarter').custom((value, { req }) => {
    if (req.body.submissionType === 'quarterly' && !value) {
      throw new Error('Quarter is required for quarterly submissions');
    }
    if (req.body.submissionType === 'annual' && value) {
      throw new Error('Quarter should not be provided for annual submissions');
    }
    return true;
  })
];

/**
 * POST /api/files/process
 * Main endpoint for spreadsheet upload and processing
 * 
 * Body:
 * - submissionType: 'quarterly' | 'annual'
 * - businessType: 'sole_trader' | 'landlord' | 'vat_registered'
 * - quarter: 'q1' | 'q2' | 'q3' | 'q4' (required for quarterly)
 * 
 * File: spreadsheet (.xlsx, .xls, .csv)
 */
router.post('/process', 
  uploadLimiter,
  getUploadMiddleware(),
  validateProcessingRequest,
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { submissionType, businessType, quarter } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          message: 'Please select a spreadsheet file to upload'
        });
      }

      console.log(`Processing ${submissionType} submission for ${businessType}${quarter ? ` (${quarter})` : ''}`);

      // Initialize processing tracker
      let currentStage = 'upload';
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
        businessType,
        quarter
      }, progressCallback);

      if (!uploadResult.rawRows || uploadResult.rawRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid data found in spreadsheet',
          message: 'The uploaded file contains no processable transaction data',
          uploadDetails: uploadResult.metadata
        });
      }

      // STEP 2: AI Categorization
      currentStage = 'categorization';
      console.log('Step 2: AI categorizing transactions...');
      
      // Convert business type for categorization (VAT registered is treated as sole trader for categorization)
      const categorizationBusinessType = businessType === 'vat_registered' ? 'sole_trader' : businessType;
      
      const categorizationResults = await processSpreadsheetLineByLine(
        uploadResult.rawRows,
        categorizationBusinessType,
        progressCallback
      );

      if (categorizationResults.summary.successful === 0) {
        return res.status(400).json({
          success: false,
          error: 'No transactions could be categorized successfully',
          message: 'All transactions either failed processing or were identified as personal',
          categorizationSummary: categorizationResults.summary,
          errors: categorizationResults.errors.slice(0, 5) // Show first 5 errors
        });
      }

      // STEP 3: Generate submission based on type
      currentStage = 'submission';
      console.log(`Step 3: Generating ${submissionType} submission...`);
      
      let submissionResult;
      
      if (submissionType === 'quarterly') {
        // Generate quarterly submission
        submissionResult = await processQuarterlySubmission(
          categorizationResults,
          quarter,
          categorizationBusinessType,
          progressCallback
        );
        
        // Add VAT information if applicable
        if (businessType === 'vat_registered') {
          submissionResult = addVATInformation(submissionResult, categorizationResults);
        }
        
      } else {
        // Generate annual submission
        submissionResult = await processAnnualDeclaration(
          categorizationResults,
          categorizationBusinessType,
          null, // No quarterly data provided
          progressCallback
        );
        
        // Add VAT information if applicable
        if (businessType === 'vat_registered') {
          submissionResult = addVATInformation(submissionResult, categorizationResults);
        }
      }

      // STEP 4: Compile final response
      const finalResponse = {
        success: true,
        submissionType,
        businessType,
        quarter: submissionType === 'quarterly' ? quarter : undefined,
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
        
        // Main submission data
        submission: submissionResult,
        
        // Processing details for debugging/review
        processingDetails: {
          uploadSuccess: true,
          categorizationSuccess: true,
          submissionSuccess: true,
          processingTime: Date.now(), // Could calculate actual time
          stages: processingTracker
        },
        
        // Quality indicators
        dataQuality: {
          successRate: Math.round((categorizationResults.summary.successful / categorizationResults.totalRows) * 100),
          personalTransactionRate: Math.round((categorizationResults.summary.personal / categorizationResults.totalRows) * 100),
          errorRate: Math.round((categorizationResults.summary.errors / categorizationResults.totalRows) * 100),
          needsReview: (categorizationResults.summary.manualReviewRequired || 0) > 0,
          recommendedActions: generateRecommendedActions(categorizationResults, submissionResult)
        }
      };

      // Log successful processing
      console.log(`Successfully processed ${submissionType} submission:`, {
        fileName: uploadResult.metadata.fileName,
        transactions: categorizationResults.totalRows,
        successful: categorizationResults.summary.successful,
        submissionType,
        businessType
      });

      res.json(finalResponse);

    } catch (error) {
      console.error('File processing failed:', error);
      
      // Determine error type and respond appropriately
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
          details: error.errors,
          field: error.field
        });
      }
      
      if (error instanceof AppError) {
        return res.status(error.statusCode || 500).json({
          success: false,
          error: error.code || 'Processing Error',
          message: error.message,
          stage: currentStage
        });
      }
      
      // Generic error
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during file processing',
        stage: currentStage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
        supportedBusinessTypes: ['sole_trader', 'landlord', 'vat_registered'],
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
 * Add VAT information to submission for VAT registered businesses
 * @param {Object} submission - Submission data
 * @param {Object} categorization - Categorization results
 * @returns {Object} Enhanced submission with VAT data
 */
function addVATInformation(submission, categorization) {
  // Calculate VAT analysis
  const vatAnalysis = calculateVATAnalysis(categorization);
  
  return {
    ...submission,
    vatInformation: {
      vatRegistered: true,
      vatAnalysis,
      vatSummary: {
        outputVAT: vatAnalysis.outputVAT,
        inputVAT: vatAnalysis.inputVAT,
        netVAT: vatAnalysis.outputVAT - vatAnalysis.inputVAT
      },
      vatNote: 'VAT calculations are estimates. Please verify with your accountant.'
    }
  };
}

/**
 * Calculate VAT analysis for VAT registered businesses
 * @param {Object} categorization - Categorization results
 * @returns {Object} VAT analysis
 */
function calculateVATAnalysis(categorization) {
  const vatAnalysis = {
    outputVAT: 0, // VAT on sales
    inputVAT: 0,  // VAT on purchases
    vatExemptSales: 0,
    vatExemptPurchases: 0
  };

  categorization.processedTransactions.forEach(transaction => {
    if (!transaction.isPersonal && transaction.originalAmount) {
      const amount = Math.abs(transaction.originalAmount);
      
      // Simple VAT calculation (20% standard rate)
      // This is a basic implementation - real VAT calculation is more complex
      if (transaction.hmrcCategory === 'turnover' || transaction.hmrcCategory === 'periodAmount') {
        // Income - calculate output VAT
        vatAnalysis.outputVAT += amount * 0.2 / 1.2; // Extract VAT from VAT-inclusive amount
      } else {
        // Expenses - calculate input VAT
        vatAnalysis.inputVAT += amount * 0.2 / 1.2; // Extract VAT from VAT-inclusive amount
      }
    }
  });

  // Round to 2 decimal places
  vatAnalysis.outputVAT = parseFloat(vatAnalysis.outputVAT.toFixed(2));
  vatAnalysis.inputVAT = parseFloat(vatAnalysis.inputVAT.toFixed(2));

  return vatAnalysis;
}

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