const { validateTransaction, validateTransactionDescription, sanitizeString } = require('./validation.util');
const { ValidationError, createFieldError, AppError } = require('./errors.util');
const { formatForDisplay, getCurrentTaxYear } = require('./date.util');
const vertexAI = require('../external/vertex-ai.external');
const fs = require('fs').promises;
const path = require('path');

/**
 * MTD Categorization Utility for HMRC Tax Categories
 * AI-powered transaction categorization for sole traders and landlords
 */
class CategorizationUtil {
  constructor() {
    this.config = {
      // HMRC MTD Official Categories for AI reference
      hmrcCategories: {
        selfEmployment: {
          expenses: [
            'costOfGoodsBought', 'cisPaymentsToSubcontractors', 'staffCosts', 
            'travelCosts', 'premisesRunningCosts', 'maintenanceCosts', 
            'adminCosts', 'advertisingCosts', 'businessEntertainmentCosts',
            'interestOnBankOtherLoans', 'financialCharges', 'badDebt',
            'professionalFees', 'depreciation', 'other'
          ],
          income: ['turnover', 'other']
        },
        property: {
          expenses: [
            'premisesRunningCosts', 'repairsAndMaintenance', 'financialCosts',
            'professionalFees', 'costOfServices', 'travelCosts', 'other'
          ],
          income: ['periodAmount', 'premiumsOfLeaseGrant', 'reversePremiums']
        }
      },

      // Business type validation
      allowedBusinessTypes: ['sole_trader', 'landlord'],

      // AI configuration
      aiConfig: {
        maxRetries: 3,
        timeoutMs: 15000,
        batchSize: 10,
        rateLimitDelayMs: 200
      },

      // Error codes
      errorCodes: {
        INVALID_BUSINESS_TYPE: 'INVALID_BUSINESS_TYPE',
        AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
        CATEGORIZATION_FAILED: 'CATEGORIZATION_FAILED',
        PERSONAL_TRANSACTION: 'PERSONAL_TRANSACTION',
        INVALID_TRANSACTION_DATA: 'INVALID_TRANSACTION_DATA',
        FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
        UNSUPPORTED_CATEGORY: 'UNSUPPORTED_CATEGORY'
      }
    };

    // Initialize processing cache
    this.processingCache = new Map();
  }

  // ====== MAIN SPREADSHEET PROCESSING METHODS ======

  /**
   * Process entire spreadsheet line by line using AI
   * @param {Array} spreadsheetData - Array of transaction rows
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Object} Complete categorization results
   */
  async processSpreadsheetLineByLine(spreadsheetData, businessType = 'sole_trader', progressCallback = null) {
    this._validateBusinessType(businessType);

    const results = {
      totalRows: spreadsheetData.length,
      processedTransactions: [],
      personalTransactions: [],
      errors: [],
      summary: {
        successful: 0,
        personal: 0,
        errors: 0,
        aiCategorized: 0,
        manualReviewRequired: 0
      },
      processingDate: new Date().toISOString(),
      businessType
    };

    console.log(`Starting AI categorization of ${spreadsheetData.length} transactions for ${businessType}`);

    // Process rows in batches to manage AI service load
    const batchSize = this.config.aiConfig.batchSize;
    for (let i = 0; i < spreadsheetData.length; i += batchSize) {
      const batch = spreadsheetData.slice(i, Math.min(i + batchSize, spreadsheetData.length));
      
      await this._processBatch(batch, businessType, results, i, progressCallback);
      
      // Rate limiting between batches
      if (i + batchSize < spreadsheetData.length) {
        await this._delay(this.config.aiConfig.rateLimitDelayMs);
      }
    }

    console.log(`AI categorization complete. Successful: ${results.summary.successful}, Errors: ${results.summary.errors}`);
    return results;
  }

  /**
   * Process a single spreadsheet row through AI
   * @param {Object} row - Single transaction row with amount, description, date
   * @param {string} businessType - Business type context
   * @returns {Object} Categorized transaction result
   */
  async processRowThroughAI(row, businessType = 'sole_trader') {
    try {
      // Validate and parse row data
      const validationResult = this._validateRowData(row);
      if (!validationResult.isValid) {
        throw new ValidationError(validationResult.error, validationResult.errors);
      }

      const { amount, description, date } = this._parseSpreadsheetRow(row);
      
      // Clean description for AI processing
      const cleanedDescription = this._cleanDescription(description);
      
      // Check for personal transaction first
      const personalCheck = this._detectPersonalTransaction(cleanedDescription, amount);
      if (personalCheck.isPersonal) {
        return this._createPersonalTransactionResult(row, cleanedDescription, personalCheck);
      }

      // Send to AI for intelligent categorization
      const aiResult = await this._sendLineToAI(amount, cleanedDescription, date, businessType);
      
      return this._createSuccessfulResult(row, cleanedDescription, aiResult, businessType);

    } catch (error) {
      console.error(`Error processing row:`, error.message);
      return this._createErrorResult(row, error);
    }
  }

  // ====== AI INTEGRATION METHODS ======

  /**
   * Send individual transaction line to AI for categorization
   * @param {number} amount - Transaction amount
   * @param {string} description - Cleaned transaction description
   * @param {string} date - Transaction date
   * @param {string} businessType - Business context
   * @returns {Object} AI categorization result
   */
  async _sendLineToAI(amount, description, date, businessType) {
    // Check cache first
    const cacheKey = this._createCacheKey(description, amount, businessType);
    if (this.processingCache.has(cacheKey)) {
      return this.processingCache.get(cacheKey);
    }

    const prompt = this._createAIPrompt(amount, description, date, businessType);
    
    let lastError;
    for (let attempt = 1; attempt <= this.config.aiConfig.maxRetries; attempt++) {
      try {
        const aiResponse = await vertexAI.categorizeTransaction(prompt, {
          timeout: this.config.aiConfig.timeoutMs,
          businessType
        });

        const categorization = this._intelligentCategoryMatching(aiResponse, businessType);
        
        if (categorization.category) {
          // Cache successful result
          this.processingCache.set(cacheKey, categorization);
          return categorization;
        } else {
          throw new Error('AI did not return a valid category');
        }

      } catch (error) {
        lastError = error;
        console.warn(`AI categorization attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.config.aiConfig.maxRetries) {
          await this._delay(1000 * attempt); // Exponential backoff
        }
      }
    }

    throw new AppError(
      `AI categorization failed after ${this.config.aiConfig.maxRetries} attempts: ${lastError.message}`,
      500,
      this.config.errorCodes.AI_SERVICE_ERROR
    );
  }

  /**
   * Create intelligent AI prompt for categorization
   * @param {number} amount - Transaction amount
   * @param {string} description - Transaction description
   * @param {string} date - Transaction date
   * @param {string} businessType - Business context
   * @returns {string} AI prompt
   */
  _createAIPrompt(amount, description, date, businessType) {
    const businessContext = businessType === 'landlord' 
      ? 'UK property rental business'
      : 'UK sole trader self-employment business';

    const validCategories = this._getValidCategoriesForBusinessType(businessType);

    let prompt = `You are an expert UK tax advisor analyzing a business expense for HMRC Making Tax Digital categorization.

BUSINESS CONTEXT: ${businessContext}
TRANSACTION DETAILS:
- Amount: £${Math.abs(amount)}
- Description: "${description}"
- Date: ${date || 'Not specified'}

TASK: Analyze this expense and determine the most appropriate HMRC category based on its business purpose and context.

AVAILABLE CATEGORIES: ${validCategories.join(', ')}

ANALYSIS GUIDELINES:
- Consider the amount when determining category (small amounts might be admin costs, larger amounts might be equipment/premises)
- Understand UK business terminology and common expense types
- Focus on the business purpose of the expense, not just keywords
- Consider context clues in the description
- If this appears to be a personal expense (groceries, personal shopping, etc.), respond with "PERSONAL"
- If genuinely uncertain, respond with "MANUAL_REVIEW"

EXAMPLES FOR CONTEXT:
- "£130 hotel Birmingham" → travelCosts (business travel accommodation)
- "£45 accountant quarterly" → professionalFees (professional service)
- "£250 office rent monthly" → premisesRunningCosts (business premises)
- "£15 pens and paper" → adminCosts (office supplies)
- "£500 laptop Dell" → other (business equipment)

RESPONSE FORMAT: Return ONLY the exact category code (e.g., "travelCosts") or "PERSONAL" or "MANUAL_REVIEW"`;

    return prompt;
  }

  /**
   * Intelligent category matching from AI response
   * @param {string} aiResponse - Raw AI response
   * @param {string} businessType - Business context
   * @returns {Object} Parsed categorization result
   */
  _intelligentCategoryMatching(aiResponse, businessType) {
    if (!aiResponse || typeof aiResponse !== 'string') {
      throw new Error('Invalid AI response format');
    }

    const cleanResponse = aiResponse.trim().toLowerCase();
    
    // Handle special responses
    if (cleanResponse === 'personal' || cleanResponse.includes('personal')) {
      return { category: null, isPersonal: true, aiAnalysis: 'Identified as personal expense' };
    }

    if (cleanResponse === 'manual_review' || cleanResponse.includes('manual_review')) {
      return { category: 'MANUAL_REVIEW', aiAnalysis: 'Requires manual review', requiresReview: true };
    }

    // Validate AI returned a valid HMRC category
    const validCategories = this._getValidCategoriesForBusinessType(businessType);
    const category = this._extractCategoryFromResponse(cleanResponse, validCategories);
    
    if (!category) {
      throw new Error(`AI returned unrecognized category: ${aiResponse}`);
    }

    const categoryInfo = this._getCategoryInfo(category, businessType);
    
    return {
      category,
      aiAnalysis: `AI categorized as ${categoryInfo.description}`,
      categoryDescription: categoryInfo.description,
      confidence: 0.95 // AI decisions are considered highly confident
    };
  }

  // ====== SPREADSHEET PARSING METHODS ======

  /**
   * Parse individual spreadsheet row
   * @param {Object} row - Raw spreadsheet row
   * @returns {Object} Parsed transaction data
   */
  _parseSpreadsheetRow(row) {
    // Handle different possible column names/formats
    const amount = this._extractAmount(row);
    const description = this._extractDescription(row);
    const date = this._extractDate(row);

    return { amount, description, date };
  }

  /**
   * Extract amount from row (handles various column names)
   * @param {Object} row - Spreadsheet row
   * @returns {number} Transaction amount
   */
  _extractAmount(row) {
    const amountFields = ['amount', 'Amount', 'AMOUNT', 'value', 'Value', 'sum', 'total'];
    
    for (const field of amountFields) {
      if (row[field] !== undefined && row[field] !== null) {
        const amount = parseFloat(String(row[field]).replace(/[£,\s]/g, ''));
        if (!isNaN(amount)) {
          return amount;
        }
      }
    }
    
    throw new Error('No valid amount found in row');
  }

  /**
   * Extract description from row
   * @param {Object} row - Spreadsheet row
   * @returns {string} Transaction description
   */
  _extractDescription(row) {
    const descFields = ['description', 'Description', 'DESCRIPTION', 'details', 'Details', 'narrative', 'reference'];
    
    for (const field of descFields) {
      if (row[field] && typeof row[field] === 'string' && row[field].trim()) {
        return row[field].trim();
      }
    }
    
    throw new Error('No valid description found in row');
  }

  /**
   * Extract date from row
   * @param {Object} row - Spreadsheet row
   * @returns {string} Transaction date
   */
  _extractDate(row) {
    const dateFields = ['date', 'Date', 'DATE', 'transaction_date', 'transactionDate'];
    
    for (const field of dateFields) {
      if (row[field]) {
        return String(row[field]);
      }
    }
    
    return new Date().toISOString().split('T')[0]; // Default to today
  }

  // ====== VALIDATION AND HELPER METHODS ======

  /**
   * Validate individual row data
   * @param {Object} row - Spreadsheet row
   * @returns {Object} Validation result
   */
  _validateRowData(row) {
    if (!row || typeof row !== 'object') {
      return {
        isValid: false,
        error: 'Row must be an object',
        errors: [createFieldError('row', 'Invalid row data')]
      };
    }

    const errors = [];

    try {
      this._extractAmount(row);
    } catch (error) {
      errors.push(createFieldError('amount', error.message));
    }

    try {
      this._extractDescription(row);
    } catch (error) {
      errors.push(createFieldError('description', error.message));
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean transaction description for AI processing
   * @param {string} description - Raw description
   * @returns {string} Cleaned description
   */
  _cleanDescription(description) {
    if (!description || typeof description !== 'string') {
      return '';
    }

    let cleaned = sanitizeString(description);
    
    // Remove bank-specific codes and references
    cleaned = cleaned.replace(/\b(TXN|REF|AUTH|ID|DD|SO|BP|CHG|FEE|INT|TFR)[\s:]*\d+/gi, '');
    
    // Remove dates and transaction IDs
    cleaned = cleaned.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '');
    cleaned = cleaned.replace(/\b[A-Z0-9]{8,}\b/g, '');
    
    // Clean up whitespace and common prefixes
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove common transaction prefixes
    const prefixes = ['DD:', 'SO:', 'BP:', 'CHG:', 'FEE:', 'INT:', 'TFR:', 'PAYMENT TO', 'TRANSFER TO'];
    for (const prefix of prefixes) {
      if (cleaned.toUpperCase().startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }

    return cleaned;
  }

  /**
   * Detect if transaction appears personal
   * @param {string} description - Cleaned description
   * @param {number} amount - Transaction amount
   * @returns {Object} Personal detection result
   */
  _detectPersonalTransaction(description, amount) {
    const personalIndicators = [
      'tesco', 'sainsbury', 'asda', 'morrisons', 'waitrose',
      'groceries', 'supermarket', 'clothes', 'clothing', 'fashion',
      'personal', 'private', 'gym', 'fitness', 'netflix', 'spotify',
      'haircut', 'beauty', 'family', 'children', 'school fees'
    ];

    const lowerDesc = description.toLowerCase();
    const foundIndicators = personalIndicators.filter(indicator => 
      lowerDesc.includes(indicator)
    );

    return {
      isPersonal: foundIndicators.length > 0,
      indicators: foundIndicators,
      confidence: Math.min(0.9, foundIndicators.length * 0.3)
    };
  }

  // ====== JSON OUTPUT METHODS ======

  /**
   * Generate categorized JSON output
   * @param {Object} processingResults - Results from processSpreadsheetLineByLine
   * @param {string} outputPath - Output file path
   * @returns {Object} File generation result
   */
  async generateCategorizedJSON(processingResults, outputPath) {
    try {
      const jsonData = {
        metadata: {
          generatedDate: new Date().toISOString(),
          taxYear: getCurrentTaxYear(),
          totalTransactions: processingResults.totalRows,
          successfullyProcessed: processingResults.summary.successful,
          personalTransactions: processingResults.summary.personal,
          errorCount: processingResults.summary.errors,
          businessType: processingResults.businessType,
          aiCategorized: processingResults.summary.aiCategorized,
          version: '2.0'
        },
        transactions: this._compileResults(processingResults),
        categorySummary: this._generateCategorySummary(processingResults.processedTransactions),
        processingStats: processingResults.summary
      };

      // Ensure output directory exists
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });

      // Write JSON file
      await fs.writeFile(outputPath, JSON.stringify(jsonData, null, 2), 'utf8');

      return {
        success: true,
        filePath: outputPath,
        fileSize: Buffer.byteLength(JSON.stringify(jsonData), 'utf8'),
        transactionCount: processingResults.totalRows,
        metadata: jsonData.metadata
      };

    } catch (error) {
      throw new AppError(
        `Failed to generate JSON file: ${error.message}`,
        500,
        this.config.errorCodes.FILE_WRITE_ERROR
      );
    }
  }

  /**
   * Compile all processing results into final format
   * @param {Object} results - Processing results
   * @returns {Array} Compiled transaction results
   */
  _compileResults(results) {
    const allTransactions = [
      ...results.processedTransactions,
      ...results.personalTransactions,
      ...results.errors
    ];

    return allTransactions.map(transaction => ({
      transactionId: transaction.transactionId || this._generateTransactionId(),
      originalAmount: transaction.originalAmount,
      originalDescription: transaction.originalDescription,
      cleanedDescription: transaction.cleanedDescription,
      hmrcCategory: transaction.hmrcCategory,
      aiAnalysis: transaction.aiAnalysis,
      categoryDescription: transaction.categoryDescription,
      isPersonal: transaction.isPersonal || false,
      requiresManualReview: transaction.requiresManualReview || false,
      processingDate: transaction.processingDate || new Date().toISOString(),
      businessType: results.businessType,
      error: transaction.error,
      errorCode: transaction.errorCode
    }));
  }

  // ====== PRIVATE HELPER METHODS ======

  /**
   * Process a batch of transactions
   * @private
   */
  async _processBatch(batch, businessType, results, startIndex, progressCallback) {
    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const currentIndex = startIndex + i;
      
      try {
        const result = await this.processRowThroughAI(row, businessType);
        
        if (result.error) {
          results.errors.push(result);
          results.summary.errors++;
        } else if (result.isPersonal) {
          results.personalTransactions.push(result);
          results.summary.personal++;
        } else if (result.requiresManualReview) {
          results.processedTransactions.push(result);
          results.summary.manualReviewRequired++;
        } else {
          results.processedTransactions.push(result);
          results.summary.successful++;
          results.summary.aiCategorized++;
        }

        // Progress callback
        if (progressCallback && typeof progressCallback === 'function') {
          progressCallback({
            completed: currentIndex + 1,
            total: results.totalRows,
            percentage: Math.round(((currentIndex + 1) / results.totalRows) * 100),
            currentTransaction: result
          });
        }

      } catch (error) {
        const errorResult = this._createErrorResult(row, error);
        results.errors.push(errorResult);
        results.summary.errors++;
      }

      // Small delay between AI calls
      if (i < batch.length - 1) {
        await this._delay(this.config.aiConfig.rateLimitDelayMs);
      }
    }
  }

  /**
   * Create cache key for processed transactions
   * @private
   */
  _createCacheKey(description, amount, businessType) {
    return `${businessType}:${Math.abs(amount)}:${description.toLowerCase().substring(0, 50)}`;
  }

  /**
   * Extract category from AI response
   * @private
   */
  _extractCategoryFromResponse(response, validCategories) {
    // Clean response
    const cleaned = response.replace(/['"]/g, '').replace(/\.$/, '').trim();
    
    // Try exact match
    if (validCategories.includes(cleaned)) {
      return cleaned;
    }
    
    // Try case-insensitive match
    for (const category of validCategories) {
      if (category.toLowerCase() === cleaned) {
        return category;
      }
    }
    
    return null;
  }

  /**
   * Get valid categories for business type
   * @private
   */
  _getValidCategoriesForBusinessType(businessType) {
    const categories = businessType === 'landlord' 
      ? this.config.hmrcCategories.property
      : this.config.hmrcCategories.selfEmployment;

    return [...categories.expenses, ...categories.income];
  }

  /**
   * Get category information
   * @private
   */
  _getCategoryInfo(categoryCode, businessType) {
    // This would ideally come from a detailed category definition
    // For now, return basic info
    return {
      code: categoryCode,
      description: this._getCategoryDescription(categoryCode),
      type: this._getCategoryType(categoryCode, businessType)
    };
  }

  /**
   * Get category description
   * @private
   */
  _getCategoryDescription(categoryCode) {
    const descriptions = {
      'travelCosts': 'Business travel costs',
      'premisesRunningCosts': 'Premises running costs',
      'adminCosts': 'Administrative costs',
      'professionalFees': 'Professional fees',
      'advertisingCosts': 'Advertising and marketing',
      'costOfGoodsBought': 'Cost of goods bought',
      'staffCosts': 'Staff costs',
      'maintenanceCosts': 'Maintenance costs',
      'financialCharges': 'Financial charges',
      'repairsAndMaintenance': 'Repairs and maintenance',
      'financialCosts': 'Financial costs',
      'costOfServices': 'Cost of services',
      'turnover': 'Business turnover',
      'periodAmount': 'Rental income',
      'other': 'Other allowable expenses'
    };
    
    return descriptions[categoryCode] || 'Business expense';
  }

  /**
   * Get category type (expense/income)
   * @private
   */
  _getCategoryType(categoryCode, businessType) {
    const incomeCategories = businessType === 'landlord' 
      ? ['periodAmount', 'premiumsOfLeaseGrant', 'reversePremiums']
      : ['turnover', 'other'];
    
    return incomeCategories.includes(categoryCode) ? 'income' : 'expense';
  }

  /**
   * Validate business type
   * @private
   */
  _validateBusinessType(businessType) {
    if (!this.config.allowedBusinessTypes.includes(businessType)) {
      throw new ValidationError(
        `Invalid business type: ${businessType}. Must be one of: ${this.config.allowedBusinessTypes.join(', ')}`,
        [],
        'businessType'
      );
    }
  }

  /**
   * Create result objects
   * @private
   */
  _createSuccessfulResult(row, cleanedDescription, aiResult, businessType) {
    return {
      transactionId: this._generateTransactionId(),
      originalAmount: this._extractAmount(row),
      originalDescription: this._extractDescription(row),
      cleanedDescription,
      hmrcCategory: aiResult.category,
      aiAnalysis: aiResult.aiAnalysis,
      categoryDescription: aiResult.categoryDescription,
      processingDate: new Date().toISOString(),
      businessType,
      requiresManualReview: aiResult.requiresReview || false
    };
  }

  _createPersonalTransactionResult(row, cleanedDescription, personalCheck) {
    return {
      transactionId: this._generateTransactionId(),
      originalAmount: this._extractAmount(row),
      originalDescription: this._extractDescription(row),
      cleanedDescription,
      hmrcCategory: null,
      isPersonal: true,
      personalIndicators: personalCheck.indicators,
      processingDate: new Date().toISOString(),
      error: 'Transaction appears to be personal rather than business'
    };
  }

  _createErrorResult(row, error) {
    return {
      transactionId: this._generateTransactionId(),
      originalAmount: row.amount || null,
      originalDescription: row.description || 'Unknown',
      error: error.message,
      errorCode: error.code || this.config.errorCodes.CATEGORIZATION_FAILED,
      processingDate: new Date().toISOString()
    };
  }

  /**
   * Generate transaction ID
   * @private
   */
  _generateTransactionId() {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate category summary
   * @private
   */
  _generateCategorySummary(transactions) {
    const summary = {};
    
    transactions.forEach(transaction => {
      if (transaction.hmrcCategory && !transaction.isPersonal) {
        if (!summary[transaction.hmrcCategory]) {
          summary[transaction.hmrcCategory] = {
            count: 0,
            totalAmount: 0,
            description: transaction.categoryDescription
          };
        }
        
        summary[transaction.hmrcCategory].count++;
        if (transaction.originalAmount) {
          summary[transaction.hmrcCategory].totalAmount += Math.abs(transaction.originalAmount);
        }
      }
    });

    return summary;
  }

  /**
   * Add processing delay
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ====== PUBLIC API METHODS ======

  /**
   * Get available HMRC categories
   * @param {string} businessType - Business type
   * @returns {Object} Available categories
   */
  getAvailableCategories(businessType = 'sole_trader') {
    this._validateBusinessType(businessType);
    return this.config.hmrcCategories[businessType === 'landlord' ? 'property' : 'selfEmployment'];
  }

  /**
   * Clear processing cache
   */
  clearCache() {
    this.processingCache.clear();
  }

  /**
   * Get configuration
   * @returns {Object} Public configuration
   */
  getConfig() {
    return {
      allowedBusinessTypes: [...this.config.allowedBusinessTypes],
      errorCodes: { ...this.config.errorCodes }
    };
  }
}

// Create and export singleton instance
const categorizationUtil = new CategorizationUtil();

module.exports = {
  CategorizationUtil,
  default: categorizationUtil,
  
  // Export main processing functions
  processSpreadsheetLineByLine: (spreadsheetData, businessType, progressCallback) => 
    categorizationUtil.processSpreadsheetLineByLine(spreadsheetData, businessType, progressCallback),
  processRowThroughAI: (row, businessType) => 
    categorizationUtil.processRowThroughAI(row, businessType),
  generateCategorizedJSON: (results, outputPath) => 
    categorizationUtil.generateCategorizedJSON(results, outputPath),
  getAvailableCategories: (businessType) => 
    categorizationUtil.getAvailableCategories(businessType),
  clearCache: () => 
    categorizationUtil.clearCache()
};