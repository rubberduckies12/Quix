const { AppError, ValidationError } = require('../utils/errors.util');
const { formatForDisplay, getCurrentTaxYear, isValidQuarter } = require('../utils/date.util');
const { processSpreadsheetLineByLine } = require('../utils/categorization.util');

/**
 * MTD Quarterly Submission Service
 * Processes categorized transactions and formats them for HMRC quarterly submissions
 */
class QuarterlySubmissionService {
  constructor() {
    this.config = {
      // Quarter deadlines
      quarterDeadlines: {
        'q1': { period: 'Apr-Jul', deadline: '5 August' },
        'q2': { period: 'Jul-Oct', deadline: '5 November' },
        'q3': { period: 'Oct-Jan', deadline: '5 February' },
        'q4': { period: 'Jan-Apr', deadline: '5 May' }
      },

      // Complete HMRC MTD Category Codes - EXACT codes required by HMRC
      hmrcCategories: {
        selfEmployment: {
          income: [
            'turnover',  // Business sales, fees, commission, self-employment income
            'other'      // Other business income (grants, insurance payouts, etc.)
          ],
          expenses: [
            'costOfGoodsBought',              // Raw materials, stock, goods bought for resale
            'cisPaymentsToSubcontractors',    // Construction Industry Scheme payments
            'staffCosts',                     // Wages, salaries, subcontractor payments, employer NICs
            'travelCosts',                    // Business travel, fuel, parking, hotels (not home to work)
            'premisesRunningCosts',           // Rent, business rates, heating, lighting, cleaning
            'maintenanceCosts',               // Repairs and maintenance of property and equipment
            'adminCosts',                     // Phone, fax, stationery, postage, small equipment
            'advertisingCosts',               // Advertising, marketing, website costs
            'businessEntertainmentCosts',     // Entertaining clients, customer hospitality
            'interestOnBankOtherLoans',       // Business loan interest, hire purchase interest
            'financialCharges',               // Bank charges, credit card charges, factoring charges
            'badDebt',                        // Irrecoverable debts written off
            'professionalFees',               // Accountant, solicitor, architect, surveyor fees
            'depreciation',                   // Depreciation of equipment and machinery
            'other'                           // Other allowable business expenses
          ]
        },
        property: {
          income: [
            'premiumsOfLeaseGrant',  // Property premiums received
            'reversePremiums',       // Reverse premiums
            'periodAmount',          // Rental income received
            'taxDeducted'            // Tax deducted at source
          ],
          expenses: [
            'premisesRunningCosts',  // Rent, rates, insurance, ground rent
            'repairsAndMaintenance', // Maintenance, repairs, redecoration
            'financialCosts',        // Mortgage interest, loan interest
            'professionalFees',      // Letting agent fees, legal fees, accountant fees
            'costOfServices',        // Gardening, cleaning, security services
            'travelCosts',           // Travel to inspect properties
            'other'                  // Other allowable property expenses
          ]
        }
      },

      // Capital Allowances (Annual Only - excluded from quarterly)
      capitalAllowances: [
        'annualInvestmentAllowance',           // Equipment, computers, machinery (up to £1M)
        'capitalAllowanceMainPool',            // General equipment (18% allowance)
        'capitalAllowanceSpecialRatePool',     // Integral building features (6% allowance)
        'zeroEmissionGoodsVehicle',           // Electric vehicles (100% allowance)
        'businessPremisesRenovationAllowance', // Building renovation costs
        'enhancedCapitalAllowance',            // Energy-efficient equipment
        'allowanceOnSales'                     // Balancing allowances/charges on disposals
      ],

      // Error codes
      errorCodes: {
        INVALID_QUARTER: 'INVALID_QUARTER',
        INVALID_BUSINESS_TYPE: 'INVALID_BUSINESS_TYPE',
        CATEGORIZATION_FAILED: 'CATEGORIZATION_FAILED',
        CALCULATION_FAILED: 'CALCULATION_FAILED',
        INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
        INVALID_CATEGORY: 'INVALID_CATEGORY'
      }
    };
  }

  /**
   * Process spreadsheet and create quarterly submission
   * @param {Array} spreadsheetData - Array of transaction rows
   * @param {string} quarter - Quarter identifier (q1, q2, q3, q4)
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Object} Quarterly submission data
   */
  async processQuarterlySubmission(spreadsheetData, quarter, businessType = 'sole_trader', progressCallback = null) {
    try {
      // Validate inputs
      this._validateQuarter(quarter);
      this._validateBusinessType(businessType);
      this._validateSpreadsheetData(spreadsheetData);

      console.log(`Starting quarterly submission processing for ${quarter.toUpperCase()} ${businessType}`);

      // Step 1: Categorize all transactions using AI
      const categorizationResults = await processSpreadsheetLineByLine(
        spreadsheetData,
        businessType,
        (progress) => {
          if (progressCallback) {
            progressCallback({
              ...progress,
              stage: 'categorization',
              stageDescription: 'Categorizing transactions with AI'
            });
          }
        }
      );

      if (progressCallback) {
        progressCallback({
          stage: 'calculation',
          stageDescription: 'Calculating quarterly totals',
          completed: 80,
          total: 100,
          percentage: 80
        });
      }

      // Step 2: Calculate quarterly submission totals (no AI needed)
      const quarterlySubmission = this._calculateQuarterlyTotals(
        categorizationResults,
        businessType
      );

      // Step 3: Finalize submission with metadata
      const finalSubmission = this._finalizeQuarterlySubmission(
        quarterlySubmission,
        quarter,
        businessType,
        categorizationResults
      );

      if (progressCallback) {
        progressCallback({
          stage: 'complete',
          stageDescription: 'Quarterly submission complete',
          completed: 100,
          total: 100,
          percentage: 100
        });
      }

      console.log(`Quarterly submission processing complete for ${quarter.toUpperCase()}`);
      return finalSubmission;

    } catch (error) {
      console.error('Quarterly submission processing failed:', error.message);
      throw new AppError(
        `Failed to process quarterly submission: ${error.message}`,
        500,
        this.config.errorCodes.CATEGORIZATION_FAILED
      );
    }
  }

  /**
   * Calculate quarterly totals from categorized transactions (no AI needed)
   * @param {Object} categorizationResults - Results from categorization utility
   * @param {string} businessType - Business type
   * @returns {Object} Quarterly submission with calculated totals
   */
  _calculateQuarterlyTotals(categorizationResults, businessType) {
    try {
      const categoryConfig = this.config.hmrcCategories[businessType === 'landlord' ? 'property' : 'selfEmployment'];
      
      // Initialize all categories to 0.00
      const income = {};
      const expenses = {};

      // Initialize all income categories
      categoryConfig.income.forEach(category => {
        income[category] = 0.00;
      });

      // Initialize all expense categories
      categoryConfig.expenses.forEach(category => {
        expenses[category] = 0.00;
      });

      // Track invalid categories for reporting
      const invalidCategories = [];
      const capitalAllowanceItems = [];

      // Process successful transactions only
      categorizationResults.processedTransactions.forEach(transaction => {
        if (transaction.hmrcCategory && !transaction.isPersonal && !transaction.error) {
          const amount = Math.abs(parseFloat(transaction.originalAmount) || 0);
          const category = transaction.hmrcCategory;

          // Check if this is a capital allowance item (should be excluded from quarterly)
          if (this.config.capitalAllowances.includes(category)) {
            capitalAllowanceItems.push({
              transactionId: transaction.transactionId,
              description: transaction.originalDescription,
              amount: amount,
              category: category,
              note: 'Capital allowance item - excluded from quarterly submission'
            });
            return; // Skip capital allowance items in quarterly
          }

          // Add to income or expenses based on category
          if (categoryConfig.income.includes(category)) {
            income[category] += amount;
          } else if (categoryConfig.expenses.includes(category)) {
            expenses[category] += amount;
          } else {
            // Track invalid categories
            invalidCategories.push({
              transactionId: transaction.transactionId,
              category: category,
              description: transaction.originalDescription,
              amount: amount
            });
          }
        }
      });

      // Log warnings for invalid categories
      if (invalidCategories.length > 0) {
        console.warn(`Found ${invalidCategories.length} transactions with invalid HMRC categories:`, invalidCategories);
      }

      if (capitalAllowanceItems.length > 0) {
        console.info(`Excluded ${capitalAllowanceItems.length} capital allowance items from quarterly submission (these belong in annual declaration)`);
      }

      // Format all amounts to 2 decimal places
      Object.keys(income).forEach(key => {
        income[key] = parseFloat(income[key].toFixed(2));
      });

      Object.keys(expenses).forEach(key => {
        expenses[key] = parseFloat(expenses[key].toFixed(2));
      });

      // Calculate totals
      const totalIncome = Object.values(income).reduce((sum, val) => sum + val, 0);
      const totalExpenses = Object.values(expenses).reduce((sum, val) => sum + val, 0);
      const netProfitLoss = totalIncome - totalExpenses;

      return {
        income,
        expenses,
        summary: {
          totalIncome: parseFloat(totalIncome.toFixed(2)),
          totalExpenses: parseFloat(totalExpenses.toFixed(2)),
          netProfitLoss: parseFloat(netProfitLoss.toFixed(2))
        },
        exclusions: {
          invalidCategories,
          capitalAllowanceItems
        }
      };

    } catch (error) {
      throw new AppError(
        `Failed to calculate quarterly totals: ${error.message}`,
        500,
        this.config.errorCodes.CALCULATION_FAILED
      );
    }
  }

  /**
   * Finalize quarterly submission with metadata
   * @param {Object} quarterlySubmission - Calculated submission
   * @param {string} quarter - Quarter identifier
   * @param {string} businessType - Business type
   * @param {Object} categorizationResults - Original categorization results
   * @returns {Object} Final submission with metadata
   */
  _finalizeQuarterlySubmission(quarterlySubmission, quarter, businessType, categorizationResults) {
    const quarterInfo = this.config.quarterDeadlines[quarter];
    
    return {
      metadata: {
        submissionType: 'quarterly',
        quarter: quarter.toUpperCase(),
        quarterPeriod: quarterInfo.period,
        submissionDeadline: quarterInfo.deadline,
        businessType,
        taxYear: getCurrentTaxYear(),
        generatedDate: new Date().toISOString(),
        totalTransactionsProcessed: categorizationResults.totalRows,
        successfullyProcessed: categorizationResults.summary.successful,
        personalTransactionsExcluded: categorizationResults.summary.personal,
        errorsEncountered: categorizationResults.summary.errors,
        manualReviewRequired: categorizationResults.summary.manualReviewRequired || 0,
        aiCategorized: categorizationResults.summary.aiCategorized,
        capitalAllowanceItemsExcluded: quarterlySubmission.exclusions?.capitalAllowanceItems?.length || 0,
        invalidCategoriesFound: quarterlySubmission.exclusions?.invalidCategories?.length || 0,
        version: '1.0'
      },
      submission: {
        income: quarterlySubmission.income,
        expenses: quarterlySubmission.expenses,
        summary: quarterlySubmission.summary
      },
      processingDetails: {
        categorizedTransactions: categorizationResults.processedTransactions.length,
        personalTransactions: categorizationResults.personalTransactions.length,
        errorTransactions: categorizationResults.errors.length,
        categoryBreakdown: this._generateCategoryBreakdown(categorizationResults.processedTransactions),
        flaggedForReview: categorizationResults.processedTransactions.filter(t => t.requiresManualReview).length,
        exclusions: quarterlySubmission.exclusions || {}
      },
      complianceNotes: {
        quarterlyRequirements: [
          'Total income for the quarter (turnover + other)',
          'Total expenses broken down by exact HMRC category codes',
          'Net profit or loss calculation (income - expenses)'
        ],
        excludedFromQuarterly: [
          'Capital allowances (annualInvestmentAllowance, capitalAllowanceMainPool, etc.) - Annual only',
          'Depreciation calculations - Annual only',
          'Personal allowances and tax calculations',
          'Year-end adjustments and corrections'
        ],
        hmrcCategoryCodes: {
          selfEmploymentIncome: ['turnover', 'other'],
          selfEmploymentExpenses: this.config.hmrcCategories.selfEmployment.expenses,
          propertyIncome: this.config.hmrcCategories.property.income,
          propertyExpenses: this.config.hmrcCategories.property.expenses,
          capitalAllowances: this.config.capitalAllowances
        },
        nextSteps: [
          `Submit to HMRC by ${quarterInfo.deadline}`,
          'Keep records of all supporting documentation',
          'Review any transactions flagged for manual review',
          'Capital allowance items will be included in annual declaration'
        ]
      }
    };
  }

  /**
   * Generate category breakdown for processing details
   * @param {Array} transactions - Processed transactions
   * @returns {Object} Category breakdown
   */
  _generateCategoryBreakdown(transactions) {
    const breakdown = {};
    
    transactions.forEach(transaction => {
      if (transaction.hmrcCategory && !transaction.isPersonal) {
        if (!breakdown[transaction.hmrcCategory]) {
          breakdown[transaction.hmrcCategory] = {
            count: 0,
            totalAmount: 0,
            description: transaction.categoryDescription || this._getCategoryDescription(transaction.hmrcCategory),
            isCapitalAllowance: this.config.capitalAllowances.includes(transaction.hmrcCategory)
          };
        }
        
        breakdown[transaction.hmrcCategory].count++;
        if (transaction.originalAmount) {
          breakdown[transaction.hmrcCategory].totalAmount += Math.abs(transaction.originalAmount);
        }
      }
    });

    // Format amounts
    Object.keys(breakdown).forEach(category => {
      breakdown[category].totalAmount = parseFloat(breakdown[category].totalAmount.toFixed(2));
    });

    return breakdown;
  }

  /**
   * Get description for HMRC category code
   * @param {string} categoryCode - HMRC category code
   * @returns {string} Category description
   */
  _getCategoryDescription(categoryCode) {
    const descriptions = {
      // Self-Employment Income
      'turnover': 'Business sales, fees, commission, self-employment income',
      'other': 'Other business income (grants, insurance payouts, etc.)',
      
      // Self-Employment Expenses
      'costOfGoodsBought': 'Raw materials, stock, goods bought for resale',
      'cisPaymentsToSubcontractors': 'Construction Industry Scheme payments',
      'staffCosts': 'Wages, salaries, subcontractor payments, employer NICs',
      'travelCosts': 'Business travel, fuel, parking, hotels (not home to work)',
      'premisesRunningCosts': 'Rent, business rates, heating, lighting, cleaning',
      'maintenanceCosts': 'Repairs and maintenance of property and equipment',
      'adminCosts': 'Phone, fax, stationery, postage, small equipment',
      'advertisingCosts': 'Advertising, marketing, website costs',
      'businessEntertainmentCosts': 'Entertaining clients, customer hospitality',
      'interestOnBankOtherLoans': 'Business loan interest, hire purchase interest',
      'financialCharges': 'Bank charges, credit card charges, factoring charges',
      'badDebt': 'Irrecoverable debts written off',
      'professionalFees': 'Accountant, solicitor, architect, surveyor fees',
      'depreciation': 'Depreciation of equipment and machinery',
      
      // Property Income
      'premiumsOfLeaseGrant': 'Property premiums received',
      'reversePremiums': 'Reverse premiums',
      'periodAmount': 'Rental income received',
      'taxDeducted': 'Tax deducted at source',
      
      // Property Expenses
      'repairsAndMaintenance': 'Maintenance, repairs, redecoration',
      'financialCosts': 'Mortgage interest, loan interest',
      'costOfServices': 'Gardening, cleaning, security services',
      
      // Capital Allowances (Annual Only)
      'annualInvestmentAllowance': 'Equipment, computers, machinery (up to £1M)',
      'capitalAllowanceMainPool': 'General equipment (18% allowance)',
      'capitalAllowanceSpecialRatePool': 'Integral building features (6% allowance)',
      'zeroEmissionGoodsVehicle': 'Electric vehicles (100% allowance)',
      'businessPremisesRenovationAllowance': 'Building renovation costs',
      'enhancedCapitalAllowance': 'Energy-efficient equipment',
      'allowanceOnSales': 'Balancing allowances/charges on disposals'
    };
    
    return descriptions[categoryCode] || 'Unknown category';
  }

  // ====== VALIDATION METHODS ======

  /**
   * Validate quarter parameter
   * @param {string} quarter - Quarter identifier
   */
  _validateQuarter(quarter) {
    if (!quarter || typeof quarter !== 'string') {
      throw new ValidationError('Quarter must be a string', [], 'quarter');
    }

    const validQuarters = ['q1', 'q2', 'q3', 'q4'];
    if (!validQuarters.includes(quarter.toLowerCase())) {
      throw new ValidationError(
        `Invalid quarter: ${quarter}. Must be one of: ${validQuarters.join(', ')}`,
        [],
        'quarter'
      );
    }
  }

  /**
   * Validate business type
   * @param {string} businessType - Business type
   */
  _validateBusinessType(businessType) {
    const validTypes = ['sole_trader', 'landlord'];
    if (!validTypes.includes(businessType)) {
      throw new ValidationError(
        `Invalid business type: ${businessType}. Must be one of: ${validTypes.join(', ')}`,
        [],
        'businessType'
      );
    }
  }

  /**
   * Validate spreadsheet data
   * @param {Array} spreadsheetData - Spreadsheet data
   */
  _validateSpreadsheetData(spreadsheetData) {
    if (!Array.isArray(spreadsheetData) || spreadsheetData.length === 0) {
      throw new ValidationError('Spreadsheet data must be a non-empty array', [], 'spreadsheetData');
    }
  }

  /**
   * Validate HMRC category code
   * @param {string} categoryCode - Category code to validate
   * @param {string} businessType - Business type context
   * @returns {boolean} Is valid category
   */
  validateHMRCCategory(categoryCode, businessType = 'sole_trader') {
    const categoryConfig = this.config.hmrcCategories[businessType === 'landlord' ? 'property' : 'selfEmployment'];
    return categoryConfig.income.includes(categoryCode) || 
           categoryConfig.expenses.includes(categoryCode) ||
           this.config.capitalAllowances.includes(categoryCode);
  }

  // ====== PUBLIC API METHODS ======

  /**
   * Get quarter information
   * @param {string} quarter - Quarter identifier
   * @returns {Object} Quarter information
   */
  getQuarterInfo(quarter) {
    this._validateQuarter(quarter);
    return {
      quarter: quarter.toUpperCase(),
      ...this.config.quarterDeadlines[quarter.toLowerCase()]
    };
  }

  /**
   * Get all quarter deadlines
   * @returns {Object} All quarter deadlines
   */
  getAllQuarterDeadlines() {
    return { ...this.config.quarterDeadlines };
  }

  /**
   * Get all HMRC categories for business type
   * @param {string} businessType - Business type
   * @returns {Object} All HMRC categories
   */
  getAllHMRCCategories(businessType) {
    this._validateBusinessType(businessType);
    return {
      ...this.config.hmrcCategories[businessType === 'landlord' ? 'property' : 'selfEmployment'],
      capitalAllowances: this.config.capitalAllowances
    };
  }

  /**
   * Get required categories for quarterly submissions
   * @param {string} businessType - Business type
   * @returns {Object} Required categories (excludes capital allowances)
   */
  getQuarterlyCategories(businessType) {
    this._validateBusinessType(businessType);
    return this.config.hmrcCategories[businessType === 'landlord' ? 'property' : 'selfEmployment'];
  }

  /**
   * Get capital allowance categories (annual only)
   * @returns {Array} Capital allowance categories
   */
  getCapitalAllowanceCategories() {
    return [...this.config.capitalAllowances];
  }

  /**
   * Calculate totals only (for testing or direct use)
   * @param {Object} categorizationResults - Categorization results
   * @param {string} businessType - Business type
   * @returns {Object} Calculated totals
   */
  calculateTotalsOnly(categorizationResults, businessType) {
    this._validateBusinessType(businessType);
    return this._calculateQuarterlyTotals(categorizationResults, businessType);
  }
}

// Create and export singleton instance
const quarterlySubmissionService = new QuarterlySubmissionService();

module.exports = {
  QuarterlySubmissionService,
  default: quarterlySubmissionService,
  
  // Export main methods
  processQuarterlySubmission: (spreadsheetData, quarter, businessType, progressCallback) =>
    quarterlySubmissionService.processQuarterlySubmission(spreadsheetData, quarter, businessType, progressCallback),
  getQuarterInfo: (quarter) =>
    quarterlySubmissionService.getQuarterInfo(quarter),
  getAllQuarterDeadlines: () =>
    quarterlySubmissionService.getAllQuarterDeadlines(),
  getAllHMRCCategories: (businessType) =>
    quarterlySubmissionService.getAllHMRCCategories(businessType),
  getQuarterlyCategories: (businessType) =>
    quarterlySubmissionService.getQuarterlyCategories(businessType),
  getCapitalAllowanceCategories: () =>
    quarterlySubmissionService.getCapitalAllowanceCategories(),
  calculateTotalsOnly: (categorizationResults, businessType) =>
    quarterlySubmissionService.calculateTotalsOnly(categorizationResults, businessType),
  validateHMRCCategory: (categoryCode, businessType) =>
    quarterlySubmissionService.validateHMRCCategory(categoryCode, businessType)
};