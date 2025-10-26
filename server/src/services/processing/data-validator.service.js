const moment = require('moment');
const crypto = require('crypto');

/**
 * Comprehensive Data Validation Service for MTD Tax Bridge Application
 * Handles transaction validation, UK tax compliance, HMRC rules, and data quality
 */
class DataValidatorService {
  constructor(logger, cacheService, configService) {
    this.logger = logger;
    this.cache = cacheService;
    this.config = configService;
    
    // Validation configuration
    this.validationConfig = {
      maxTransactionAmount: 1000000, // £1M
      minTransactionAmount: -1000000,
      maxDescriptionLength: 255,
      minDescriptionLength: 3,
      maxDateRange: 7, // years
      taxYearStart: '04-06', // 6th April
      vatRates: [0, 5, 20], // UK VAT rates
      batchSize: 5000,
      timeoutMs: 30000
    };

    // UK-specific patterns
    this.ukPatterns = {
      utr: /^[0-9]{10}$/,
      niNumber: /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D]{1}$/i,
      vatNumber: /^(GB)?([0-9]{9}([0-9]{3})?|[A-Z]{2}[0-9]{3})$/,
      postcode: /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i,
      currency: /^-?\£?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$/
    };

    // HMRC expense categories for sole traders and landlords
    this.hmrcCategories = {
      soleTrader: [
        'office_costs', 'travel_costs', 'clothing', 'staff_costs', 'thing_costs',
        'premises_costs', 'repairs_maintenance', 'general_admin', 'business_entertainment',
        'advertising', 'interest', 'other_finance_charges', 'irrecoverable_debts',
        'professional_fees', 'depreciation', 'other_expenses'
      ],
      landlord: [
        'premises_costs', 'repairs_maintenance', 'loan_interest', 'other_finance_charges',
        'legal_management', 'other_allowable_property_expenses'
      ]
    };

    // Business rules cache
    this.rulesCache = new Map();
    this.validationMetrics = {
      totalValidations: 0,
      errorCounts: {},
      performanceStats: {}
    };
  }

  // ====== TRANSACTION DATA VALIDATION ======

  /**
   * Validate complete transaction schema
   */
  async validateTransactionSchema(transaction) {
    const errors = [];
    const warnings = [];
    
    try {
      // Required fields validation
      const requiredFields = ['date', 'amount', 'description', 'type'];
      for (const field of requiredFields) {
        if (!transaction[field] && transaction[field] !== 0) {
          errors.push({
            field,
            code: 'FIELD_REQUIRED',
            message: `Required field '${field}' is missing or empty`,
            severity: 'critical'
          });
        }
      }

      // Field type validation
      if (transaction.date && !this._isValidDate(transaction.date)) {
        errors.push({
          field: 'date',
          code: 'INVALID_DATE_FORMAT',
          message: 'Date must be in valid format (YYYY-MM-DD)',
          severity: 'critical'
        });
      }

      if (transaction.amount !== undefined && typeof transaction.amount !== 'number') {
        errors.push({
          field: 'amount',
          code: 'INVALID_AMOUNT_TYPE',
          message: 'Amount must be a number',
          severity: 'critical'
        });
      }

      if (transaction.type && !['income', 'expense'].includes(transaction.type)) {
        errors.push({
          field: 'type',
          code: 'INVALID_TRANSACTION_TYPE',
          message: 'Transaction type must be "income" or "expense"',
          severity: 'critical'
        });
      }

      // Cross-field validation
      const crossValidation = await this.crossValidateTransactionFields(transaction);
      errors.push(...crossValidation.errors);
      warnings.push(...crossValidation.warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        validatedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Transaction schema validation failed:', error);
      return {
        isValid: false,
        errors: [{ code: 'VALIDATION_ERROR', message: error.message, severity: 'critical' }],
        warnings: []
      };
    }
  }

  /**
   * Validate transaction date
   */
  validateTransactionDate(date, taxYear = null) {
    const errors = [];
    const warnings = [];
    
    if (!date) {
      return {
        isValid: false,
        errors: [{ code: 'DATE_REQUIRED', message: 'Transaction date is required' }]
      };
    }

    const transactionDate = moment(date);
    const now = moment();
    
    // Date format validation
    if (!transactionDate.isValid()) {
      errors.push({
        code: 'INVALID_DATE_FORMAT',
        message: 'Invalid date format'
      });
    }

    // Future date check
    if (transactionDate.isAfter(now)) {
      errors.push({
        code: 'FUTURE_DATE',
        message: 'Transaction date cannot be in the future'
      });
    }

    // Reasonable business range (not older than configured years)
    const oldestAllowed = now.subtract(this.validationConfig.maxDateRange, 'years');
    if (transactionDate.isBefore(oldestAllowed)) {
      warnings.push({
        code: 'OLD_TRANSACTION',
        message: `Transaction is older than ${this.validationConfig.maxDateRange} years`
      });
    }

    // Tax year validation
    if (taxYear) {
      const taxYearValidation = this.validateTaxYear(taxYear, date);
      if (!taxYearValidation.isValid) {
        errors.push(...taxYearValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate transaction amount
   */
  validateTransactionAmount(amount, type = null) {
    const errors = [];
    const warnings = [];
    
    if (amount === null || amount === undefined) {
      return {
        isValid: false,
        errors: [{ code: 'AMOUNT_REQUIRED', message: 'Transaction amount is required' }]
      };
    }

    // Type validation
    if (typeof amount !== 'number' || isNaN(amount)) {
      errors.push({
        code: 'INVALID_AMOUNT_TYPE',
        message: 'Amount must be a valid number'
      });
    }

    // Range validation
    if (amount > this.validationConfig.maxTransactionAmount) {
      warnings.push({
        code: 'LARGE_AMOUNT',
        message: `Amount £${amount.toLocaleString()} is unusually large`
      });
    }

    if (amount < this.validationConfig.minTransactionAmount) {
      warnings.push({
        code: 'LARGE_NEGATIVE_AMOUNT',
        message: `Negative amount £${Math.abs(amount).toLocaleString()} is unusually large`
      });
    }

    // Decimal places validation
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      errors.push({
        code: 'TOO_MANY_DECIMAL_PLACES',
        message: 'Amount cannot have more than 2 decimal places'
      });
    }

    // Zero amount check
    if (amount === 0) {
      warnings.push({
        code: 'ZERO_AMOUNT',
        message: 'Transaction amount is zero'
      });
    }

    // Type consistency check
    if (type) {
      if (type === 'income' && amount > 0) {
        warnings.push({
          code: 'INCOME_POSITIVE_AMOUNT',
          message: 'Income transactions typically have negative amounts in accounting'
        });
      }
      if (type === 'expense' && amount < 0) {
        warnings.push({
          code: 'EXPENSE_NEGATIVE_AMOUNT',
          message: 'Expense transactions typically have positive amounts'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate transaction description
   */
  validateTransactionDescription(description) {
    const errors = [];
    const warnings = [];
    
    if (!description || description.trim().length === 0) {
      errors.push({
        code: 'DESCRIPTION_REQUIRED',
        message: 'Transaction description is required'
      });
    }

    if (description) {
      const trimmed = description.trim();
      
      // Length validation
      if (trimmed.length < this.validationConfig.minDescriptionLength) {
        errors.push({
          code: 'DESCRIPTION_TOO_SHORT',
          message: `Description must be at least ${this.validationConfig.minDescriptionLength} characters`
        });
      }

      if (trimmed.length > this.validationConfig.maxDescriptionLength) {
        errors.push({
          code: 'DESCRIPTION_TOO_LONG',
          message: `Description cannot exceed ${this.validationConfig.maxDescriptionLength} characters`
        });
      }

      // Suspicious patterns detection
      const suspiciousPatterns = this._detectSuspiciousPatterns(trimmed);
      warnings.push(...suspiciousPatterns);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Cross-validate transaction fields for logical consistency
   */
  async crossValidateTransactionFields(transaction) {
    const errors = [];
    const warnings = [];
    
    // Amount and type consistency
    if (transaction.amount && transaction.type) {
      if (transaction.type === 'income' && transaction.amount > 0) {
        warnings.push({
          code: 'INCOME_AMOUNT_SIGN',
          message: 'Income amounts are typically negative in accounting systems'
        });
      }
    }

    // Date and period consistency
    if (transaction.date && transaction.taxYear) {
      const taxYearCheck = this.validateTaxYear(transaction.taxYear, transaction.date);
      if (!taxYearCheck.isValid) {
        errors.push({
          code: 'DATE_TAX_YEAR_MISMATCH',
          message: 'Transaction date does not fall within specified tax year'
        });
      }
    }

    // VAT consistency
    if (transaction.vatAmount && transaction.amount) {
      const vatValidation = this.validateVATCalculations(transaction);
      if (!vatValidation.isValid) {
        errors.push(...vatValidation.errors);
      }
    }

    // Category and amount reasonableness
    if (transaction.category && transaction.amount) {
      const categoryValidation = await this._validateCategoryAmount(transaction.category, transaction.amount);
      warnings.push(...categoryValidation.warnings);
    }

    return { errors, warnings };
  }

  // ====== UK TAX-SPECIFIC VALIDATION ======

  /**
   * Validate UK Unique Taxpayer Reference
   */
  validateUTR(utr) {
    if (!utr) {
      return { isValid: false, errors: [{ code: 'UTR_REQUIRED', message: 'UTR is required' }] };
    }

    const cleanUTR = utr.toString().replace(/\s/g, '');
    
    if (!this.ukPatterns.utr.test(cleanUTR)) {
      return {
        isValid: false,
        errors: [{ code: 'INVALID_UTR_FORMAT', message: 'UTR must be 10 digits' }]
      };
    }

    // Check digit validation (simplified)
    const checkDigit = this._calculateUTRCheckDigit(cleanUTR.substring(0, 9));
    if (parseInt(cleanUTR[9]) !== checkDigit) {
      return {
        isValid: false,
        errors: [{ code: 'INVALID_UTR_CHECK_DIGIT', message: 'UTR check digit is invalid' }]
      };
    }

    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Validate National Insurance Number
   */
  validateNINumber(niNumber) {
    if (!niNumber) {
      return { isValid: false, errors: [{ code: 'NI_REQUIRED', message: 'National Insurance number is required' }] };
    }

    const cleanNI = niNumber.toString().replace(/\s/g, '').toUpperCase();
    
    if (!this.ukPatterns.niNumber.test(cleanNI)) {
      return {
        isValid: false,
        errors: [{ code: 'INVALID_NI_FORMAT', message: 'Invalid National Insurance number format' }]
      };
    }

    // Additional validation rules
    const firstTwo = cleanNI.substring(0, 2);
    const invalidPrefixes = ['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ'];
    
    if (invalidPrefixes.includes(firstTwo)) {
      return {
        isValid: false,
        errors: [{ code: 'INVALID_NI_PREFIX', message: 'Invalid National Insurance number prefix' }]
      };
    }

    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Validate UK VAT Number
   */
  validateVATNumber(vatNumber) {
    if (!vatNumber) {
      return { isValid: true, errors: [], warnings: [] }; // VAT number is optional
    }

    const cleanVAT = vatNumber.toString().replace(/\s/g, '').toUpperCase();
    
    if (!this.ukPatterns.vatNumber.test(cleanVAT)) {
      return {
        isValid: false,
        errors: [{ code: 'INVALID_VAT_FORMAT', message: 'Invalid UK VAT number format' }]
      };
    }

    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Validate UK postcode
   */
  validateUKPostcode(postcode) {
    if (!postcode) {
      return { isValid: true, errors: [], warnings: [] }; // Postcode is optional
    }

    const cleanPostcode = postcode.toString().replace(/\s/g, '').toUpperCase();
    
    if (!this.ukPatterns.postcode.test(cleanPostcode)) {
      return {
        isValid: false,
        errors: [{ code: 'INVALID_POSTCODE_FORMAT', message: 'Invalid UK postcode format' }]
      };
    }

    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Validate tax year
   */
  validateTaxYear(taxYear, date) {
    const errors = [];
    
    if (!taxYear) {
      return { isValid: false, errors: [{ code: 'TAX_YEAR_REQUIRED', message: 'Tax year is required' }] };
    }

    // Tax year format validation (e.g., "2024-25")
    const taxYearPattern = /^(\d{4})-(\d{2})$/;
    const match = taxYear.match(taxYearPattern);
    
    if (!match) {
      errors.push({
        code: 'INVALID_TAX_YEAR_FORMAT',
        message: 'Tax year must be in format YYYY-YY (e.g., 2024-25)'
      });
    }

    if (date && match) {
      const startYear = parseInt(match[1]);
      const transactionDate = moment(date);
      const taxYearStart = moment(`${startYear}-04-06`);
      const taxYearEnd = moment(`${startYear + 1}-04-05`);
      
      if (!transactionDate.isBetween(taxYearStart, taxYearEnd, 'day', '[]')) {
        errors.push({
          code: 'DATE_OUTSIDE_TAX_YEAR',
          message: `Date ${date} is not within tax year ${taxYear}`
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  // ====== BUSINESS RULES VALIDATION ======

  /**
   * Validate business expenses for specific business type
   */
  async validateBusinessExpenses(transactions, businessType = 'soleTrader') {
    const errors = [];
    const warnings = [];
    
    const allowedCategories = this.hmrcCategories[businessType] || this.hmrcCategories.soleTrader;
    
    for (const transaction of transactions) {
      if (transaction.type === 'expense' && transaction.category) {
        if (!allowedCategories.includes(transaction.category)) {
          errors.push({
            transactionId: transaction.id,
            code: 'INVALID_EXPENSE_CATEGORY',
            message: `Category '${transaction.category}' is not allowed for ${businessType}`,
            category: transaction.category
          });
        }

        // Check if expense is allowable
        const allowableCheck = await this.validateAllowableExpenses(transaction, transaction.category);
        if (!allowableCheck.isValid) {
          warnings.push(...allowableCheck.warnings);
          errors.push(...allowableCheck.errors);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate VAT calculations
   */
  validateVATCalculations(transaction) {
    const errors = [];
    const warnings = [];
    
    if (!transaction.vatAmount || !transaction.amount) {
      return { isValid: true, errors, warnings };
    }

    const vatAmount = Math.abs(transaction.vatAmount);
    const totalAmount = Math.abs(transaction.amount);
    const netAmount = totalAmount - vatAmount;
    
    // Calculate expected VAT rates
    const possibleRates = this.validationConfig.vatRates.map(rate => {
      const expectedVAT = (netAmount * rate) / 100;
      return {
        rate,
        expectedVAT: Math.round(expectedVAT * 100) / 100,
        difference: Math.abs(expectedVAT - vatAmount)
      };
    });

    const bestMatch = possibleRates.reduce((best, current) => 
      current.difference < best.difference ? current : best
    );

    // Allow small rounding differences (£0.02)
    if (bestMatch.difference > 0.02) {
      warnings.push({
        code: 'VAT_CALCULATION_MISMATCH',
        message: `VAT amount £${vatAmount} doesn't match expected £${bestMatch.expectedVAT} at ${bestMatch.rate}%`,
        expectedVAT: bestMatch.expectedVAT,
        actualVAT: vatAmount,
        suggestedRate: bestMatch.rate
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate allowable expenses
   */
  async validateAllowableExpenses(expense, category) {
    const errors = [];
    const warnings = [];
    
    // Check against HMRC allowable expenses rules
    const disallowedPatterns = [
      'personal', 'private', 'family', 'entertainment', 'gifts over £50',
      'clothing (unless protective/uniform)', 'travel to regular workplace'
    ];

    const description = expense.description?.toLowerCase() || '';
    
    for (const pattern of disallowedPatterns) {
      if (description.includes(pattern.split(' ')[0])) {
        warnings.push({
          code: 'POTENTIALLY_DISALLOWED_EXPENSE',
          message: `Expense may not be allowable: ${pattern}`,
          pattern
        });
      }
    }

    // Capital vs Revenue check
    const capitalKeywords = ['computer', 'equipment', 'machinery', 'vehicle', 'building'];
    if (capitalKeywords.some(keyword => description.includes(keyword)) && expense.amount > 500) {
      warnings.push({
        code: 'POTENTIAL_CAPITAL_EXPENDITURE',
        message: 'This may be capital expenditure rather than revenue expense',
        amount: expense.amount
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ====== DATA QUALITY VALIDATION ======

  /**
   * Detect duplicate transactions
   */
  detectDuplicateTransactions(transactions) {
    const duplicates = [];
    const seen = new Map();
    
    transactions.forEach((transaction, index) => {
      const key = `${transaction.date}_${transaction.amount}_${transaction.description?.substring(0, 50)}`;
      
      if (seen.has(key)) {
        duplicates.push({
          current: { index, ...transaction },
          duplicate: seen.get(key),
          confidence: this._calculateDuplicateConfidence(transaction, seen.get(key).transaction)
        });
      } else {
        seen.set(key, { index, transaction });
      }
    });

    return duplicates;
  }

  /**
   * Flag outliers in transaction data
   */
  flagOutliers(transactions, metrics = {}) {
    const outliers = [];
    
    if (transactions.length < 10) return outliers; // Need sufficient data
    
    const amounts = transactions.map(t => Math.abs(t.amount)).sort((a, b) => a - b);
    const q1 = amounts[Math.floor(amounts.length * 0.25)];
    const q3 = amounts[Math.floor(amounts.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    transactions.forEach((transaction, index) => {
      const amount = Math.abs(transaction.amount);
      
      if (amount < lowerBound || amount > upperBound) {
        outliers.push({
          index,
          transaction,
          reason: amount > upperBound ? 'unusually_large' : 'unusually_small',
          amount,
          bounds: { lower: lowerBound, upper: upperBound }
        });
      }
    });

    return outliers;
  }

  // ====== ERROR HANDLING & REPORTING ======

  /**
   * Generate comprehensive validation report
   */
  generateValidationReport(dataset, validationResults) {
    const report = {
      summary: {
        totalRecords: dataset.length,
        validRecords: 0,
        invalidRecords: 0,
        warningRecords: 0,
        validationDate: new Date().toISOString()
      },
      errorBreakdown: {},
      warningBreakdown: {},
      recommendations: [],
      qualityScore: 0
    };

    validationResults.forEach(result => {
      if (result.isValid && result.warnings.length === 0) {
        report.summary.validRecords++;
      } else if (!result.isValid) {
        report.summary.invalidRecords++;
        
        result.errors.forEach(error => {
          report.errorBreakdown[error.code] = (report.errorBreakdown[error.code] || 0) + 1;
        });
      } else if (result.warnings.length > 0) {
        report.summary.warningRecords++;
        
        result.warnings.forEach(warning => {
          report.warningBreakdown[warning.code] = (report.warningBreakdown[warning.code] || 0) + 1;
        });
      }
    });

    // Calculate quality score
    const validPercentage = (report.summary.validRecords / report.summary.totalRecords) * 100;
    const warningPenalty = (report.summary.warningRecords / report.summary.totalRecords) * 10;
    report.qualityScore = Math.max(0, validPercentage - warningPenalty);

    // Generate recommendations
    report.recommendations = this._generateRecommendations(report.errorBreakdown, report.warningBreakdown);

    return report;
  }

  /**
   * Create user-friendly error messages
   */
  createUserFriendlyErrorMessages(errors) {
    const friendlyMessages = {
      'FIELD_REQUIRED': 'Please fill in all required fields',
      'INVALID_DATE_FORMAT': 'Please use DD/MM/YYYY date format',
      'INVALID_AMOUNT_TYPE': 'Please enter a valid amount (numbers only)',
      'DESCRIPTION_TOO_SHORT': 'Please provide a more detailed description',
      'INVALID_UTR_FORMAT': 'UTR should be 10 digits',
      'INVALID_NI_FORMAT': 'National Insurance number format is incorrect',
      'VAT_CALCULATION_MISMATCH': 'VAT amount seems incorrect for this transaction'
    };

    return errors.map(error => ({
      ...error,
      userMessage: friendlyMessages[error.code] || error.message,
      helpText: this._getHelpText(error.code)
    }));
  }

  // ====== BATCH & PERFORMANCE OPERATIONS ======

  /**
   * Batch validate transactions
   */
  async batchValidateTransactions(transactions, batchSize = null) {
    const actualBatchSize = batchSize || this.validationConfig.batchSize;
    const results = [];
    
    for (let i = 0; i < transactions.length; i += actualBatchSize) {
      const batch = transactions.slice(i, i + actualBatchSize);
      const batchResults = await Promise.all(
        batch.map(transaction => this.validateTransactionSchema(transaction))
      );
      results.push(...batchResults);
      
      // Update metrics
      this.validationMetrics.totalValidations += batch.length;
    }

    return results;
  }

  /**
   * Cache validation rules for performance
   */
  async cacheValidationRules(rules) {
    const cacheKey = 'validation:rules:' + crypto.createHash('md5').update(JSON.stringify(rules)).digest('hex');
    await this.cache.set(cacheKey, rules, 3600); // 1 hour cache
    return cacheKey;
  }

  // ====== HELPER METHODS ======

  _isValidDate(dateString) {
    return moment(dateString, 'YYYY-MM-DD', true).isValid();
  }

  _detectSuspiciousPatterns(description) {
    const warnings = [];
    const suspiciousPatterns = [
      { pattern: /cash/i, message: 'Cash transaction - ensure proper documentation' },
      { pattern: /personal|private/i, message: 'Potentially personal expense' },
      { pattern: /test|dummy/i, message: 'Test or placeholder transaction' }
    ];

    suspiciousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(description)) {
        warnings.push({
          code: 'SUSPICIOUS_PATTERN',
          message,
          pattern: pattern.source
        });
      }
    });

    return warnings;
  }

  _calculateUTRCheckDigit(ninedigits) {
    // Simplified UTR check digit calculation
    const weights = [6, 7, 8, 9, 10, 5, 4, 3, 2];
    let sum = 0;
    
    for (let i = 0; i < 9; i++) {
      sum += parseInt(ninedigits[i]) * weights[i];
    }
    
    const remainder = sum % 11;
    return remainder < 2 ? remainder : 11 - remainder;
  }

  async _validateCategoryAmount(category, amount) {
    // Implementation for category-specific amount validation
    const warnings = [];
    
    // Example: Office costs over £10,000 might be unusual for small businesses
    if (category === 'office_costs' && Math.abs(amount) > 10000) {
      warnings.push({
        code: 'UNUSUAL_CATEGORY_AMOUNT',
        message: `Large amount for ${category}: £${Math.abs(amount).toLocaleString()}`
      });
    }

    return { warnings };
  }

  _calculateDuplicateConfidence(trans1, trans2) {
    let confidence = 0;
    
    // Exact match factors
    if (trans1.date === trans2.date) confidence += 40;
    if (trans1.amount === trans2.amount) confidence += 40;
    if (trans1.description === trans2.description) confidence += 20;
    
    return confidence;
  }

  _generateRecommendations(errorBreakdown, warningBreakdown) {
    const recommendations = [];
    
    if (errorBreakdown['FIELD_REQUIRED']) {
      recommendations.push('Complete all required fields before validation');
    }
    
    if (errorBreakdown['INVALID_DATE_FORMAT']) {
      recommendations.push('Use DD/MM/YYYY format for all dates');
    }
    
    if (warningBreakdown['SUSPICIOUS_PATTERN']) {
      recommendations.push('Review flagged transactions for potential personal expenses');
    }

    return recommendations;
  }

  _getHelpText(errorCode) {
    const helpTexts = {
      'INVALID_DATE_FORMAT': 'Use format: 31/12/2024 for 31st December 2024',
      'INVALID_UTR_FORMAT': 'UTR is a 10-digit number issued by HMRC',
      'VAT_CALCULATION_MISMATCH': 'Check VAT rate: 0% (zero), 5% (reduced), 20% (standard)'
    };
    
    return helpTexts[errorCode] || 'Contact support if you need help with this error';
  }
}

module.exports = DataValidatorService;
