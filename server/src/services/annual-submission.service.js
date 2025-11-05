const { AppError, ValidationError } = require('../utils/errors.util');
const { formatForDisplay, getCurrentTaxYear } = require('../utils/date.util');
const { processSpreadsheetLineByLine } = require('../utils/categorization.util');
const vertexAI = require('../external/openai.external');

/**
 * MTD Annual Submission Service
 * Processes full year transactions and creates annual declaration with capital allowances
 */
class AnnualSubmissionService {
  constructor() {
    this.config = {
      // Annual submission deadline
      annualDeadline: '31 January',
      
      // Complete HMRC Category Codes - EXACT codes required by HMRC
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

      // Capital Allowances (Annual Only) - EXACT HMRC codes
      capitalAllowanceCategories: [
        'annualInvestmentAllowance',           // Equipment, computers, machinery (up to £1M)
        'capitalAllowanceMainPool',            // General equipment (18% allowance)
        'capitalAllowanceSpecialRatePool',     // Integral building features (6% allowance)
        'zeroEmissionGoodsVehicle',           // Electric vehicles (100% allowance)
        'businessPremisesRenovationAllowance', // Building renovation costs
        'enhancedCapitalAllowance',            // Energy-efficient equipment
        'allowanceOnSales'                     // Balancing allowances/charges on disposals
      ],
      
      // HMRC Annual Declaration Categories
      hmrcAnnualCategories: {
        selfEmployment: {
          // Year-end adjustments
          adjustments: {
            includedNonTaxableProfits: 'Non-taxable profits included in business income',
            basisAdjustment: 'Basis period adjustment',
            overlapReliefUsed: 'Overlap relief used this period',
            accountingAdjustment: 'Accounting period adjustment',
            averagingAdjustment: 'Averaging adjustment (for farmers)',
            lossesBroughtForward: 'Losses brought forward from earlier years',
            outstandingBusinessIncome: 'Outstanding business income (work in progress)',
            balancingChargeBPRA: 'Balancing charge on business premises renovation allowance',
            balancingChargeOther: 'Other balancing charges',
            goodsAndServicesOwnUse: 'Goods and services for your own use'
          },
          
          // Capital allowances - using EXACT HMRC codes
          allowances: {
            annualInvestmentAllowance: 'Annual Investment Allowance (AIA) - Equipment/computers up to £1m',
            capitalAllowanceMainPool: 'Capital allowances main pool (18% writing down allowance)',
            capitalAllowanceSpecialRatePool: 'Capital allowances special rate pool (6% writing down allowance)',
            zeroEmissionGoodsVehicle: 'Zero emission goods vehicle allowance',
            businessPremisesRenovationAllowance: 'Business premises renovation allowance',
            enhancedCapitalAllowance: 'Enhanced capital allowances',
            allowanceOnSales: 'Allowances on sale or cessation of business use'
          },
          
          // Non-financial declarations
          nonFinancials: {
            businessDetailsChangedRecently: 'Business details changed in the last 2 years',
            class4NicsExemptionReason: 'Class 4 National Insurance exemption reason'
          }
        },
        
        property: {
          // Property adjustments
          adjustments: {
            privateUseAdjustment: 'Private use adjustment',
            balancingCharge: 'Balancing charge',
            periodOfGraceAdjustment: 'Period of grace adjustment',
            propertyIncomeAllowance: 'Property income allowance (£1,000 maximum)',
            renovationAllowanceBalancingCharge: 'Renovation allowance balancing charge'
          },
          
          // Property allowances - using available HMRC codes
          allowances: {
            annualInvestmentAllowance: 'Annual Investment Allowance for furnished holiday lettings',
            businessPremisesRenovationAllowance: 'Business premises renovation allowance',
            zeroEmissionGoodsVehicle: 'Zero emissions vehicle allowance',
            enhancedCapitalAllowance: 'Enhanced capital allowances',
            allowanceOnSales: 'Balancing allowances/charges on disposals',
            other: 'Other capital allowances (replacement of domestic goods, etc.)'
          }
        }
      },

      // Capital allowance thresholds and rates
      capitalAllowances: {
        annualInvestmentAllowance: {
          threshold: 1000000.00, // £1m AIA limit
          rate: 1.00 // 100% first year allowance
        },
        capitalAllowanceMainPool: {
          rate: 0.18 // 18% writing down allowance
        },
        capitalAllowanceSpecialRatePool: {
          rate: 0.06 // 6% writing down allowance
        },
        zeroEmissionGoodsVehicle: {
          rate: 1.00 // 100% allowance
        },
        propertyIncomeAllowance: {
          threshold: 1000.00 // £1,000 property allowance
        }
      },

      // AI configuration
      aiConfig: {
        maxRetries: 3,
        timeoutMs: 30000 // Longer timeout for complex annual processing
      },

      // Error codes
      errorCodes: {
        INVALID_BUSINESS_TYPE: 'INVALID_BUSINESS_TYPE',
        QUARTERLY_DATA_INCOMPLETE: 'QUARTERLY_DATA_INCOMPLETE',
        AI_ANNUAL_FORMATTING_FAILED: 'AI_ANNUAL_FORMATTING_FAILED',
        CAPITAL_ALLOWANCE_CALCULATION_FAILED: 'CAPITAL_ALLOWANCE_CALCULATION_FAILED',
        ANNUAL_DECLARATION_FAILED: 'ANNUAL_DECLARATION_FAILED'
      }
    };
  }

  /**
   * Process full year spreadsheet and create annual declaration
   * @param {Array} spreadsheetData - Full year transaction data
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @param {Object} quarterlyData - Optional quarterly submission data for validation
   * @param {Function} progressCallback - Progress callback
   * @returns {Object} Complete annual declaration
   */
  async processAnnualDeclaration(categorizedData, businessType, quarterlyData = null, progressCallback) {
    console.log('🔍 Annual declaration processing started');
    console.log('📊 Categorized data structure:', {
      hasSuccessful: !!categorizedData?.successful,
      successfulCount: categorizedData?.successful?.length || 0,
      hasErrors: !!categorizedData?.errors,
      errorCount: categorizedData?.errors?.length || 0,
      hasSummary: !!categorizedData?.summary,
      totalRows: categorizedData?.totalRows
    });

    try {
      // VALIDATE INPUT DATA - Fix this validation
      if (!categorizedData) {
        throw new AppError('No categorized data provided', 400, 'MISSING_DATA');
      }

      // Check for the correct structure (categorized results, not raw spreadsheet)
      if (!categorizedData.processedTransactions || !Array.isArray(categorizedData.processedTransactions)) {
        console.log('❌ Expected categorized data with "processedTransactions" array, got:', Object.keys(categorizedData));
        throw new AppError('Invalid categorized data structure - missing processedTransactions array', 400, 'INVALID_DATA_STRUCTURE');
      }

      // Use processedTransactions instead of successful
      const transactions = categorizedData.processedTransactions;
      console.log(`✅ Processing ${transactions.length} successfully categorized transactions`);

      if (transactions.length === 0) {
        throw new AppError('No successful transactions to process for annual declaration', 400, 'NO_TRANSACTIONS');
      }

      // Update progress
      if (progressCallback) {
        progressCallback({
          stage: 'submission',
          percentage: 25,
          stageDescription: 'Calculating annual totals from categorized transactions'
        });
      }

      // Calculate financial totals from CATEGORIZED transactions
      const financialTotals = this._calculateFinancialTotalsFromCategorized(transactions, businessType);
      console.log('📊 Financial totals calculated:', financialTotals);

      if (progressCallback) {
        progressCallback({
          stage: 'submission',
          percentage: 50,
          stageDescription: 'Generating annual tax calculations'
        });
      }

      // Generate tax calculations for annual submission
      const taxCalculations = this._calculateAnnualTax(financialTotals, businessType);
      console.log('🧮 Tax calculations:', taxCalculations);

      if (progressCallback) {
        progressCallback({
          stage: 'submission',
          percentage: 75,
          stageDescription: 'Preparing HMRC annual submission format'
        });
      }

      // Create annual submission structure
      const submission = {
        submissionId: `ANNUAL_${Date.now()}`,
        submissionType: 'annual',
        businessType,
        taxYear: new Date().getFullYear(),
        submissionDate: new Date().toISOString(),
        
        // Financial summary
        summary: {
          totalIncome: financialTotals.totalIncome,
          totalExpenses: financialTotals.totalExpenses,
          netProfitLoss: financialTotals.netProfit,
          taxOwed: taxCalculations.incomeTax,
          allowances: taxCalculations.allowances
        },
        
        // Detailed breakdown by category
        categoryBreakdown: financialTotals.categoryBreakdown,
        
        // Transaction summary
        transactionSummary: {
          totalProcessed: categorizedData.totalRows,
          businessTransactions: categorizedData.summary.successful,
          personalExcluded: categorizedData.summary.personal,
          errorCount: categorizedData.summary.errors
        },
        
        // HMRC format data
        hmrcData: this._formatForHMRC(financialTotals, taxCalculations, businessType),
        
        // Quality metrics
        dataQuality: {
          successRate: categorizedData.summary.successful / categorizedData.totalRows * 100,
          categorizedTransactions: categorizedData.summary.successful,
          excludedPersonal: categorizedData.summary.personal
        }
      };

      if (progressCallback) {
        progressCallback({
          stage: 'submission',
          percentage: 100,
          stageDescription: 'Annual submission complete'
        });
      }

      console.log('✅ Annual submission generated successfully:', {
        submissionId: submission.submissionId,
        income: submission.summary.totalIncome,
        expenses: submission.summary.totalExpenses,
        profit: submission.summary.netProfitLoss,
        tax: submission.summary.taxOwed
      });

    return { submission };

  } catch (error) {
    console.error('❌ Annual declaration processing failed:', error.message);
    throw new AppError(
      `Failed to process annual declaration: ${error.message}`,
      error.statusCode || 500,
      'ANNUAL_DECLARATION_FAILED'
    );
  }
}

// Add this new method to calculate totals from categorized transactions:
_calculateFinancialTotalsFromCategorized(categorizedTransactions, businessType) {
  console.log('🧮 Calculating financial totals from categorized transactions...');
  
  const totals = {
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    categoryBreakdown: {},
    transactionCounts: {
      income: 0,
      expense: 0
    }
  };
  // Iterate over categorized transactions
  categorizedTransactions.forEach(transaction => {
    const amount = Math.abs(parseFloat(transaction.amount) || 0);
    const category = (transaction.categorization && transaction.categorization.category) ? transaction.categorization.category : 'other';
    const aiType = transaction.categorization && transaction.categorization.type ? transaction.categorization.type.toLowerCase() : null;
    const categoryDesc = transaction.categorization && transaction.categorization.categoryDescription ? transaction.categorization.categoryDescription : '';

    console.log(`💰 Processing transaction: £${amount} - ${category} (AI type: ${aiType || 'unknown'})`);

    // Prefer explicit AI/type from categorization when available
    let isIncome = false;
    if (aiType === 'income') {
      isIncome = true;
    } else if (aiType === 'expense') {
      isIncome = false;
    } else {
      // Fallback heuristics when type is not provided
      const aiText = (categoryDesc || category || '').toLowerCase();
      const catLower = (category || '').toLowerCase();
      isIncome = aiText.includes('income') || aiText.includes('rental') || aiText.includes('revenue') || catLower.includes('income') || catLower.includes('turnover') || catLower.includes('periodamount');
    }

    if (isIncome) {
      totals.totalIncome += amount;
      totals.transactionCounts.income++;

      // Track income categories (group property rental income under rental_income)
      const incomeCategory = 'rental_income';
      if (!totals.categoryBreakdown[incomeCategory]) {
        totals.categoryBreakdown[incomeCategory] = 0;
      }
      totals.categoryBreakdown[incomeCategory] += amount;
    } else {
      totals.totalExpenses += amount;
      totals.transactionCounts.expense++;

      // Track expense categories
      if (!totals.categoryBreakdown[category]) {
        totals.categoryBreakdown[category] = 0;
      }
      totals.categoryBreakdown[category] += amount;
    }
  });

  totals.netProfit = totals.totalIncome - totals.totalExpenses;
  
  console.log('✅ Financial totals calculated:', {
    income: totals.totalIncome,
    expenses: totals.totalExpenses,
    profit: totals.netProfit,
    categories: Object.keys(totals.categoryBreakdown).length
  });

  return totals;
}

// Add this method for tax calculations:
_calculateAnnualTax(financialTotals, businessType) {
  console.log('🧮 Calculating annual tax obligations...');
  
  const calculations = {
    incomeTax: 0,
    nationalInsurance: 0,
    allowances: {
      personalAllowance: 12570, // 2023/24 rate
      tradingAllowance: businessType === 'sole_trader' ? 1000 : 0
    },
    taxableProfit: 0
  };

  // Calculate taxable profit
  calculations.taxableProfit = Math.max(0, 
    financialTotals.netProfit - calculations.allowances.tradingAllowance
  );

  // Simple income tax calculation (basic rate)
  if (calculations.taxableProfit > calculations.allowances.personalAllowance) {
    const taxableIncome = calculations.taxableProfit - calculations.allowances.personalAllowance;
    calculations.incomeTax = Math.round(taxableIncome * 0.2 * 100) / 100; // 20% basic rate
  }

  // National Insurance for sole traders (Class 2 & 4)
  if (businessType === 'sole_trader' && financialTotals.netProfit > 6515) {
    calculations.nationalInsurance = Math.round(
      (calculations.taxableProfit * 0.09) * 100
    ) / 100; // Simplified NI calculation
  }

  console.log('✅ Tax calculations complete:', calculations);
  return calculations;
}

// Add this method for HMRC formatting:
_formatForHMRC(financialTotals, taxCalculations, businessType) {
  return {
    income: financialTotals.totalIncome,
    expenses: financialTotals.totalExpenses,
    profit: financialTotals.netProfit,
    taxOwed: taxCalculations.incomeTax + taxCalculations.nationalInsurance,
    taxYear: new Date().getFullYear(),
    businessType,
    submissionFormat: 'MTD_ANNUAL',
    calculationBreakdown: {
      incomeTax: taxCalculations.incomeTax,
      nationalInsurance: taxCalculations.nationalInsurance,
      totalTax: taxCalculations.incomeTax + taxCalculations.nationalInsurance
    }
  };
}  /**
   * Identify capital allowance items using AI (COMPLEX LOGIC)
   * @param {Object} categorizationResults - Categorized transactions
   * @param {string} businessType - Business type
   * @returns {Object} Capital allowance analysis
   */
  async _identifyCapitalAllowanceItems(categorizationResults, businessType) {
    const prompt = this._createCapitalAllowancePrompt(categorizationResults, businessType);
    
    let lastError;
    for (let attempt = 1; attempt <= this.config.aiConfig.maxRetries; attempt++) {
      try {
        const aiResponse = await vertexAI.analyzeCapitalAllowances(prompt, {
          timeout: this.config.aiConfig.timeoutMs,
          businessType
        });

        const capitalAllowanceAnalysis = this._parseCapitalAllowanceResponse(aiResponse, businessType);
        
        if (capitalAllowanceAnalysis) {
          return capitalAllowanceAnalysis;
        } else {
          throw new Error('AI returned invalid capital allowance analysis');
        }

      } catch (error) {
        lastError = error;
        console.warn(`AI capital allowance analysis attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.config.aiConfig.maxRetries) {
          await this._delay(2000 * attempt);
        }
      }
    }

    throw new AppError(
      `AI capital allowance analysis failed after ${this.config.aiConfig.maxRetries} attempts: ${lastError.message}`,
      500,
      this.config.errorCodes.CAPITAL_ALLOWANCE_CALCULATION_FAILED
    );
  }

  /**
   * Create AI prompt for capital allowance identification
   * @param {Object} categorizationResults - Categorized transactions
   * @param {string} businessType - Business type
   * @returns {string} AI prompt
   */
  _createCapitalAllowancePrompt(categorizationResults, businessType) {
    const businessContext = businessType === 'landlord' 
      ? 'UK property rental business'
      : 'UK sole trader self-employment business';

    return `You are an expert UK tax advisor analyzing business transactions to identify capital allowance items for HMRC annual declaration.

BUSINESS CONTEXT: ${businessContext}
TAX YEAR: ${getCurrentTaxYear()}

TASK: Analyze the categorized transactions below and identify items eligible for capital allowances.

TRANSACTION DATA:
${JSON.stringify(categorizationResults.processedTransactions, null, 2)}

EXACT HMRC CAPITAL ALLOWANCE CODES TO USE:
${JSON.stringify(this.config.capitalAllowanceCategories, null, 2)}

CAPITAL ALLOWANCE RULES:

For Self-Employment:
1. ANNUAL INVESTMENT ALLOWANCE (AIA) - 100% relief up to £1,000,000:
   - Computers, laptops, software, office equipment
   - Machinery, tools, plant
   - Business furniture, fixtures
   - Commercial vehicles under 2,040kg
   HMRC Code: "annualInvestmentAllowance"

2. MAIN POOL (18% writing down allowance):
   - Cars with CO2 emissions 51-110g/km
   - General business equipment over AIA limit
   - Second-hand equipment
   HMRC Code: "capitalAllowanceMainPool"

3. SPECIAL RATE POOL (6% writing down allowance):
   - Cars with CO2 emissions over 110g/km
   - Integral features (air conditioning, lifts)
   - Long-life assets (25+ year life)
   HMRC Code: "capitalAllowanceSpecialRatePool"

4. ZERO EMISSION VEHICLES (100% allowance):
   - Electric cars and vans
   HMRC Code: "zeroEmissionGoodsVehicle"

5. BUILDING RENOVATION:
   - Qualifying building renovation costs
   HMRC Code: "businessPremisesRenovationAllowance"

6. ENHANCED CAPITAL ALLOWANCES:
   - Energy-efficient equipment
   HMRC Code: "enhancedCapitalAllowance"

7. DISPOSAL ALLOWANCES:
   - Balancing allowances/charges on sales
   HMRC Code: "allowanceOnSales"

For Property Business:
- Use same codes but focus on property-related equipment
- Furniture for furnished holiday lettings qualifies for AIA
- Replacement of domestic goods is handled separately

ANALYSIS REQUIREMENTS:
1. Identify transactions that qualify for capital allowances
2. Use EXACT HMRC category codes listed above
3. Calculate recommended allowance amounts based on rates
4. Flag any items needing manual review
5. Exclude repairs, maintenance, and running costs (these are expenses)
6. Look for purchases of equipment, computers, vehicles, machinery

RESPONSE FORMAT - Return EXACT JSON structure:
{
  "capitalAllowanceItems": [
    {
      "transactionId": "txn_id",
      "description": "Item description",
      "amount": 1500.00,
      "allowanceType": "annualInvestmentAllowance",
      "allowanceRate": 1.00,
      "recommendedAllowance": 1500.00,
      "reasoning": "Why this qualifies for AIA"
    }
  ],
  "totalsByCategory": {
    "annualInvestmentAllowance": 5000.00,
    "capitalAllowanceMainPool": 2000.00,
    "capitalAllowanceSpecialRatePool": 1000.00,
    "zeroEmissionGoodsVehicle": 0.00,
    "businessPremisesRenovationAllowance": 0.00,
    "enhancedCapitalAllowance": 0.00,
    "allowanceOnSales": 0.00
  },
  "manualReviewRequired": [
    {
      "transactionId": "txn_id",
      "reason": "Unclear if business or personal use"
    }
  ]
}

IMPORTANT: Only use the exact HMRC category codes I specified. Do not make up new codes.`;
  }

  /**
   * Parse AI capital allowance response
   * @param {string} aiResponse - AI response
   * @param {string} businessType - Business type
   * @returns {Object} Parsed capital allowance data
   */
  _parseCapitalAllowanceResponse(aiResponse, businessType) {
    try {
      let cleanedResponse = aiResponse.trim();
      cleanedResponse = cleanedResponse.replace(/```json\s*|\s*```/g, '');
      cleanedResponse = cleanedResponse.replace(/```\s*|\s*```/g, '');
      
      const parsedData = JSON.parse(cleanedResponse);
      
      // Validate structure
      if (!parsedData.capitalAllowanceItems || !Array.isArray(parsedData.capitalAllowanceItems)) {
        throw new Error('Missing or invalid capitalAllowanceItems array');
      }

      if (!parsedData.totalsByCategory || typeof parsedData.totalsByCategory !== 'object') {
        throw new Error('Missing or invalid totalsByCategory object');
      }

      // Validate capital allowance codes
      parsedData.capitalAllowanceItems.forEach(item => {
        if (!this.config.capitalAllowanceCategories.includes(item.allowanceType)) {
          console.warn(`Invalid capital allowance code: ${item.allowanceType}`);
        }
      });

      // Format amounts
      parsedData.capitalAllowanceItems = parsedData.capitalAllowanceItems.map(item => ({
        ...item,
        amount: parseFloat(Number(item.amount || 0).toFixed(2)),
        allowanceRate: parseFloat(Number(item.allowanceRate || 0).toFixed(2)),
        recommendedAllowance: parseFloat(Number(item.recommendedAllowance || 0).toFixed(2))
      }));

      // Format totals
      Object.keys(parsedData.totalsByCategory).forEach(key => {
        parsedData.totalsByCategory[key] = parseFloat(Number(parsedData.totalsByCategory[key] || 0).toFixed(2));
      });

      return parsedData;

    } catch (error) {
      throw new Error(`Failed to parse capital allowance response: ${error.message}`);
    }
  }

  /**
   * Format annual declaration using AI (COMPLEX LOGIC)
   * @param {Object} categorizationResults - Categorized transactions
   * @param {Object} capitalAllowanceItems - Capital allowance analysis
   * @param {string} businessType - Business type
   * @param {Object} quarterlyData - Quarterly data for validation
   * @returns {Object} Annual declaration format
   */
  async _formatAnnualDeclaration(categorizationResults, capitalAllowanceItems, businessType, quarterlyData) {
    const prompt = this._createAnnualDeclarationPrompt(
      categorizationResults,
      capitalAllowanceItems,
      businessType,
      quarterlyData
    );

    let lastError;
    for (let attempt = 1; attempt <= this.config.aiConfig.maxRetries; attempt++) {
      try {
        const aiResponse = await vertexAI.formatAnnualDeclaration(prompt, {
          timeout: this.config.aiConfig.timeoutMs,
          businessType
        });

        const annualDeclaration = this._parseAnnualDeclarationResponse(aiResponse, businessType);
        
        if (annualDeclaration && this._validateAnnualDeclarationFormat(annualDeclaration, businessType)) {
          return annualDeclaration;
        } else {
          throw new Error('AI returned invalid annual declaration format');
        }

      } catch (error) {
        lastError = error;
        console.warn(`AI annual declaration formatting attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.config.aiConfig.maxRetries) {
          await this._delay(2000 * attempt);
        }
      }
    }

    throw new AppError(
      `AI annual declaration formatting failed after ${this.config.aiConfig.maxRetries} attempts: ${lastError.message}`,
      500,
      this.config.errorCodes.AI_ANNUAL_FORMATTING_FAILED
    );
  }

  /**
   * Create AI prompt for annual declaration formatting
   * @param {Object} categorizationResults - Categorized transactions
   * @param {Object} capitalAllowanceItems - Capital allowance analysis
   * @param {string} businessType - Business type
   * @param {Object} quarterlyData - Quarterly data
   * @returns {string} AI prompt
   */
  _createAnnualDeclarationPrompt(categorizationResults, capitalAllowanceItems, businessType, quarterlyData) {
    const businessContext = businessType === 'landlord' 
      ? 'UK property rental business'
      : 'UK sole trader self-employment business';

    const requiredFormat = this._getAnnualDeclarationFormat(businessType);

    return `You are an expert UK tax advisor creating an annual declaration for HMRC Making Tax Digital.

BUSINESS CONTEXT: ${businessContext}
TAX YEAR: ${getCurrentTaxYear()}
SUBMISSION DEADLINE: 31 January

TASK: Create a complete annual declaration using the categorized transactions and capital allowance analysis.

CATEGORIZED TRANSACTION DATA:
${JSON.stringify(categorizationResults, null, 2)}

CAPITAL ALLOWANCE ANALYSIS:
${JSON.stringify(capitalAllowanceItems, null, 2)}

${quarterlyData ? `QUARTERLY DATA FOR VALIDATION:
${JSON.stringify(quarterlyData, null, 2)}` : 'No quarterly data provided for validation'}

REQUIRED ANNUAL DECLARATION FORMAT:
${JSON.stringify(requiredFormat, null, 2)}

PROCESSING RULES:
1. Sum all regular income/expense transactions by HMRC category
2. Apply capital allowances from the analysis
3. Calculate year-end adjustments if needed
4. Include depreciation amounts (these get replaced by capital allowances)
5. Apply property income allowance (£1,000) for landlords if beneficial
6. Calculate total annual income and expenses
7. Round all amounts to 2 decimal places
8. Flag any items requiring manual review

IMPORTANT ANNUAL-SPECIFIC ITEMS:
- Capital allowances replace depreciation for tax purposes
- Year-end adjustments for corrections or accounting changes
- Private use adjustments for mixed business/personal items
- Property income allowance (£1,000) for landlords if applicable
- Basis period adjustments for changing accounting dates

RESPONSE FORMAT: Return only the JSON object in the exact format shown above, no explanatory text.`;
  }

  /**
   * Get annual declaration format template
   * @param {string} businessType - Business type
   * @returns {Object} Format template
   */
  _getAnnualDeclarationFormat(businessType) {
    if (businessType === 'landlord') {
      return {
        quarterlyDataComplete: true,
        adjustments: {
          privateUseAdjustment: 0.00,
          balancingCharge: 0.00,
          periodOfGraceAdjustment: 0.00,
          propertyIncomeAllowance: 0.00,
          renovationAllowanceBalancingCharge: 0.00
        },
        allowances: {
          annualInvestmentAllowance: 0.00,
          businessPremisesRenovationAllowance: 0.00,
          zeroEmissionGoodsVehicle: 0.00,
          enhancedCapitalAllowance: 0.00,
          allowanceOnSales: 0.00,
          other: 0.00
        },
        summary: {
          totalAnnualIncome: 0.00,
          totalAnnualExpenses: 0.00,
          totalCapitalAllowances: 0.00,
          totalAdjustments: 0.00,
          netProfitBeforeAllowances: 0.00,
          netProfitAfterAllowances: 0.00
        }
      };
    } else {
      return {
        quarterlyDataComplete: true,
        adjustments: {
          includedNonTaxableProfits: 0.00,
          basisAdjustment: 0.00,
          overlapReliefUsed: 0.00,
          accountingAdjustment: 0.00,
          averagingAdjustment: 0.00,
          lossesBroughtForward: 0.00,
          outstandingBusinessIncome: 0.00,
          balancingChargeBPRA: 0.00,
          balancingChargeOther: 0.00,
          goodsAndServicesOwnUse: 0.00
        },
        allowances: {
          annualInvestmentAllowance: 0.00,
          capitalAllowanceMainPool: 0.00,
          capitalAllowanceSpecialRatePool: 0.00,
          zeroEmissionGoodsVehicle: 0.00,
          businessPremisesRenovationAllowance: 0.00,
          enhancedCapitalAllowance: 0.00,
          allowanceOnSales: 0.00
        },
        nonFinancials: {
          businessDetailsChangedRecently: false,
          class4NicsExemptionReason: null
        },
        summary: {
          totalAnnualIncome: 0.00,
          totalAnnualExpenses: 0.00,
          totalCapitalAllowances: 0.00,
          totalAdjustments: 0.00,
          netProfitBeforeAllowances: 0.00,
          netProfitAfterAllowances: 0.00
        }
      };
    }
  }

  /**
   * Parse annual declaration response
   * @param {string} aiResponse - AI response
   * @param {string} businessType - Business type
   * @returns {Object} Parsed annual declaration
   */
  _parseAnnualDeclarationResponse(aiResponse, businessType) {
    try {
      let cleanedResponse = aiResponse.trim();
      cleanedResponse = cleanedResponse.replace(/```json\s*|\s*```/g, '');
      cleanedResponse = cleanedResponse.replace(/```\s*|\s*```/g, '');
      
      const parsedData = JSON.parse(cleanedResponse);
      
      // Validate required sections exist
      if (!parsedData.adjustments || !parsedData.allowances) {
        throw new Error('Missing required sections (adjustments or allowances)');
      }

      // Format all amounts to 2 decimal places
      const formattedData = this._formatAnnualAmounts(parsedData);
      
      return formattedData;

    } catch (error) {
      throw new Error(`Failed to parse annual declaration response: ${error.message}`);
    }
  }

  /**
   * Validate annual declaration format
   * @param {Object} declaration - Annual declaration
   * @param {string} businessType - Business type
   * @returns {boolean} Is valid
   */
  _validateAnnualDeclarationFormat(declaration, businessType) {
    if (!declaration || typeof declaration !== 'object') {
      return false;
    }

    const requiredFormat = this._getAnnualDeclarationFormat(businessType);
    
    // Check adjustments
    if (!declaration.adjustments || typeof declaration.adjustments !== 'object') {
      return false;
    }

    // Check allowances
    if (!declaration.allowances || typeof declaration.allowances !== 'object') {
      return false;
    }

    // Validate key fields exist
    for (const key of Object.keys(requiredFormat.adjustments)) {
      if (!(key in declaration.adjustments)) {
        return false;
      }
    }

    for (const key of Object.keys(requiredFormat.allowances)) {
      if (!(key in declaration.allowances)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Format all amounts in annual declaration
   * @param {Object} data - Annual declaration data
   * @returns {Object} Formatted data
   */
  _formatAnnualAmounts(data) {
    const formatted = JSON.parse(JSON.stringify(data));

    // Format adjustments
    if (formatted.adjustments) {
      Object.keys(formatted.adjustments).forEach(key => {
        if (typeof formatted.adjustments[key] === 'number') {
          formatted.adjustments[key] = parseFloat(Number(formatted.adjustments[key]).toFixed(2));
        }
      });
    }

    // Format allowances
    if (formatted.allowances) {
      Object.keys(formatted.allowances).forEach(key => {
        if (typeof formatted.allowances[key] === 'number') {
          formatted.allowances[key] = parseFloat(Number(formatted.allowances[key]).toFixed(2));
        }
      });
    }

    // Calculate and format summary
    if (formatted.adjustments && formatted.allowances) {
      const totalAdjustments = Object.values(formatted.adjustments)
        .filter(val => typeof val === 'number')
        .reduce((sum, val) => sum + Math.abs(val), 0);

      const totalAllowances = Object.values(formatted.allowances)
        .filter(val => typeof val === 'number')
        .reduce((sum, val) => sum + val, 0);

      if (!formatted.summary) {
        formatted.summary = {};
      }

      formatted.summary.totalAdjustments = parseFloat(totalAdjustments.toFixed(2));
      formatted.summary.totalCapitalAllowances = parseFloat(totalAllowances.toFixed(2));
    }

    return formatted;
  }

  /**
   * Finalize annual submission with metadata
   * @param {Object} annualDeclaration - AI-formatted declaration
   * @param {string} businessType - Business type
   * @param {Object} categorizationResults - Categorization results
   * @param {Object} capitalAllowanceItems - Capital allowance analysis
   * @returns {Object} Final annual submission
   */
  _finalizeAnnualSubmission(annualDeclaration, businessType, categorizationResults, capitalAllowanceItems) {
    return {
      metadata: {
        submissionType: 'annual',
        submissionDeadline: this.config.annualDeadline,
        businessType,
        taxYear: getCurrentTaxYear(),
        generatedDate: new Date().toISOString(),
        totalTransactionsProcessed: categorizationResults.totalRows,
        successfullyProcessed: categorizationResults.summary.successful,
        personalTransactionsExcluded: categorizationResults.summary.personal,
        errorsEncountered: categorizationResults.summary.errors,
        manualReviewRequired: categorizationResults.summary.manualReviewRequired || 0,
        capitalAllowanceItemsIdentified: capitalAllowanceItems.capitalAllowanceItems.length,
        version: '1.0'
      },
      declaration: {
        quarterlyDataComplete: annualDeclaration.quarterlyDataComplete,
        adjustments: annualDeclaration.adjustments,
        allowances: annualDeclaration.allowances,
        nonFinancials: annualDeclaration.nonFinancials || {},
        summary: annualDeclaration.summary
      },
      capitalAllowanceDetails: {
        itemsAnalyzed: capitalAllowanceItems.capitalAllowanceItems,
        totalsByCategory: capitalAllowanceItems.totalsByCategory,
        manualReviewRequired: capitalAllowanceItems.manualReviewRequired || [],
        allowanceRules: this.config.capitalAllowances
      },
      processingDetails: {
        fullYearTransactions: categorizationResults.processedTransactions.length,
        personalTransactions: categorizationResults.personalTransactions.length,
        errorTransactions: categorizationResults.errors.length,
        categoryBreakdown: this._generateCategoryBreakdown(categorizationResults.processedTransactions)
      },
      complianceNotes: {
        annualRequirements: [
          'Confirm all quarterly submissions are complete',
          'Calculate and claim capital allowances using exact HMRC codes',
          'Apply any year-end adjustments',
          'Submit final declaration by 31 January'
        ],
        capitalAllowanceInfo: [
          'Annual Investment Allowance: 100% relief up to £1,000,000',
          'Main Pool: 18% writing down allowance',
          'Special Rate Pool: 6% writing down allowance',
          'Zero Emission Vehicles: 100% allowance',
          'Keep receipts for all capital purchases'
        ],
        exactHMRCCodes: {
          capitalAllowances: this.config.capitalAllowanceCategories,
          regularCategories: this.config.hmrcCategories
        },
        nextSteps: [
          'Review capital allowance calculations',
          'Check any items flagged for manual review',
          'Submit to HMRC by 31 January',
          'HMRC will calculate Income Tax and Class 4 NI',
          'Pay balancing payment by 31 January',
          'Pay first payment on account by 31 January'
        ],
        hmrcCalculations: [
          'Income Tax on total profit (20%, 40%, 45% bands)',
          'Class 4 National Insurance (9% on profits £12,570-£50,270)',
          'Personal allowance deduction (£12,570 for 2024-25)',
          'Payment on account for next year (50% in Jan, 50% in July)'
        ]
      }
    };
  }

  /**
   * Generate category breakdown
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
            description: transaction.categoryDescription,
            isCapitalAllowance: this.config.capitalAllowanceCategories.includes(transaction.hmrcCategory)
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

  // ====== VALIDATION METHODS ======

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
   * Add processing delay
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ====== PUBLIC API METHODS ======

  /**
   * Get capital allowance rates and thresholds
   * @returns {Object} Capital allowance information
   */
  getCapitalAllowanceInfo() {
    return { ...this.config.capitalAllowances };
  }

  /**
   * Get annual declaration categories for business type
   * @param {string} businessType - Business type
   * @returns {Object} Annual categories
   */
  getAnnualCategories(businessType) {
    this._validateBusinessType(businessType);
    return this.config.hmrcAnnualCategories[businessType === 'landlord' ? 'property' : 'selfEmployment'];
  }

  /**
   * Get capital allowance categories
   * @returns {Array} Capital allowance categories
   */
  getCapitalAllowanceCategories() {
    return [...this.config.capitalAllowanceCategories];
  }

  /**
   * Get annual deadline information
   * @returns {Object} Deadline information
   */
  getAnnualDeadline() {
    return {
      deadline: this.config.annualDeadline,
      taxYear: getCurrentTaxYear(),
      note: 'Must be submitted AFTER all 4 quarterly submissions are complete'
    };
  }
}

// Create and export singleton instance
const annualSubmissionService = new AnnualSubmissionService();

module.exports = {
  AnnualSubmissionService,
  default: annualSubmissionService,
  
  // Export main methods
  processAnnualDeclaration: (spreadsheetData, businessType, quarterlyData, progressCallback) =>
    annualSubmissionService.processAnnualDeclaration(spreadsheetData, businessType, quarterlyData, progressCallback),
  getCapitalAllowanceInfo: () =>
    annualSubmissionService.getCapitalAllowanceInfo(),
  getAnnualCategories: (businessType) =>
    annualSubmissionService.getAnnualCategories(businessType),
  getCapitalAllowanceCategories: () =>
    annualSubmissionService.getCapitalAllowanceCategories(),
  getAnnualDeadline: () =>
    annualSubmissionService.getAnnualDeadline()
};