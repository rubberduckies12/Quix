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
   * @param {Object|Array} spreadsheetDataOrResults - Either raw spreadsheet data or categorization results
   * @param {string} quarter - Quarter identifier (q1, q2, q3, q4)
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @param {Object} submissionOptions - Submission configuration options
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Object} Quarterly submission data
   */
  async processQuarterlySubmission(spreadsheetDataOrResults, quarter, businessType = 'sole_trader', submissionOptions = {}, progressCallback = null) {
    try {
      // Validate inputs
      this._validateQuarter(quarter);
      this._validateBusinessType(businessType);

      console.log(`Starting quarterly submission processing for ${quarter.toUpperCase()} ${businessType}`);
      console.log('Submission options:', submissionOptions);

      // Check if we received categorization results or raw spreadsheet data
      const isCategorizedData = spreadsheetDataOrResults && 
        typeof spreadsheetDataOrResults === 'object' && 
        !Array.isArray(spreadsheetDataOrResults) &&
        (spreadsheetDataOrResults.processedTransactions || spreadsheetDataOrResults.summary);

      let categorizationResults;

      if (isCategorizedData) {
        // We received already categorized data
        console.log('📊 Received pre-categorized data, skipping categorization step');
        categorizationResults = spreadsheetDataOrResults;
        
        if (progressCallback) {
          progressCallback({
            stage: 'categorization',
            stageDescription: 'Using pre-categorized data',
            completed: 70,
            total: 100,
            percentage: 70
          });
        }
      } else {
        // We received raw spreadsheet data - need to categorize
        this._validateSpreadsheetData(spreadsheetDataOrResults);
        
        // Determine submission strategy based on quarter and options
        const submissionStrategy = this._determineSubmissionStrategy(quarter, submissionOptions);
        console.log('Submission strategy:', submissionStrategy);

        if (progressCallback) {
          progressCallback({
            stage: 'analysis',
            stageDescription: 'Analyzing spreadsheet structure and quarter data',
            completed: 10,
            total: 100,
            percentage: 10
          });
        }

        // Step 1: Analyze spreadsheet for quarter separation if needed
        let processedData = spreadsheetDataOrResults;
        if (submissionStrategy.needsQuarterAnalysis) {
          processedData = await this._analyzeAndExtractQuarterData(
            spreadsheetDataOrResults,
            quarter,
            submissionOptions,
            progressCallback
          );
        }

        if (progressCallback) {
          progressCallback({
            stage: 'categorization',
            stageDescription: 'Categorizing transactions with AI',
            completed: 30,
            total: 100,
            percentage: 30
          });
        }

        // Step 2: Categorize transactions using AI
        categorizationResults = await processSpreadsheetLineByLine(
          processedData,
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
      }

      if (progressCallback) {
        progressCallback({
          stage: 'calculation',
          stageDescription: 'Calculating quarterly totals',
          completed: 80,
          total: 100,
          percentage: 80
        });
      }

      // Step 3: Calculate quarterly submission totals
      const quarterlySubmission = this._calculateQuarterlyTotals(
        categorizationResults,
        businessType,
        submissionOptions
      );

      // Step 4: Finalize submission with metadata
      const finalSubmission = this._finalizeQuarterlySubmission(
        quarterlySubmission,
        quarter,
        businessType,
        categorizationResults,
        submissionOptions
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
   * Calculate quarterly totals from categorized results
   * @param {Object} categorizationResults - AI categorization results
   * @param {string} businessType - Business type (sole_trader or landlord)
   * @param {Object} submissionStrategy - Submission strategy with calculation method
   * @returns {Object} Quarterly calculation results
   */
  _calculateQuarterlyTotals(categorizationResults, businessType, submissionStrategy = {}) {
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
   * @param {Object} submissionStrategy - Submission strategy used
   * @returns {Object} Final submission with metadata
   */
  _finalizeQuarterlySubmission(quarterlySubmission, quarter, businessType, categorizationResults, submissionStrategy = {}) {
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
        submissionStrategy: {
          spreadsheetType: submissionStrategy.spreadsheetType || 'single_quarter',
          calculationMethod: submissionStrategy.calculationMethod || 'direct',
          quarterAnalysisPerformed: submissionStrategy.needsQuarterAnalysis || false
        },
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
   * Determine submission strategy based on quarter and options
   * @param {string} quarter - Quarter identifier (q1, q2, q3, q4)
   * @param {Object} submissionOptions - Submission configuration options
   * @returns {Object} Submission strategy
   */
  _determineSubmissionStrategy(quarter, submissionOptions = {}) {
    const strategy = {
      quarter,
      needsQuarterAnalysis: false,
      spreadsheetType: 'single_quarter', // 'single_quarter', 'cumulative', 'separated'
      calculationMethod: 'direct', // 'direct', 'difference', 'ai_extract'
      previousQuarterData: null
    };

    // Q1 is always straightforward - just take all data
    if (quarter === 'q1') {
      strategy.spreadsheetType = 'single_quarter';
      strategy.calculationMethod = 'direct';
      return strategy;
    }

    // For Q2+ check submission options
    if (submissionOptions.spreadsheetType) {
      strategy.spreadsheetType = submissionOptions.spreadsheetType;
      
      if (submissionOptions.spreadsheetType === 'different_per_quarter') {
        // Each quarter has its own spreadsheet - treat as Q1
        strategy.calculationMethod = 'direct';
      } else if (submissionOptions.spreadsheetType === 'same_cumulative') {
        // Same spreadsheet with cumulative data - need to calculate difference
        strategy.needsQuarterAnalysis = true;
        strategy.calculationMethod = 'difference';
        strategy.previousQuarterData = submissionOptions.previousQuarterData;
      } else if (submissionOptions.spreadsheetType === 'same_separated') {
        // Same spreadsheet but quarters are separated - use AI to extract
        strategy.needsQuarterAnalysis = true;
        strategy.calculationMethod = 'ai_extract';
      }
    } else {
      // No explicit option provided - use AI to determine
      strategy.needsQuarterAnalysis = true;
      strategy.calculationMethod = 'ai_determine';
    }

    return strategy;
  }

  /**
   * Analyze spreadsheet and extract quarter-specific data using OpenAI
   * @param {Array} spreadsheetData - Raw spreadsheet data
   * @param {string} quarter - Target quarter
   * @param {Object} submissionOptions - Submission options
   * @param {Function} progressCallback - Progress callback
   * @returns {Array} Processed data for the specific quarter
   */
  async _analyzeAndExtractQuarterData(spreadsheetData, quarter, submissionOptions, progressCallback) {
    const { OpenAIService } = require('../external/openai.external');
    const openai = new OpenAIService();

    if (progressCallback) {
      progressCallback({
        stage: 'analysis',
        stageDescription: 'Analyzing spreadsheet structure for quarter data',
        completed: 15,
        total: 100,
        percentage: 15
      });
    }

    try {
      // First, analyze the spreadsheet structure to understand how data is organized
      const structureAnalysis = await this._analyzeSpreadsheetStructure(spreadsheetData, quarter, openai);
      
      if (progressCallback) {
        progressCallback({
          stage: 'analysis',
          stageDescription: 'Extracting quarter-specific transactions',
          completed: 25,
          total: 100,
          percentage: 25
        });
      }

      // Based on the analysis, extract the appropriate data
      switch (submissionOptions.spreadsheetType || structureAnalysis.detectedType) {
        case 'same_cumulative':
          return await this._extractCumulativeDifference(
            spreadsheetData, 
            quarter, 
            submissionOptions.previousQuarterData,
            openai
          );
          
        case 'same_separated':
          return await this._extractSeparatedQuarterData(
            spreadsheetData, 
            quarter, 
            openai
          );
          
        default:
          // If we can't determine, try AI-assisted extraction
          return await this._intelligentQuarterExtraction(
            spreadsheetData, 
            quarter, 
            openai
          );
      }
    } catch (error) {
      console.error('Error in quarter data analysis:', error);
      // Fallback: return all data and let user know we couldn't separate
      console.warn('Could not separate quarter data - processing all transactions');
      return spreadsheetData;
    }
  }

  /**
   * Analyze spreadsheet structure to understand data organization
   * @param {Array} spreadsheetData - Raw spreadsheet data
   * @param {string} quarter - Target quarter
   * @param {Object} openai - OpenAI service instance
   * @returns {Object} Structure analysis results
   */
  async _analyzeSpreadsheetStructure(spreadsheetData, quarter, openai) {
    // Sample first 20 rows for analysis
    const sampleData = spreadsheetData.slice(0, 20);
    
    const analysisPrompt = `
Analyze this spreadsheet data to determine how quarterly financial data is organized:

Sample Data (first 20 rows):
${JSON.stringify(sampleData, null, 2)}

Target Quarter: ${quarter.toUpperCase()}

Please analyze and respond with JSON only:
{
  "detectedType": "same_cumulative|same_separated|single_quarter",
  "hasDateColumns": true/false,
  "hasQuarterLabels": true/false,
  "dateFormat": "detected format or null",
  "quarterSeparation": "description of how quarters are separated",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}

Types:
- same_cumulative: Running totals that include previous quarters
- same_separated: Quarters are clearly separated by labels/sections
- single_quarter: Data only contains the target quarter
`;

    try {
      const response = await openai.categorizeTransaction(analysisPrompt, {
        businessType: 'analysis',
        maxTokens: 300
      });

      return JSON.parse(response);
    } catch (error) {
      console.error('Structure analysis failed:', error);
      return {
        detectedType: 'single_quarter',
        hasDateColumns: false,
        hasQuarterLabels: false,
        confidence: 0,
        reasoning: 'Analysis failed - defaulting to single quarter'
      };
    }
  }

  /**
   * Extract quarter data by calculating difference from cumulative totals
   * @param {Array} spreadsheetData - Raw spreadsheet data
   * @param {string} quarter - Target quarter
   * @param {Object} previousQuarterData - Previous quarter totals
   * @param {Object} openai - OpenAI service instance
   * @returns {Array} Quarter-specific transactions
   */
  async _extractCumulativeDifference(spreadsheetData, quarter, previousQuarterData, openai) {
    if (!previousQuarterData) {
      console.warn('No previous quarter data provided for cumulative calculation');
      return spreadsheetData; // Fallback to all data
    }

    const prompt = `
Calculate the difference between cumulative totals to extract Q${quarter.charAt(1)} transactions:

Current cumulative data:
${JSON.stringify(spreadsheetData.slice(0, 50), null, 2)}

Previous quarter totals:
${JSON.stringify(previousQuarterData, null, 2)}

Extract only the NEW transactions for Q${quarter.charAt(1)} by:
1. Identifying transactions that weren't in previous quarters
2. Calculating differences in running totals
3. Filtering by date ranges if dates are present

Return the filtered data as JSON array of transactions.
`;

    try {
      const response = await openai.categorizeTransaction(prompt, {
        businessType: 'extraction',
        maxTokens: 1000
      });

      const extractedData = JSON.parse(response);
      return Array.isArray(extractedData) ? extractedData : spreadsheetData;
    } catch (error) {
      console.error('Cumulative difference extraction failed:', error);
      return spreadsheetData;
    }
  }

  /**
   * Extract quarter data from separated sections using AI
   * @param {Array} spreadsheetData - Raw spreadsheet data
   * @param {string} quarter - Target quarter
   * @param {Object} openai - OpenAI service instance
   * @returns {Array} Quarter-specific transactions
   */
  async _extractSeparatedQuarterData(spreadsheetData, quarter, openai) {
    const prompt = `
Extract Q${quarter.charAt(1)} transactions from this spreadsheet where quarters are separated:

Full spreadsheet data:
${JSON.stringify(spreadsheetData, null, 2)}

Look for:
1. Section headers mentioning Q${quarter.charAt(1)} or ${quarter.toUpperCase()}
2. Date ranges corresponding to Q${quarter.charAt(1)}
3. Clear separators between quarters
4. Labels indicating quarter boundaries

Return only the transactions for Q${quarter.charAt(1)} as a JSON array.
If you can't clearly identify separated quarters, return all data.
`;

    try {
      const response = await openai.categorizeTransaction(prompt, {
        businessType: 'extraction',
        maxTokens: 1500
      });

      const extractedData = JSON.parse(response);
      return Array.isArray(extractedData) ? extractedData : spreadsheetData;
    } catch (error) {
      console.error('Separated quarter extraction failed:', error);
      return spreadsheetData;
    }
  }

  /**
   * Intelligent quarter extraction when type is unknown
   * @param {Array} spreadsheetData - Raw spreadsheet data
   * @param {string} quarter - Target quarter
   * @param {Object} openai - OpenAI service instance
   * @returns {Array} Quarter-specific transactions
   */
  async _intelligentQuarterExtraction(spreadsheetData, quarter, openai) {
    const prompt = `
Intelligently extract Q${quarter.charAt(1)} financial data from this spreadsheet:

Data:
${JSON.stringify(spreadsheetData, null, 2)}

Target: Q${quarter.charAt(1)} (${this._getQuarterDateRange(quarter)})

Analyze the data and:
1. Determine if this contains cumulative data, separated quarters, or single quarter
2. Extract only the relevant Q${quarter.charAt(1)} transactions
3. If dates are present, filter by the appropriate date range
4. If totals are cumulative, identify what's new for this quarter
5. If quarters are separated, find the Q${quarter.charAt(1)} section

Return the filtered transactions as JSON array.
If unsure, return all data with a note.
`;

    try {
      const response = await openai.categorizeTransaction(prompt, {
        businessType: 'extraction',
        maxTokens: 2000
      });

      const extractedData = JSON.parse(response);
      return Array.isArray(extractedData) ? extractedData : spreadsheetData;
    } catch (error) {
      console.error('Intelligent extraction failed:', error);
      return spreadsheetData;
    }
  }

  /**
   * Get date range for a quarter
   * @param {string} quarter - Quarter identifier
   * @returns {string} Date range description
   */
  _getQuarterDateRange(quarter) {
    const ranges = {
      'q1': 'April 6 - July 5',
      'q2': 'July 6 - October 5', 
      'q3': 'October 6 - January 5',
      'q4': 'January 6 - April 5'
    };
    return ranges[quarter] || 'Unknown range';
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