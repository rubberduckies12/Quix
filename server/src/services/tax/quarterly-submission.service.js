const logger = require('../../utils/logger.util');
const DateUtil = require('../../utils/date.util');
const { ValidationError, AppError, HMRCError } = require('../../utils/error.util');
const HMRCService = require('../integrations/hmrc.service');
const TransactionService = require('../transaction.service');
const UserService = require('../user.service');
const NotificationService = require('../notification.service');

/**
 * Quarterly Submission Service for UK MTD ITSA (Income Tax Self Assessment)
 * Handles quarterly business updates to HMRC following exact MTD rules
 */
class QuarterlySubmissionService {
  constructor() {
    this.hmrcService = new HMRCService();
    this.transactionService = new TransactionService();
    this.userService = new UserService();
    this.notificationService = new NotificationService();
    
    // HMRC MTD ITSA API endpoints
    this.endpoints = {
      selfEmployment: (nino, businessId, periodId) => 
        `/income-tax/nino/${nino}/self-employment/${businessId}/period/${periodId}`,
      ukProperty: (nino, businessId, periodId) => 
        `/income-tax/nino/${nino}/uk-property/${businessId}/period/${periodId}`,
      foreignProperty: (nino, businessId, periodId) => 
        `/income-tax/nino/${nino}/foreign-property/${businessId}/period/${periodId}`,
      businessList: (nino) => `/income-tax/nino/${nino}/self-employment`,
      propertyList: (nino) => `/income-tax/nino/${nino}/uk-property`
    };

    // HMRC quarterly deadlines (1 month after quarter end)
    this.quarterDeadlines = {
      'Q1': { month: 8, day: 5 },  // 5 August
      'Q2': { month: 11, day: 5 }, // 5 November  
      'Q3': { month: 2, day: 5 },  // 5 February
      'Q4': { month: 5, day: 5 }   // 5 May
    };

    // HMRC amount limits (in pounds)
    this.amountLimits = {
      min: 0,
      max: 99999999
    };
  }

  // =====================================================
  // MAIN SUBMISSION METHODS
  // =====================================================

  /**
   * Submit quarterly update for self-employment business
   * @param {string} userId - User ID
   * @param {string} businessId - HMRC business ID
   * @param {string} taxYear - Tax year (YYYY-YY format)
   * @param {string} quarter - Quarter (Q1, Q2, Q3, Q4)
   * @param {Object} options - Submission options
   * @returns {Object} Submission result
   */
  async submitSelfEmploymentQuarter(userId, businessId, taxYear, quarter, options = {}) {
    try {
      logger.logHMRC('Starting self-employment quarterly submission', {
        userId, businessId, taxYear, quarter
      });

      // Get user details and validate
      const user = await this.userService.findById(userId);
      if (!user || !user.nino) {
        throw new ValidationError('User NINO not found');
      }

      // Calculate quarter period
      const quarterPeriod = this.calculateQuarterPeriod(taxYear, quarter);
      
      // Validate submission timing
      this.validateQuarterlyDeadline(quarterPeriod, quarter);
      
      // Check previous quarters submitted
      await this.checkPreviousQuarterSubmissions(user.nino, businessId, taxYear, quarter);
      
      // Get and aggregate transactions
      const transactions = await this.transactionService.getTransactionsByPeriod(
        userId, 
        quarterPeriod.startDate, 
        quarterPeriod.endDate,
        { businessId, incomeSource: 'self-employment' }
      );
      
      // Aggregate data for HMRC format
      const aggregatedData = this.aggregateTransactionsByCategory(
        transactions, 
        quarterPeriod,
        'self-employment'
      );
      
      // Apply business rules and validation
      this.applyBusinessRules(aggregatedData, 'self-employment');
      this.validateQuarterlyTotals(aggregatedData, transactions);
      
      // Generate HMRC submission payload
      const submissionPayload = this.generateSelfEmploymentPayload(
        aggregatedData, 
        quarterPeriod
      );
      
      // Validate before submission
      this.validateMandatoryFields(submissionPayload, 'self-employment');
      this.validateAmountRanges(submissionPayload);
      
      // Generate period ID
      const periodId = this.generatePeriodId(user.nino, businessId, quarter, taxYear);
      
      // Submit to HMRC
      const hmrcResponse = await this.submitToHMRC(
        user.nino, 
        businessId, 
        periodId, 
        submissionPayload,
        'self-employment'
      );
      
      // Log successful submission
      await this.logQuarterlySubmissionAttempt(
        userId, 
        businessId, 
        quarter, 
        taxYear,
        submissionPayload, 
        hmrcResponse
      );
      
      // Send notification
      await this.notificationService.sendQuarterlySubmissionConfirmation(
        userId, 
        quarter, 
        taxYear,
        hmrcResponse
      );
      
      return {
        success: true,
        submissionId: hmrcResponse.correlationId,
        period: quarterPeriod,
        quarter,
        taxYear,
        businessId,
        submittedAt: new Date(),
        hmrcResponse: {
          correlationId: hmrcResponse.correlationId,
          processingDate: hmrcResponse.processingDate
        },
        summary: this.generateSubmissionSummary(aggregatedData, transactions)
      };

    } catch (error) {
      logger.logError('Self-employment quarterly submission failed', {
        userId, businessId, taxYear, quarter, error: error.message
      });
      
      // Log failed attempt
      await this.logQuarterlySubmissionAttempt(
        userId, 
        businessId, 
        quarter, 
        taxYear,
        null, 
        null,
        error
      );
      
      throw this.handleHMRCError(error);
    }
  }

  /**
   * Submit quarterly update for UK property business
   * @param {string} userId - User ID
   * @param {string} businessId - HMRC property business ID
   * @param {string} taxYear - Tax year (YYYY-YY format)
   * @param {string} quarter - Quarter (Q1, Q2, Q3, Q4)
   * @param {Object} options - Submission options
   * @returns {Object} Submission result
   */
  async submitPropertyQuarter(userId, businessId, taxYear, quarter, options = {}) {
    try {
      logger.logHMRC('Starting property quarterly submission', {
        userId, businessId, taxYear, quarter
      });

      const user = await this.userService.findById(userId);
      if (!user || !user.nino) {
        throw new ValidationError('User NINO not found');
      }

      const quarterPeriod = this.calculateQuarterPeriod(taxYear, quarter);
      this.validateQuarterlyDeadline(quarterPeriod, quarter);
      
      await this.checkPreviousQuarterSubmissions(user.nino, businessId, taxYear, quarter);
      
      const transactions = await this.transactionService.getTransactionsByPeriod(
        userId, 
        quarterPeriod.startDate, 
        quarterPeriod.endDate,
        { businessId, incomeSource: 'uk-property' }
      );
      
      const aggregatedData = this.aggregateTransactionsByCategory(
        transactions, 
        quarterPeriod,
        'uk-property'
      );
      
      // Apply property-specific business rules
      this.applyPropertyBusinessRules(aggregatedData);
      this.validateQuarterlyTotals(aggregatedData, transactions);
      
      const submissionPayload = this.generatePropertyPayload(
        aggregatedData, 
        quarterPeriod,
        options.propertyType || 'uk'
      );
      
      this.validateMandatoryFields(submissionPayload, 'uk-property');
      this.validateAmountRanges(submissionPayload);
      
      const periodId = this.generatePeriodId(user.nino, businessId, quarter, taxYear);
      
      const hmrcResponse = await this.submitToHMRC(
        user.nino, 
        businessId, 
        periodId, 
        submissionPayload,
        'uk-property'
      );
      
      await this.logQuarterlySubmissionAttempt(
        userId, 
        businessId, 
        quarter, 
        taxYear,
        submissionPayload, 
        hmrcResponse
      );
      
      await this.notificationService.sendQuarterlySubmissionConfirmation(
        userId, 
        quarter, 
        taxYear,
        hmrcResponse
      );
      
      return {
        success: true,
        submissionId: hmrcResponse.correlationId,
        period: quarterPeriod,
        quarter,
        taxYear,
        businessId,
        submittedAt: new Date(),
        hmrcResponse: {
          correlationId: hmrcResponse.correlationId,
          processingDate: hmrcResponse.processingDate
        },
        summary: this.generateSubmissionSummary(aggregatedData, transactions)
      };

    } catch (error) {
      logger.logError('Property quarterly submission failed', {
        userId, businessId, taxYear, quarter, error: error.message
      });
      
      await this.logQuarterlySubmissionAttempt(
        userId, 
        businessId, 
        quarter, 
        taxYear,
        null, 
        null,
        error
      );
      
      throw this.handleHMRCError(error);
    }
  }

  // =====================================================
  // QUARTER MANAGEMENT
  // =====================================================

  /**
   * Calculate exact HMRC quarter period dates
   * @param {string} taxYear - Tax year in YYYY-YY format
   * @param {string} quarter - Quarter (Q1, Q2, Q3, Q4)
   * @returns {Object} Quarter period with exact dates
   */
  calculateQuarterPeriod(taxYear, quarter) {
    const quarterInfo = DateUtil.getQuarterDates(taxYear, quarter);
    const deadline = this.calculateQuarterDeadline(taxYear, quarter);
    
    return {
      startDate: quarterInfo.start,
      endDate: quarterInfo.end,
      deadline,
      quarter,
      taxYear,
      periodFromDate: DateUtil.formatForHMRC(quarterInfo.start),
      periodToDate: DateUtil.formatForHMRC(quarterInfo.end),
      description: quarterInfo.description
    };
  }

  /**
   * Calculate quarterly submission deadline
   * @param {string} taxYear - Tax year
   * @param {string} quarter - Quarter
   * @returns {Date} Deadline date
   */
  calculateQuarterDeadline(taxYear, quarter) {
    const quarterInfo = DateUtil.getQuarterDates(taxYear, quarter);
    const deadlineInfo = this.quarterDeadlines[quarter];
    
    let deadlineYear = quarterInfo.end.getFullYear();
    
    // Handle year transition for Q3 (Jan/Feb deadline in following year)
    if (quarter === 'Q3') {
      deadlineYear = quarterInfo.end.getFullYear();
    }
    
    return new Date(deadlineYear, deadlineInfo.month - 1, deadlineInfo.day, 23, 59, 59);
  }

  /**
   * Generate HMRC-compliant period ID
   * @param {string} nino - National Insurance Number
   * @param {string} businessId - Business ID
   * @param {string} quarter - Quarter
   * @param {string} taxYear - Tax year
   * @returns {string} Period ID
   */
  generatePeriodId(nino, businessId, quarter, taxYear) {
    // HMRC period ID format: YYYY-MM-DD_YYYY-MM-DD
    const quarterPeriod = this.calculateQuarterPeriod(taxYear, quarter);
    return `${quarterPeriod.periodFromDate}_${quarterPeriod.periodToDate}`;
  }

  /**
   * Validate quarterly submission deadline
   * @param {Object} quarterPeriod - Quarter period information
   * @param {string} quarter - Quarter identifier
   */
  validateQuarterlyDeadline(quarterPeriod, quarter) {
    const now = DateUtil.nowInUK();
    const deadline = quarterPeriod.deadline;
    
    if (now < quarterPeriod.endDate) {
      throw new ValidationError(`Cannot submit ${quarter} return before quarter end date: ${DateUtil.formatForDisplay(quarterPeriod.endDate)}`);
    }
    
    if (now > deadline) {
      const daysLate = DateUtil.getDuration(deadline, now).totalDays;
      logger.logHMRC('Late quarterly submission attempt', {
        quarter, deadline: DateUtil.formatForDisplay(deadline), daysLate
      });
      
      // Allow late submission but log warning
      logger.logSecurity('Late quarterly submission', {
        quarter, daysLate, deadline: DateUtil.formatForDisplay(deadline)
      });
    }
  }

  /**
   * Check previous quarter submissions are complete
   * @param {string} nino - National Insurance Number
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   * @param {string} currentQuarter - Current quarter being submitted
   */
  async checkPreviousQuarterSubmissions(nino, businessId, taxYear, currentQuarter) {
    const quarterOrder = ['Q1', 'Q2', 'Q3', 'Q4'];
    const currentIndex = quarterOrder.indexOf(currentQuarter);
    
    // Check if previous quarters in same tax year are submitted
    for (let i = 0; i < currentIndex; i++) {
      const previousQuarter = quarterOrder[i];
      const hasSubmitted = await this.hasQuarterBeenSubmitted(
        nino, 
        businessId, 
        taxYear, 
        previousQuarter
      );
      
      if (!hasSubmitted) {
        throw new ValidationError(
          `Previous quarter ${previousQuarter} must be submitted before ${currentQuarter}`
        );
      }
    }
  }

  // =====================================================
  // HMRC BUSINESS ID MANAGEMENT
  // =====================================================

  /**
   * Retrieve business IDs from HMRC for a NINO
   * @param {string} nino - National Insurance Number
   * @returns {Object} Business IDs by type
   */
  async retrieveBusinessIds(nino) {
    try {
      const [selfEmploymentBiz, propertyBiz] = await Promise.all([
        this.hmrcService.get(this.endpoints.businessList(nino)),
        this.hmrcService.get(this.endpoints.propertyList(nino))
      ]);
      
      return {
        selfEmployment: selfEmploymentBiz.businesses || [],
        ukProperty: propertyBiz.properties || [],
        foreignProperty: [] // TODO: Add foreign property endpoint
      };
    } catch (error) {
      logger.logError('Failed to retrieve business IDs from HMRC', {
        nino, error: error.message
      });
      throw new HMRCError('Failed to retrieve business information', 'BUSINESS_RETRIEVAL_ERROR');
    }
  }

  /**
   * Validate business ID for submission type
   * @param {string} businessId - Business ID
   * @param {string} incomeType - Income type (self-employment, uk-property, foreign-property)
   * @param {string} nino - National Insurance Number
   * @returns {boolean} True if valid
   */
  async validateBusinessIdForSubmission(businessId, incomeType, nino) {
    const businessIds = await this.retrieveBusinessIds(nino);
    
    switch (incomeType) {
      case 'self-employment':
        return businessIds.selfEmployment.some(biz => biz.businessId === businessId);
      case 'uk-property':
        return businessIds.ukProperty.some(prop => prop.businessId === businessId);
      case 'foreign-property':
        return businessIds.foreignProperty.some(prop => prop.businessId === businessId);
      default:
        return false;
    }
  }

  // =====================================================
  // DATA AGGREGATION & TRANSFORMATION
  // =====================================================

  /**
   * Aggregate transactions by HMRC categories
   * @param {Array} transactions - User transactions
   * @param {Object} quarterPeriod - Quarter period information
   * @param {string} incomeSource - Income source type
   * @returns {Object} Aggregated data by HMRC categories
   */
  aggregateTransactionsByCategory(transactions, quarterPeriod, incomeSource) {
    const result = {
      income: {},
      expenses: {},
      metadata: {
        transactionCount: transactions.length,
        period: quarterPeriod,
        incomeSource
      }
    };

    if (incomeSource === 'self-employment') {
      result.income = this.aggregateSelfEmploymentIncome(transactions);
      result.expenses = this.aggregateSelfEmploymentExpenses(transactions);
    } else if (incomeSource === 'uk-property') {
      result.income = this.aggregatePropertyIncome(transactions);
      result.expenses = this.aggregatePropertyExpenses(transactions);
    }

    return result;
  }

  /**
   * Aggregate self-employment income
   * @param {Array} transactions - Income transactions
   * @returns {Object} HMRC self-employment income structure
   */
  aggregateSelfEmploymentIncome(transactions) {
    const incomeTransactions = transactions.filter(t => t.transactionType === 'income');
    
    return {
      turnover: this.formatCurrencyForHMRC(
        incomeTransactions
          .filter(t => t.category === 'sales' || t.category === 'services')
          .reduce((sum, t) => sum + (t.netAmount || 0), 0)
      ),
      other: this.formatCurrencyForHMRC(
        incomeTransactions
          .filter(t => t.category !== 'sales' && t.category !== 'services')
          .reduce((sum, t) => sum + (t.netAmount || 0), 0)
      )
    };
  }

  /**
   * Aggregate self-employment expenses using exact HMRC categories
   * @param {Array} transactions - Expense transactions
   * @returns {Object} HMRC self-employment expense structure
   */
  aggregateSelfEmploymentExpenses(transactions) {
    const expenseTransactions = transactions.filter(t => t.transactionType === 'expense');
    
    // HMRC expense category mappings
    const categoryMappings = {
      costOfGoodsBought: ['cost_of_goods', 'inventory', 'materials'],
      cisPaymentsToSubcontractors: ['subcontractor', 'cis_payments'],
      staffCosts: ['salary', 'wages', 'staff', 'employee'],
      travelCosts: ['travel', 'transport', 'mileage', 'fuel'],
      premisesRunningCosts: ['rent', 'utilities', 'premises', 'office_costs'],
      maintenanceCosts: ['maintenance', 'repairs', 'equipment_maintenance'],
      adminCosts: ['administration', 'office_supplies', 'stationery'],
      advertisingCosts: ['advertising', 'marketing', 'promotion'],
      businessEntertainmentCosts: ['entertainment', 'hospitality'],
      interestOnBankOtherLoans: ['bank_charges', 'loan_interest', 'interest'],
      financialCharges: ['bank_charges', 'financial_fees'],
      badDebt: ['bad_debt', 'debt_provision'],
      professionalFees: ['professional', 'legal', 'accountancy', 'consultancy'],
      depreciation: ['depreciation'],
      other: [] // Catch-all for unmapped categories
    };

    const expenses = {};
    
    // Initialize all HMRC expense categories
    Object.keys(categoryMappings).forEach(hmrcCategory => {
      expenses[hmrcCategory] = 0;
    });

    // Aggregate expenses by HMRC categories
    expenseTransactions.forEach(transaction => {
      const category = transaction.category?.toLowerCase() || '';
      let mapped = false;

      // Find matching HMRC category
      for (const [hmrcCategory, keywords] of Object.entries(categoryMappings)) {
        if (keywords.some(keyword => category.includes(keyword))) {
          expenses[hmrcCategory] += transaction.netAmount || 0;
          mapped = true;
          break;
        }
      }

      // If not mapped, add to 'other'
      if (!mapped && hmrcCategory !== 'other') {
        expenses.other += transaction.netAmount || 0;
      }
    });

    // Format all amounts for HMRC (remove pence, convert to integers)
    Object.keys(expenses).forEach(category => {
      expenses[category] = this.formatCurrencyForHMRC(expenses[category]);
    });

    return expenses;
  }

  /**
   * Aggregate property income using HMRC structure
   * @param {Array} transactions - Property income transactions
   * @returns {Object} HMRC property income structure
   */
  aggregatePropertyIncome(transactions) {
    const incomeTransactions = transactions.filter(t => t.transactionType === 'income');
    
    const income = {
      premiumsOfLeaseGrant: 0,
      reversePremiums: 0,
      periodAmount: 0,
      taxDeducted: 0
    };

    // Standard rental income
    income.periodAmount = this.formatCurrencyForHMRC(
      incomeTransactions
        .filter(t => t.category === 'rental_income')
        .reduce((sum, t) => sum + (t.netAmount || 0), 0)
    );

    // Tax deducted at source
    income.taxDeducted = this.formatCurrencyForHMRC(
      incomeTransactions
        .filter(t => t.taxDeducted && t.taxDeducted > 0)
        .reduce((sum, t) => sum + (t.taxDeducted || 0), 0)
    );

    // Rent-a-room scheme (if applicable)
    const rentARoomIncome = incomeTransactions
      .filter(t => t.category === 'rent_a_room')
      .reduce((sum, t) => sum + (t.netAmount || 0), 0);

    if (rentARoomIncome > 0) {
      income.rentARoom = {
        rentsReceived: this.formatCurrencyForHMRC(rentARoomIncome)
      };
    }

    return income;
  }

  /**
   * Aggregate property expenses using HMRC structure
   * @param {Array} transactions - Property expense transactions
   * @returns {Object} HMRC property expense structure
   */
  aggregatePropertyExpenses(transactions) {
    const expenseTransactions = transactions.filter(t => t.transactionType === 'expense');
    
    const categoryMappings = {
      premisesRunningCosts: ['utilities', 'council_tax', 'insurance'],
      repairsAndMaintenance: ['repairs', 'maintenance', 'decorating'],
      financialCosts: ['mortgage_interest', 'loan_interest'],
      professionalFees: ['letting_agent', 'legal', 'accountancy'],
      costOfServices: ['gardening', 'cleaning', 'security'],
      travelCosts: ['travel', 'transport', 'mileage'],
      other: []
    };

    const expenses = {};
    
    Object.keys(categoryMappings).forEach(hmrcCategory => {
      expenses[hmrcCategory] = 0;
    });

    expenseTransactions.forEach(transaction => {
      const category = transaction.category?.toLowerCase() || '';
      let mapped = false;

      for (const [hmrcCategory, keywords] of Object.entries(categoryMappings)) {
        if (keywords.some(keyword => category.includes(keyword))) {
          expenses[hmrcCategory] += transaction.netAmount || 0;
          mapped = true;
          break;
        }
      }

      if (!mapped) {
        expenses.other += transaction.netAmount || 0;
      }
    });

    // Format amounts for HMRC
    Object.keys(expenses).forEach(category => {
      expenses[category] = this.formatCurrencyForHMRC(expenses[category]);
    });

    // Handle rent-a-room expenses
    const rentARoomExpenses = expenseTransactions
      .filter(t => t.category === 'rent_a_room_expenses')
      .reduce((sum, t) => sum + (t.netAmount || 0), 0);

    if (rentARoomExpenses > 0) {
      expenses.rentARoom = {
        amountClaimed: this.formatCurrencyForHMRC(rentARoomExpenses)
      };
    }

    return expenses;
  }

  // =====================================================
  // HMRC PAYLOAD GENERATION
  // =====================================================

  /**
   * Generate HMRC self-employment submission payload
   * @param {Object} aggregatedData - Aggregated transaction data
   * @param {Object} quarterPeriod - Quarter period information
   * @returns {Object} HMRC-compliant JSON payload
   */
  generateSelfEmploymentPayload(aggregatedData, quarterPeriod) {
    const payload = {
      periodFromDate: quarterPeriod.periodFromDate,
      periodToDate: quarterPeriod.periodToDate
    };

    // Add income (only if non-zero)
    if (aggregatedData.income.turnover > 0 || aggregatedData.income.other > 0) {
      payload.income = {};
      
      if (aggregatedData.income.turnover > 0) {
        payload.income.turnover = aggregatedData.income.turnover;
      }
      
      if (aggregatedData.income.other > 0) {
        payload.income.other = aggregatedData.income.other;
      }
    }

    // Add expenses (only non-zero amounts)
    const nonZeroExpenses = {};
    Object.entries(aggregatedData.expenses).forEach(([category, amount]) => {
      if (amount > 0) {
        nonZeroExpenses[category] = amount;
      }
    });

    if (Object.keys(nonZeroExpenses).length > 0) {
      payload.expenses = nonZeroExpenses;
    }

    return this.sanitizeDataForSubmission(payload);
  }

  /**
   * Generate HMRC property submission payload
   * @param {Object} aggregatedData - Aggregated transaction data
   * @param {Object} quarterPeriod - Quarter period information
   * @param {string} propertyType - Property type (uk/foreign)
   * @returns {Object} HMRC-compliant JSON payload
   */
  generatePropertyPayload(aggregatedData, quarterPeriod, propertyType = 'uk') {
    const payload = {
      periodFromDate: quarterPeriod.periodFromDate,
      periodToDate: quarterPeriod.periodToDate
    };

    // Add income
    const nonZeroIncome = {};
    Object.entries(aggregatedData.income).forEach(([category, amount]) => {
      if (amount > 0 || (typeof amount === 'object' && amount !== null)) {
        nonZeroIncome[category] = amount;
      }
    });

    if (Object.keys(nonZeroIncome).length > 0) {
      payload.income = nonZeroIncome;
    }

    // Add expenses
    const nonZeroExpenses = {};
    Object.entries(aggregatedData.expenses).forEach(([category, amount]) => {
      if (amount > 0 || (typeof amount === 'object' && amount !== null)) {
        nonZeroExpenses[category] = amount;
      }
    });

    if (Object.keys(nonZeroExpenses).length > 0) {
      payload.expenses = nonZeroExpenses;
    }

    return this.sanitizeDataForSubmission(payload);
  }

  // =====================================================
  // VALIDATION METHODS
  // =====================================================

  /**
   * Validate mandatory fields for HMRC submission
   * @param {Object} payload - Submission payload
   * @param {string} submissionType - Type of submission
   */
  validateMandatoryFields(payload, submissionType) {
    const errors = [];

    // Check required dates
    if (!payload.periodFromDate) {
      errors.push('periodFromDate is required');
    }
    
    if (!payload.periodToDate) {
      errors.push('periodToDate is required');
    }

    // Validate date format (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (payload.periodFromDate && !datePattern.test(payload.periodFromDate)) {
      errors.push('periodFromDate must be in YYYY-MM-DD format');
    }
    
    if (payload.periodToDate && !datePattern.test(payload.periodToDate)) {
      errors.push('periodToDate must be in YYYY-MM-DD format');
    }

    // Check that either income or expenses is present
    if (!payload.income && !payload.expenses) {
      errors.push('Either income or expenses must be provided');
    }

    if (errors.length > 0) {
      throw new ValidationError('Mandatory field validation failed', errors);
    }
  }

  /**
   * Validate amount ranges according to HMRC limits
   * @param {Object} payload - Submission payload
   */
  validateAmountRanges(payload) {
    const errors = [];

    const validateAmount = (amount, fieldName) => {
      if (typeof amount !== 'number' || isNaN(amount)) {
        errors.push(`${fieldName} must be a valid number`);
        return;
      }

      if (amount < this.amountLimits.min) {
        errors.push(`${fieldName} cannot be negative`);
      }

      if (amount > this.amountLimits.max) {
        errors.push(`${fieldName} exceeds maximum allowed value (£${this.amountLimits.max.toLocaleString()})`);
      }
    };

    // Validate income amounts
    if (payload.income) {
      Object.entries(payload.income).forEach(([field, value]) => {
        if (typeof value === 'number') {
          validateAmount(value, `income.${field}`);
        } else if (typeof value === 'object' && value !== null) {
          // Handle nested objects like rentARoom
          Object.entries(value).forEach(([nestedField, nestedValue]) => {
            validateAmount(nestedValue, `income.${field}.${nestedField}`);
          });
        }
      });
    }

    // Validate expense amounts
    if (payload.expenses) {
      Object.entries(payload.expenses).forEach(([field, value]) => {
        if (typeof value === 'number') {
          validateAmount(value, `expenses.${field}`);
        } else if (typeof value === 'object' && value !== null) {
          Object.entries(value).forEach(([nestedField, nestedValue]) => {
            validateAmount(nestedValue, `expenses.${field}.${nestedField}`);
          });
        }
      });
    }

    if (errors.length > 0) {
      throw new ValidationError('Amount validation failed', errors);
    }
  }

  /**
   * Apply MTD-specific business rules
   * @param {Object} data - Aggregated data
   * @param {string} incomeSource - Income source type
   */
  applyBusinessRules(data, incomeSource) {
    // Ensure no negative income
    this.ensureNoNegativeIncome(data);
    
    // Validate expense reasonableness
    this.validateExpenseReasonableness(data.expenses, data.income);
    
    if (incomeSource === 'self-employment') {
      this.checkCostOfGoodsRules(data.expenses);
    }
  }

  /**
   * Apply property-specific business rules
   * @param {Object} data - Property data
   */
  applyPropertyBusinessRules(data) {
    this.applyRentARoomExemption(data.income);
    this.ensureNoNegativeIncome(data);
  }

  /**
   * Ensure no negative income figures
   * @param {Object} data - Financial data
   */
  ensureNoNegativeIncome(data) {
    if (data.income) {
      Object.entries(data.income).forEach(([field, value]) => {
        if (typeof value === 'number' && value < 0) {
          throw new ValidationError(`Negative income not allowed: ${field}`);
        }
      });
    }
  }

  /**
   * Validate expense reasonableness against income
   * @param {Object} expenses - Expense data
   * @param {Object} income - Income data
   */
  validateExpenseReasonableness(expenses, income) {
    const totalIncome = Object.values(income).reduce((sum, val) => {
      return sum + (typeof val === 'number' ? val : 0);
    }, 0);

    const totalExpenses = Object.values(expenses).reduce((sum, val) => {
      return sum + (typeof val === 'number' ? val : 0);
    }, 0);

    // Flag if expenses are more than 200% of income (potential error)
    if (totalExpenses > (totalIncome * 2) && totalIncome > 0) {
      logger.logHMRC('High expense ratio detected', {
        totalIncome, totalExpenses, ratio: totalExpenses / totalIncome
      });
    }
  }

  /**
   * Check cost of goods rules
   * @param {Object} expenses - Expense data
   */
  checkCostOfGoodsRules(expenses) {
    // Cost of goods should only be claimed by businesses that sell goods
    if (expenses.costOfGoodsBought > 0) {
      logger.logHMRC('Cost of goods claimed', {
        amount: expenses.costOfGoodsBought
      });
    }
  }

  /**
   * Apply rent-a-room exemption rules
   * @param {Object} income - Property income
   */
  applyRentARoomExemption(income) {
    const rentARoomLimit = 7500; // £7,500 annual exemption
    
    if (income.rentARoom && income.rentARoom.rentsReceived > 0) {
      // Log rent-a-room income for potential exemption
      logger.logHMRC('Rent-a-room income detected', {
        amount: income.rentARoom.rentsReceived,
        exemptionLimit: rentARoomLimit
      });
    }
  }

  // =====================================================
  // HMRC SUBMISSION & ERROR HANDLING
  // =====================================================

  /**
   * Submit data to HMRC API
   * @param {string} nino - National Insurance Number
   * @param {string} businessId - Business ID
   * @param {string} periodId - Period ID
   * @param {Object} payload - Submission payload
   * @param {string} submissionType - Type of submission
   * @returns {Object} HMRC response
   */
  async submitToHMRC(nino, businessId, periodId, payload, submissionType) {
    const endpoint = submissionType === 'self-employment' 
      ? this.endpoints.selfEmployment(nino, businessId, periodId)
      : this.endpoints.ukProperty(nino, businessId, periodId);

    try {
      const response = await this.hmrcService.post(endpoint, payload, {
        scope: 'write:self-assessment',
        retries: 3,
        timeout: 30000
      });

      logger.logHMRC('HMRC submission successful', {
        nino, businessId, periodId, submissionType,
        correlationId: response.correlationId
      });

      return response;
    } catch (error) {
      logger.logError('HMRC submission failed', {
        nino, businessId, periodId, submissionType,
        error: error.message,
        payload
      });
      
      throw this.handleHMRCError(error);
    }
  }

  /**
   * Handle HMRC-specific errors
   * @param {Error} error - Original error
   * @returns {Error} Processed error
   */
  handleHMRCError(error) {
    if (error instanceof HMRCError) {
      return error;
    }

    // Map common HMRC error codes to user-friendly messages
    const errorMappings = {
      'INVALID_NINO': 'Invalid National Insurance Number',
      'INVALID_BUSINESS_ID': 'Invalid business ID - please check your business registration',
      'INVALID_PERIOD_ID': 'Invalid submission period',
      'OVERLAPPING_PERIOD': 'This period overlaps with a previous submission',
      'EARLY_SUBMISSION': 'Cannot submit before the quarter end date',
      'LATE_SUBMISSION': 'This submission is late - penalties may apply',
      'INVALID_INCOME_SOURCE': 'Invalid income source for this business type',
      'MISSING_EXEMPTIONS': 'Required exemption information is missing'
    };

    const userMessage = errorMappings[error.code] || error.message;
    
    return new HMRCError(
      userMessage,
      error.code || 'SUBMISSION_ERROR',
      error.statusCode || 500,
      'quarterly_submission',
      { originalError: error.message }
    );
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Format currency amount for HMRC (remove pence, integer pounds)
   * @param {number} amount - Amount in pounds and pence
   * @returns {number} Integer pounds only
   */
  formatCurrencyForHMRC(amount) {
    return Math.round(amount || 0);
  }

  /**
   * Sanitize data for HMRC submission
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeDataForSubmission(data) {
    const sanitized = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object') {
          const nestedSanitized = this.sanitizeDataForSubmission(value);
          if (Object.keys(nestedSanitized).length > 0) {
            sanitized[key] = nestedSanitized;
          }
        } else if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed) {
            sanitized[key] = trimmed;
          }
        } else {
          sanitized[key] = value;
        }
      }
    });
    
    return sanitized;
  }

  /**
   * Validate quarterly totals match transaction data
   * @param {Object} aggregatedData - Aggregated data
   * @param {Array} transactions - Original transactions
   */
  validateQuarterlyTotals(aggregatedData, transactions) {
    const incomeTransactions = transactions.filter(t => t.transactionType === 'income');
    const expenseTransactions = transactions.filter(t => t.transactionType === 'expense');
    
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + (t.netAmount || 0), 0);
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + (t.netAmount || 0), 0);
    
    const aggregatedIncome = Object.values(aggregatedData.income)
      .reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    
    const aggregatedExpenses = Object.values(aggregatedData.expenses)
      .reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    
    const incomeDiff = Math.abs(totalIncome - aggregatedIncome);
    const expenseDiff = Math.abs(totalExpenses - aggregatedExpenses);
    
    // Allow small rounding differences
    if (incomeDiff > 1 || expenseDiff > 1) {
      logger.logError('Quarterly totals validation failed', {
        totalIncome, aggregatedIncome, incomeDiff,
        totalExpenses, aggregatedExpenses, expenseDiff
      });
      
      throw new ValidationError('Transaction totals do not match aggregated data');
    }
  }

  /**
   * Check if quarter has been submitted
   * @param {string} nino - National Insurance Number
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   * @param {string} quarter - Quarter
   * @returns {boolean} True if submitted
   */
  async hasQuarterBeenSubmitted(nino, businessId, taxYear, quarter) {
    // This would check against your database of submissions
    // Implementation depends on your data storage strategy
    try {
      const periodId = this.generatePeriodId(nino, businessId, quarter, taxYear);
      // Check local database for submission record
      // Return true if submission exists
      return false; // Placeholder
    } catch (error) {
      logger.logError('Error checking quarter submission status', {
        nino, businessId, taxYear, quarter, error: error.message
      });
      return false;
    }
  }

  /**
   * Log quarterly submission attempt
   * @param {string} userId - User ID
   * @param {string} businessId - Business ID
   * @param {string} quarter - Quarter
   * @param {string} taxYear - Tax year
   * @param {Object} payload - Submission payload
   * @param {Object} response - HMRC response
   * @param {Error} error - Error if failed
   */
  async logQuarterlySubmissionAttempt(userId, businessId, quarter, taxYear, payload, response, error = null) {
    const logData = {
      userId,
      businessId,
      quarter,
      taxYear,
      timestamp: new Date(),
      success: !error,
      payload: payload ? this.sanitizeDataForSubmission(payload) : null,
      response: response ? {
        correlationId: response.correlationId,
        processingDate: response.processingDate
      } : null,
      error: error ? error.message : null
    };

    if (error) {
      logger.logError('Quarterly submission failed', logData);
    } else {
      logger.logHMRC('Quarterly submission successful', logData);
    }

    // Store in database for audit trail
    // Implementation depends on your audit storage strategy
  }

  /**
   * Generate submission summary
   * @param {Object} aggregatedData - Aggregated data
   * @param {Array} transactions - Original transactions
   * @returns {Object} Summary
   */
  generateSubmissionSummary(aggregatedData, transactions) {
    const totalIncome = Object.values(aggregatedData.income)
      .reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    
    const totalExpenses = Object.values(aggregatedData.expenses)
      .reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);

    return {
      transactionCount: transactions.length,
      totalIncome: this.formatCurrencyForHMRC(totalIncome),
      totalExpenses: this.formatCurrencyForHMRC(totalExpenses),
      netProfit: this.formatCurrencyForHMRC(totalIncome - totalExpenses),
      incomeCategories: Object.keys(aggregatedData.income).filter(key => 
        aggregatedData.income[key] > 0
      ),
      expenseCategories: Object.keys(aggregatedData.expenses).filter(key => 
        aggregatedData.expenses[key] > 0
      )
    };
  }
}

module.exports = QuarterlySubmissionService;