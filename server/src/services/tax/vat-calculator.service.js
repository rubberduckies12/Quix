const logger = require('../../utils/logger.util');
const DateUtil = require('../../utils/date.util');
const { ValidationError, AppError } = require('../../utils/error.util');

/**
 * Comprehensive VAT Calculator Service for UK MTD compliance
 * Handles all aspects of UK VAT calculations, schemes, and compliance
 */
class VATCalculatorService {
  constructor() {
    this.vatRates = this.initializeVATRates();
    this.flatRateSchemes = this.initializeFlatRateSchemes();
    this.exemptCategories = this.initializeExemptCategories();
    this.vatThresholds = this.initializeVATThresholds();
  }

  // =====================================================
  // VAT RATES & HISTORICAL DATA
  // =====================================================

  /**
   * Initialize UK VAT rates with historical data
   */
  initializeVATRates() {
    return {
      current: {
        standard: 20,
        reduced: 5,
        zero: 0
      },
      historical: [
        {
          startDate: '2011-01-04',
          endDate: null, // Current
          standard: 20,
          reduced: 5,
          zero: 0
        },
        {
          startDate: '2010-01-01',
          endDate: '2011-01-03',
          standard: 17.5,
          reduced: 5,
          zero: 0
        }
        // Add more historical rates as needed
      ]
    };
  }

  /**
   * Initialize Flat Rate Scheme percentages by business sector
   */
  initializeFlatRateSchemes() {
    return {
      'accounting_bookkeeping': 13.5,
      'advertising': 11,
      'agriculture_horticulture': 10,
      'architect_civil_engineer': 14.5,
      'boarding_kennels': 12,
      'builder': 9.5,
      'business_consultancy': 14,
      'catering_restaurants': 12.5,
      'computer_it_services': 14.5,
      'entertainment_journalism': 12.5,
      'estate_agent': 12,
      'farming': 10,
      'financial_services': 13.5,
      'forestry_logging': 10,
      'general_building': 9.5,
      'hairdressing': 13,
      'hotel_accommodation': 10.5,
      'labour_recruitment': 14,
      'laundry_dry_cleaning': 12,
      'lawyer_legal_services': 14.5,
      'library_museum': 9.5,
      'manufacturing_food': 9,
      'manufacturing_other': 10.5,
      'mining_quarrying': 10,
      'photography': 11,
      'post_office': 5,
      'printing': 11,
      'property_management': 10.5,
      'publishing': 11,
      'retail_food': 4,
      'retail_other': 7.5,
      'sport_recreation': 8.5,
      'transport': 10,
      'travel_agent': 10.5,
      'veterinary_services': 11,
      'wholesaling_food': 7.5,
      'wholesaling_other': 8,
      'general': 16.5 // Default rate
    };
  }

  /**
   * Initialize VAT exempt categories
   */
  initializeExemptCategories() {
    return [
      'insurance',
      'finance_banking',
      'education',
      'health_medical',
      'postal_services',
      'betting_gaming',
      'burial_cremation',
      'trade_unions',
      'sports_competitions',
      'charity_fundraising'
    ];
  }

  /**
   * Initialize VAT registration thresholds
   */
  initializeVATThresholds() {
    return {
      registration: 85000, // £85,000 for 2024-25
      deregistration: 83000, // £83,000 for 2024-25
      distance_selling: 8818 // £8,818 for distance selling
    };
  }

  // =====================================================
  // CORE VAT CALCULATIONS
  // =====================================================

  /**
   * Calculate VAT from VAT-inclusive (gross) amount
   * @param {number} grossAmount - VAT-inclusive amount
   * @param {number} vatRate - VAT rate as percentage
   * @returns {Object} Calculation breakdown
   */
  calculateVATFromGross(grossAmount, vatRate) {
    try {
      this.validateAmount(grossAmount);
      this.validateVATRate(vatRate);

      if (vatRate === 0) {
        return {
          grossAmount: this.roundVAT(grossAmount),
          netAmount: this.roundVAT(grossAmount),
          vatAmount: 0,
          vatRate,
          calculation: 'zero_rate'
        };
      }

      const vatMultiplier = (100 + vatRate) / 100;
      const netAmount = grossAmount / vatMultiplier;
      const vatAmount = grossAmount - netAmount;

      return {
        grossAmount: this.roundVAT(grossAmount),
        netAmount: this.roundVAT(netAmount),
        vatAmount: this.roundVAT(vatAmount),
        vatRate,
        calculation: 'vat_inclusive'
      };
    } catch (error) {
      logger.logError('VAT calculation from gross failed', { grossAmount, vatRate, error: error.message });
      throw new AppError('VAT calculation failed', 400, 'VAT_CALCULATION_ERROR', { grossAmount, vatRate });
    }
  }

  /**
   * Calculate VAT from VAT-exclusive (net) amount
   * @param {number} netAmount - VAT-exclusive amount
   * @param {number} vatRate - VAT rate as percentage
   * @returns {Object} Calculation breakdown
   */
  calculateVATFromNet(netAmount, vatRate) {
    try {
      this.validateAmount(netAmount);
      this.validateVATRate(vatRate);

      if (vatRate === 0) {
        return {
          grossAmount: this.roundVAT(netAmount),
          netAmount: this.roundVAT(netAmount),
          vatAmount: 0,
          vatRate,
          calculation: 'zero_rate'
        };
      }

      const vatAmount = (netAmount * vatRate) / 100;
      const grossAmount = netAmount + vatAmount;

      return {
        grossAmount: this.roundVAT(grossAmount),
        netAmount: this.roundVAT(netAmount),
        vatAmount: this.roundVAT(vatAmount),
        vatRate,
        calculation: 'vat_exclusive'
      };
    } catch (error) {
      logger.logError('VAT calculation from net failed', { netAmount, vatRate, error: error.message });
      throw new AppError('VAT calculation failed', 400, 'VAT_CALCULATION_ERROR', { netAmount, vatRate });
    }
  }

  /**
   * Calculate net amount from gross amount
   * @param {number} grossAmount - VAT-inclusive amount
   * @param {number} vatRate - VAT rate as percentage
   * @returns {number} Net amount
   */
  calculateNetAmount(grossAmount, vatRate) {
    const result = this.calculateVATFromGross(grossAmount, vatRate);
    return result.netAmount;
  }

  /**
   * Calculate gross amount from net amount
   * @param {number} netAmount - VAT-exclusive amount
   * @param {number} vatRate - VAT rate as percentage
   * @returns {number} Gross amount
   */
  calculateGrossAmount(netAmount, vatRate) {
    const result = this.calculateVATFromNet(netAmount, vatRate);
    return result.grossAmount;
  }

  /**
   * Round VAT amount to nearest penny (HMRC rounding rules)
   * @param {number} amount - Amount to round
   * @returns {number} Rounded amount
   */
  roundVAT(amount) {
    return Math.round(amount * 100) / 100;
  }

  // =====================================================
  // FLAT RATE SCHEME CALCULATIONS
  // =====================================================

  /**
   * Calculate VAT due under Flat Rate Scheme
   * @param {number} turnover - VAT-inclusive turnover
   * @param {string} businessSector - Business sector code
   * @param {boolean} isFirstYear - Whether in first year of VAT registration
   * @returns {Object} Flat rate VAT calculation
   */
  calculateFlatRateVAT(turnover, businessSector, isFirstYear = false) {
    try {
      this.validateAmount(turnover);
      
      let flatRatePercentage = this.getFlatRatePercentage(businessSector);
      
      // Apply 1% discount for first year
      if (isFirstYear) {
        flatRatePercentage = Math.max(0, flatRatePercentage - 1);
      }

      const vatDue = (turnover * flatRatePercentage) / 100;

      return {
        turnover: this.roundVAT(turnover),
        flatRatePercentage,
        vatDue: this.roundVAT(vatDue),
        businessSector,
        isFirstYear,
        calculation: 'flat_rate_scheme'
      };
    } catch (error) {
      logger.logError('Flat rate VAT calculation failed', { turnover, businessSector, error: error.message });
      throw new AppError('Flat rate VAT calculation failed', 400, 'FLAT_RATE_CALCULATION_ERROR');
    }
  }

  /**
   * Get flat rate percentage for business sector
   * @param {string} businessSector - Business sector code
   * @returns {number} Flat rate percentage
   */
  getFlatRatePercentage(businessSector) {
    return this.flatRateSchemes[businessSector] || this.flatRateSchemes.general;
  }

  /**
   * Compare Flat Rate Scheme vs Standard VAT for transactions
   * @param {Array} transactions - Array of transaction objects
   * @param {string} businessSector - Business sector for flat rate
   * @param {boolean} isFirstYear - Whether in first year
   * @returns {Object} Comparison analysis
   */
  compareFlatRateVsStandard(transactions, businessSector, isFirstYear = false) {
    try {
      // Calculate standard VAT
      const standardCalculation = this.calculateStandardVAT(transactions);
      
      // Calculate flat rate VAT
      const totalTurnover = transactions
        .filter(t => t.transactionType === 'income')
        .reduce((sum, t) => sum + t.grossAmount, 0);
      
      const flatRateCalculation = this.calculateFlatRateVAT(totalTurnover, businessSector, isFirstYear);

      const savings = standardCalculation.netVATDue - flatRateCalculation.vatDue;
      const recommendation = savings > 0 ? 'standard' : 'flat_rate';

      return {
        standardVAT: standardCalculation,
        flatRateVAT: flatRateCalculation,
        savings: this.roundVAT(savings),
        savingsPercentage: totalTurnover > 0 ? this.roundVAT((savings / totalTurnover) * 100) : 0,
        recommendation,
        analysis: {
          turnover: this.roundVAT(totalTurnover),
          inputVATClaimed: standardCalculation.vatReclaimed,
          flatRateInputVATAllowed: 0, // No input VAT recovery on flat rate
          businessSector,
          isFirstYear
        }
      };
    } catch (error) {
      logger.logError('VAT scheme comparison failed', { error: error.message });
      throw new AppError('VAT scheme comparison failed', 400, 'SCHEME_COMPARISON_ERROR');
    }
  }

  // =====================================================
  // VAT RETURN CALCULATIONS
  // =====================================================

  /**
   * Calculate VAT due on sales (Box 1)
   * @param {Array} salesTransactions - Sales transactions
   * @returns {number} VAT due on sales
   */
  calculateVATDue(salesTransactions) {
    return salesTransactions
      .filter(t => t.transactionType === 'income')
      .reduce((total, transaction) => {
        const vatAmount = transaction.vatAmount || 0;
        return total + vatAmount;
      }, 0);
  }

  /**
   * Calculate VAT reclaimed on purchases (Box 4)
   * @param {Array} purchaseTransactions - Purchase transactions
   * @returns {number} VAT reclaimed
   */
  calculateVATReclaimed(purchaseTransactions) {
    return purchaseTransactions
      .filter(t => t.transactionType === 'expense')
      .reduce((total, transaction) => {
        const vatAmount = transaction.vatAmount || 0;
        return total + vatAmount;
      }, 0);
  }

  /**
   * Calculate net VAT due (Box 5)
   * @param {number} vatDue - VAT due on sales
   * @param {number} vatReclaimed - VAT reclaimed on purchases
   * @returns {number} Net VAT due (positive) or refund due (negative)
   */
  calculateNetVATDue(vatDue, vatReclaimed) {
    return this.roundVAT(vatDue - vatReclaimed);
  }

  /**
   * Calculate total sales excluding VAT (Box 6)
   * @param {Array} transactions - All transactions
   * @returns {number} Total sales excluding VAT
   */
  calculateTotalSales(transactions) {
    return this.roundVAT(
      transactions
        .filter(t => t.transactionType === 'income')
        .reduce((total, transaction) => total + (transaction.netAmount || 0), 0)
    );
  }

  /**
   * Calculate total purchases excluding VAT (Box 7)
   * @param {Array} transactions - All transactions
   * @returns {number} Total purchases excluding VAT
   */
  calculateTotalPurchases(transactions) {
    return this.roundVAT(
      transactions
        .filter(t => t.transactionType === 'expense')
        .reduce((total, transaction) => total + (transaction.netAmount || 0), 0)
    );
  }

  /**
   * Calculate complete VAT return for standard scheme
   * @param {Array} transactions - All transactions for period
   * @returns {Object} Complete VAT return calculation
   */
  calculateStandardVAT(transactions) {
    const salesTransactions = transactions.filter(t => t.transactionType === 'income');
    const purchaseTransactions = transactions.filter(t => t.transactionType === 'expense');

    const vatDue = this.calculateVATDue(salesTransactions);
    const vatReclaimed = this.calculateVATReclaimed(purchaseTransactions);
    const netVATDue = this.calculateNetVATDue(vatDue, vatReclaimed);
    const totalSales = this.calculateTotalSales(transactions);
    const totalPurchases = this.calculateTotalPurchases(transactions);

    return {
      vatDue: this.roundVAT(vatDue),
      vatReclaimed: this.roundVAT(vatReclaimed),
      netVATDue: this.roundVAT(netVATDue),
      totalSales: this.roundVAT(totalSales),
      totalPurchases: this.roundVAT(totalPurchases),
      scheme: 'standard',
      calculation: 'standard_vat_return'
    };
  }

  // =====================================================
  // TRANSACTION PROCESSING
  // =====================================================

  /**
   * Categorize VAT rate based on transaction details
   * @param {string} description - Transaction description
   * @param {number} amount - Transaction amount
   * @param {string} category - Transaction category
   * @returns {Object} VAT rate determination
   */
  categorizeVATRate(description, amount, category) {
    const lowerDesc = description.toLowerCase();
    const lowerCat = category.toLowerCase();

    // Zero rate items
    if (this.isZeroRatedItem(lowerDesc, lowerCat)) {
      return {
        vatRate: 0,
        reason: 'zero_rated',
        confidence: 0.9,
        category: 'zero_rate'
      };
    }

    // Reduced rate items
    if (this.isReducedRateItem(lowerDesc, lowerCat)) {
      return {
        vatRate: 5,
        reason: 'reduced_rate',
        confidence: 0.8,
        category: 'reduced_rate'
      };
    }

    // Exempt items
    if (this.isExemptItem(lowerDesc, lowerCat)) {
      return {
        vatRate: null,
        reason: 'vat_exempt',
        confidence: 0.9,
        category: 'exempt'
      };
    }

    // Default to standard rate
    return {
      vatRate: 20,
      reason: 'standard_rate',
      confidence: 0.7,
      category: 'standard_rate'
    };
  }

  /**
   * Validate VAT transaction calculations
   * @param {Object} transaction - Transaction object
   * @returns {Object} Validation result
   */
  validateVATTransaction(transaction) {
    try {
      const { grossAmount, netAmount, vatAmount, vatRate } = transaction;

      // Check if amounts are provided
      if (!grossAmount && !netAmount) {
        return {
          isValid: false,
          errors: ['Either gross amount or net amount must be provided']
        };
      }

      // Validate VAT rate
      if (vatRate !== null && !this.isValidVATRate(vatRate)) {
        return {
          isValid: false,
          errors: [`Invalid VAT rate: ${vatRate}%`]
        };
      }

      // Recalculate VAT to check consistency
      let calculatedVAT;
      if (grossAmount && vatRate !== null) {
        calculatedVAT = this.calculateVATFromGross(grossAmount, vatRate);
      } else if (netAmount && vatRate !== null) {
        calculatedVAT = this.calculateVATFromNet(netAmount, vatRate);
      } else {
        // Exempt transaction
        calculatedVAT = {
          grossAmount: grossAmount || netAmount,
          netAmount: netAmount || grossAmount,
          vatAmount: 0
        };
      }

      // Check for discrepancies
      const errors = [];
      const tolerance = 0.01; // 1p tolerance

      if (netAmount && Math.abs(calculatedVAT.netAmount - netAmount) > tolerance) {
        errors.push(`Net amount mismatch: provided ${netAmount}, calculated ${calculatedVAT.netAmount}`);
      }

      if (vatAmount && Math.abs(calculatedVAT.vatAmount - vatAmount) > tolerance) {
        errors.push(`VAT amount mismatch: provided ${vatAmount}, calculated ${calculatedVAT.vatAmount}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        calculatedVAT,
        correctedTransaction: {
          ...transaction,
          ...calculatedVAT
        }
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * Handle mixed VAT rate transactions
   * @param {Object} transaction - Transaction with multiple VAT rates
   * @param {Array} vatBreakdown - Array of VAT components
   * @returns {Object} Split transaction calculation
   */
  splitMixedRateTransaction(transaction, vatBreakdown) {
    try {
      const splitTransactions = [];
      let totalNet = 0;
      let totalVAT = 0;
      let totalGross = 0;

      vatBreakdown.forEach((component, index) => {
        const { amount, vatRate, description } = component;
        const vatCalc = this.calculateVATFromNet(amount, vatRate);
        
        const splitTransaction = {
          ...transaction,
          id: `${transaction.id}_split_${index + 1}`,
          description: description || `${transaction.description} (Part ${index + 1})`,
          netAmount: vatCalc.netAmount,
          vatAmount: vatCalc.vatAmount,
          grossAmount: vatCalc.grossAmount,
          vatRate,
          isSplit: true,
          originalTransactionId: transaction.id
        };

        splitTransactions.push(splitTransaction);
        totalNet += vatCalc.netAmount;
        totalVAT += vatCalc.vatAmount;
        totalGross += vatCalc.grossAmount;
      });

      return {
        originalTransaction: transaction,
        splitTransactions,
        totals: {
          netAmount: this.roundVAT(totalNet),
          vatAmount: this.roundVAT(totalVAT),
          grossAmount: this.roundVAT(totalGross)
        },
        isValid: Math.abs(totalGross - transaction.grossAmount) < 0.01
      };
    } catch (error) {
      logger.logError('Mixed VAT rate transaction split failed', { transaction, error: error.message });
      throw new AppError('Transaction split failed', 400, 'TRANSACTION_SPLIT_ERROR');
    }
  }

  // =====================================================
  // SCHEME SWITCHING & ELIGIBILITY
  // =====================================================

  /**
   * Evaluate financial impact of VAT scheme change
   * @param {string} currentScheme - Current VAT scheme
   * @param {string} proposedScheme - Proposed VAT scheme
   * @param {Array} transactions - Historical transactions
   * @param {string} businessSector - Business sector for flat rate
   * @returns {Object} Scheme change analysis
   */
  evaluateSchemeChange(currentScheme, proposedScheme, transactions, businessSector) {
    try {
      const currentCost = this.calculateSchemeVATCost(currentScheme, transactions, businessSector);
      const proposedCost = this.calculateSchemeVATCost(proposedScheme, transactions, businessSector);
      
      const annualSavings = currentCost.annualVAT - proposedCost.annualVAT;
      const percentageSaving = currentCost.annualVAT > 0 ? (annualSavings / currentCost.annualVAT) * 100 : 0;

      return {
        currentScheme: {
          scheme: currentScheme,
          ...currentCost
        },
        proposedScheme: {
          scheme: proposedScheme,
          ...proposedCost
        },
        analysis: {
          annualSavings: this.roundVAT(annualSavings),
          percentageSaving: this.roundVAT(percentageSaving),
          recommendation: annualSavings > 0 ? 'switch' : 'stay',
          breakEvenPoint: this.calculateBreakEvenPoint(currentCost, proposedCost),
          considerations: this.getSchemeChangeConsiderations(currentScheme, proposedScheme)
        }
      };
    } catch (error) {
      logger.logError('Scheme change evaluation failed', { error: error.message });
      throw new AppError('Scheme change evaluation failed', 400, 'SCHEME_EVALUATION_ERROR');
    }
  }

  /**
   * Check VAT registration threshold monitoring
   * @param {number} turnover - Rolling 12-month turnover
   * @param {Date} period - Period for calculation
   * @returns {Object} Threshold monitoring result
   */
  calculateThresholdMonitoring(turnover, period = new Date()) {
    const registrationThreshold = this.vatThresholds.registration;
    const deregistrationThreshold = this.vatThresholds.deregistration;
    
    const distanceToRegistration = registrationThreshold - turnover;
    const isAboveRegistrationThreshold = turnover >= registrationThreshold;
    const isBelowDeregistrationThreshold = turnover <= deregistrationThreshold;

    return {
      turnover: this.roundVAT(turnover),
      thresholds: this.vatThresholds,
      status: {
        mustRegister: isAboveRegistrationThreshold,
        canDeregister: isBelowDeregistrationThreshold,
        distanceToRegistration: this.roundVAT(distanceToRegistration),
        registrationProgress: this.roundVAT((turnover / registrationThreshold) * 100)
      },
      period: DateUtil.formatForDisplay(period),
      warnings: this.getThresholdWarnings(turnover, distanceToRegistration)
    };
  }

  /**
   * Check eligibility for Flat Rate Scheme
   * @param {string} businessType - Type of business
   * @param {number} annualTurnover - Expected annual turnover
   * @returns {Object} Eligibility result
   */
  isEligibleForFlatRate(businessType, annualTurnover) {
    const flatRateLimit = 150000; // £150,000 annual limit for flat rate scheme
    
    return {
      isEligible: annualTurnover <= flatRateLimit,
      businessType,
      annualTurnover: this.roundVAT(annualTurnover),
      flatRateLimit,
      flatRatePercentage: this.getFlatRatePercentage(businessType),
      distanceToLimit: this.roundVAT(flatRateLimit - annualTurnover),
      requirements: [
        'Annual turnover must not exceed £150,000',
        'Must not be in first year if switching from standard scheme',
        'Limited recovery of input VAT on capital expenditure over £2,000'
      ]
    };
  }

  // =====================================================
  // VAT PERIOD MANAGEMENT
  // =====================================================

  /**
   * Calculate VAT return for specific period
   * @param {Array} transactions - Transactions in period
   * @param {Date} startDate - Period start date
   * @param {Date} endDate - Period end date
   * @param {string} vatScheme - VAT scheme (standard/flat_rate)
   * @param {Object} options - Additional options
   * @returns {Object} VAT return calculation
   */
  calculateVATReturnPeriod(transactions, startDate, endDate, vatScheme = 'standard', options = {}) {
    try {
      // Filter transactions for period
      const periodTransactions = this.filterTransactionsByPeriod(transactions, startDate, endDate);
      
      // Validate period
      this.validateVATReportingPeriod(startDate, endDate);

      let vatReturn;
      
      if (vatScheme === 'flat_rate') {
        const turnover = this.calculateTotalSales(periodTransactions);
        const flatRateCalc = this.calculateFlatRateVAT(
          turnover, 
          options.businessSector || 'general',
          options.isFirstYear || false
        );
        
        vatReturn = {
          ...flatRateCalc,
          scheme: 'flat_rate',
          period: {
            start: DateUtil.formatForDisplay(startDate),
            end: DateUtil.formatForDisplay(endDate)
          },
          transactionCount: periodTransactions.length
        };
      } else {
        vatReturn = {
          ...this.calculateStandardVAT(periodTransactions),
          period: {
            start: DateUtil.formatForDisplay(startDate),
            end: DateUtil.formatForDisplay(endDate)
          },
          transactionCount: periodTransactions.length
        };
      }

      // Add period summary
      vatReturn.summary = this.generateVATReturnSummary(vatReturn, periodTransactions);
      
      return vatReturn;
    } catch (error) {
      logger.logError('VAT return period calculation failed', { error: error.message });
      throw new AppError('VAT return calculation failed', 400, 'VAT_RETURN_ERROR');
    }
  }

  /**
   * Validate VAT reporting period
   * @param {Date} startDate - Period start
   * @param {Date} endDate - Period end
   * @returns {boolean} True if valid
   */
  validateVATReportingPeriod(startDate, endDate) {
    const start = DateUtil.toUKDate(startDate);
    const end = DateUtil.toUKDate(endDate);
    
    if (!start || !end) {
      throw new ValidationError('Invalid period dates');
    }
    
    if (start >= end) {
      throw new ValidationError('Start date must be before end date');
    }
    
    const periodDays = DateUtil.getDuration(start, end).totalDays;
    if (periodDays > 366) { // Allow for leap years
      throw new ValidationError('VAT period cannot exceed 1 year');
    }
    
    return true;
  }

  // =====================================================
  // SPECIAL CASES & EDGE CASES
  // =====================================================

  /**
   * Handle cash accounting scheme VAT calculations
   * @param {Array} transactions - All transactions
   * @param {Date} periodEnd - Period end date
   * @returns {Object} Cash accounting VAT calculation
   */
  handleCashAccountingScheme(transactions, periodEnd) {
    // Only include transactions where payment has been received/made
    const cashTransactions = transactions.filter(transaction => {
      return transaction.paymentDate && 
             DateUtil.toUKDate(transaction.paymentDate) <= DateUtil.toUKDate(periodEnd);
    });

    const vatReturn = this.calculateStandardVAT(cashTransactions);
    
    return {
      ...vatReturn,
      scheme: 'cash_accounting',
      note: 'VAT calculated on cash basis - only paid/received amounts included',
      eligibleTransactions: cashTransactions.length,
      totalTransactions: transactions.length
    };
  }

  /**
   * Calculate partial exemption for mixed businesses
   * @param {Array} transactions - All transactions
   * @returns {Object} Partial exemption calculation
   */
  calculatePartialExemption(transactions) {
    const exemptSales = transactions
      .filter(t => t.transactionType === 'income' && this.isExemptTransaction(t))
      .reduce((sum, t) => sum + (t.netAmount || 0), 0);
    
    const totalSales = this.calculateTotalSales(transactions);
    const exemptPercentage = totalSales > 0 ? (exemptSales / totalSales) * 100 : 0;
    
    // De minimis test: if exempt input tax is less than £625/month and less than 50% of total input tax
    const monthlyDeMinimisLimit = 625;
    const exemptInputTax = this.calculateExemptInputTax(transactions);
    const totalInputTax = this.calculateVATReclaimed(transactions.filter(t => t.transactionType === 'expense'));
    
    const isDeMinimis = exemptInputTax < monthlyDeMinimisLimit && 
                       (exemptInputTax / Math.max(totalInputTax, 1)) < 0.5;

    return {
      exemptSales: this.roundVAT(exemptSales),
      totalSales: this.roundVAT(totalSales),
      exemptPercentage: this.roundVAT(exemptPercentage),
      exemptInputTax: this.roundVAT(exemptInputTax),
      totalInputTax: this.roundVAT(totalInputTax),
      isDeMinimis,
      recoverableInputTax: isDeMinimis ? totalInputTax : this.roundVAT(totalInputTax - exemptInputTax),
      partialExemptionMethod: isDeMinimis ? 'de_minimis' : 'standard_method'
    };
  }

  /**
   * Handle bad debt relief VAT recovery
   * @param {Object} transaction - Original transaction
   * @param {Date} writeOffDate - Date debt was written off
   * @returns {Object} Bad debt relief calculation
   */
  handleBadDebtRelief(transaction, writeOffDate) {
    const sixMonthsAgo = DateUtil.addDays(DateUtil.nowInUK(), -180);
    const transactionDate = DateUtil.toUKDate(transaction.transactionDate);
    
    // Debt must be over 6 months old and written off
    const isEligible = transactionDate <= sixMonthsAgo && 
                      DateUtil.toUKDate(writeOffDate) >= sixMonthsAgo;

    if (!isEligible) {
      return {
        isEligible: false,
        reason: 'Debt must be over 6 months old from transaction date',
        transaction,
        writeOffDate: DateUtil.formatForDisplay(writeOffDate)
      };
    }

    const vatRelief = transaction.vatAmount || 0;
    
    return {
      isEligible: true,
      originalTransaction: transaction,
      writeOffDate: DateUtil.formatForDisplay(writeOffDate),
      vatRelief: this.roundVAT(vatRelief),
      reliefEntry: {
        description: `Bad debt relief: ${transaction.description}`,
        netAmount: -(transaction.netAmount || 0),
        vatAmount: -vatRelief,
        grossAmount: -(transaction.grossAmount || 0),
        transactionType: 'bad_debt_relief',
        originalTransactionId: transaction.id
      }
    };
  }

  // =====================================================
  // VALIDATION & UTILITIES
  // =====================================================

  /**
   * Validate VAT number format
   * @param {string} vatNumber - VAT number to validate
   * @returns {Object} Validation result
   */
  validateVATNumber(vatNumber) {
    if (!vatNumber) {
      return { isValid: false, error: 'VAT number is required' };
    }

    // UK VAT number format: GB123456789 or GB123456789000
    const ukVATPattern = /^GB(\d{9}|\d{12})$/;
    const cleanVAT = vatNumber.replace(/\s/g, '').toUpperCase();
    
    if (!ukVATPattern.test(cleanVAT)) {
      return {
        isValid: false,
        error: 'Invalid UK VAT number format. Must be GB followed by 9 or 12 digits'
      };
    }

    return {
      isValid: true,
      formatted: cleanVAT,
      type: cleanVAT.length === 11 ? 'standard' : 'group_registration'
    };
  }

  /**
   * Validate amount for VAT calculations
   * @param {number} amount - Amount to validate
   */
  validateAmount(amount) {
    if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
      throw new ValidationError('Amount must be a positive number');
    }
    if (amount > 999999999.99) {
      throw new ValidationError('Amount exceeds maximum allowed value');
    }
  }

  /**
   * Validate VAT rate
   * @param {number} vatRate - VAT rate to validate
   */
  validateVATRate(vatRate) {
    const validRates = [0, 5, 20];
    if (!validRates.includes(vatRate)) {
      throw new ValidationError(`Invalid VAT rate: ${vatRate}%. Valid rates are: ${validRates.join(', ')}%`);
    }
  }

  /**
   * Check if VAT rate is valid
   * @param {number} vatRate - VAT rate to check
   * @returns {boolean} True if valid
   */
  isValidVATRate(vatRate) {
    return [0, 5, 20].includes(vatRate);
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Check if item is zero-rated
   * @param {string} description - Item description
   * @param {string} category - Item category
   * @returns {boolean} True if zero-rated
   */
  isZeroRatedItem(description, category) {
    const zeroRatedKeywords = [
      'food', 'bread', 'milk', 'meat', 'fish', 'fruit', 'vegetable',
      'book', 'newspaper', 'magazine', 'journal',
      'children clothes', 'baby clothes',
      'prescription', 'medicine',
      'public transport', 'bus', 'train', 'tube'
    ];
    
    return zeroRatedKeywords.some(keyword => 
      description.includes(keyword) || category.includes(keyword)
    );
  }

  /**
   * Check if item has reduced VAT rate
   * @param {string} description - Item description
   * @param {string} category - Item category
   * @returns {boolean} True if reduced rate
   */
  isReducedRateItem(description, category) {
    const reducedRateKeywords = [
      'energy', 'gas', 'electricity', 'heating',
      'children car seat', 'child safety',
      'mobility aid', 'wheelchair'
    ];
    
    return reducedRateKeywords.some(keyword => 
      description.includes(keyword) || category.includes(keyword)
    );
  }

  /**
   * Check if item is VAT exempt
   * @param {string} description - Item description
   * @param {string} category - Item category
   * @returns {boolean} True if exempt
   */
  isExemptItem(description, category) {
    return this.exemptCategories.some(exemptCat => 
      description.includes(exemptCat) || category.includes(exemptCat)
    );
  }

  /**
   * Check if transaction is exempt
   * @param {Object} transaction - Transaction object
   * @returns {boolean} True if exempt
   */
  isExemptTransaction(transaction) {
    return transaction.vatRate === null || 
           this.isExemptItem(transaction.description.toLowerCase(), transaction.category.toLowerCase());
  }

  /**
   * Filter transactions by period
   * @param {Array} transactions - All transactions
   * @param {Date} startDate - Period start
   * @param {Date} endDate - Period end
   * @returns {Array} Filtered transactions
   */
  filterTransactionsByPeriod(transactions, startDate, endDate) {
    const start = DateUtil.toUKDate(startDate);
    const end = DateUtil.toUKDate(endDate);
    
    return transactions.filter(transaction => {
      const transDate = DateUtil.toUKDate(transaction.transactionDate);
      return transDate >= start && transDate <= end;
    });
  }

  /**
   * Calculate VAT cost for specific scheme
   * @param {string} scheme - VAT scheme
   * @param {Array} transactions - Transactions
   * @param {string} businessSector - Business sector
   * @returns {Object} Scheme cost calculation
   */
  calculateSchemeVATCost(scheme, transactions, businessSector) {
    if (scheme === 'flat_rate') {
      const turnover = this.calculateTotalSales(transactions);
      const flatRate = this.calculateFlatRateVAT(turnover, businessSector);
      return {
        annualVAT: flatRate.vatDue,
        scheme: 'flat_rate',
        inputVATRecovery: 0
      };
    } else {
      const standardVAT = this.calculateStandardVAT(transactions);
      return {
        annualVAT: standardVAT.netVATDue,
        scheme: 'standard',
        inputVATRecovery: standardVAT.vatReclaimed
      };
    }
  }

  /**
   * Calculate exempt input tax for partial exemption
   * @param {Array} transactions - All transactions
   * @returns {number} Exempt input tax amount
   */
  calculateExemptInputTax(transactions) {
    return transactions
      .filter(t => t.transactionType === 'expense' && this.isExemptTransaction(t))
      .reduce((sum, t) => sum + (t.vatAmount || 0), 0);
  }

  /**
   * Get threshold warnings
   * @param {number} turnover - Current turnover
   * @param {number} distanceToRegistration - Distance to registration threshold
   * @returns {Array} Warning messages
   */
  getThresholdWarnings(turnover, distanceToRegistration) {
    const warnings = [];
    
    if (distanceToRegistration <= 5000 && distanceToRegistration > 0) {
      warnings.push('Approaching VAT registration threshold - monitor monthly turnover');
    }
    
    if (turnover >= this.vatThresholds.registration) {
      warnings.push('VAT registration required - must register within 30 days');
    }
    
    return warnings;
  }

  /**
   * Generate VAT return summary
   * @param {Object} vatReturn - VAT return calculation
   * @param {Array} transactions - Period transactions
   * @returns {Object} Summary information
   */
  generateVATReturnSummary(vatReturn, transactions) {
    const salesCount = transactions.filter(t => t.transactionType === 'income').length;
    const purchaseCount = transactions.filter(t => t.transactionType === 'expense').length;
    
    return {
      totalTransactions: transactions.length,
      salesTransactions: salesCount,
      purchaseTransactions: purchaseCount,
      averageVATRate: this.calculateAverageVATRate(transactions),
      scheme: vatReturn.scheme,
      period: vatReturn.period
    };
  }

  /**
   * Calculate average VAT rate across transactions
   * @param {Array} transactions - Transactions
   * @returns {number} Average VAT rate
   */
  calculateAverageVATRate(transactions) {
    const vatTransactions = transactions.filter(t => t.vatRate !== null && t.vatRate !== undefined);
    if (vatTransactions.length === 0) return 0;
    
    const totalVATRate = vatTransactions.reduce((sum, t) => sum + t.vatRate, 0);
    return this.roundVAT(totalVATRate / vatTransactions.length);
  }

  /**
   * Get scheme change considerations
   * @param {string} currentScheme - Current scheme
   * @param {string} proposedScheme - Proposed scheme
   * @returns {Array} Considerations
   */
  getSchemeChangeConsiderations(currentScheme, proposedScheme) {
    const considerations = [];
    
    if (proposedScheme === 'flat_rate') {
      considerations.push('Limited input VAT recovery on capital expenditure over £2,000');
      considerations.push('Cannot recover VAT on most business purchases');
      considerations.push('Simpler record keeping and VAT return preparation');
    }
    
    if (currentScheme === 'flat_rate' && proposedScheme === 'standard') {
      considerations.push('More complex record keeping required');
      considerations.push('Can recover input VAT on all eligible business purchases');
      considerations.push('Must maintain detailed VAT records');
    }
    
    return considerations;
  }

  /**
   * Calculate break-even point for scheme change
   * @param {Object} currentCost - Current scheme cost
   * @param {Object} proposedCost - Proposed scheme cost
   * @returns {Object} Break-even analysis
   */
  calculateBreakEvenPoint(currentCost, proposedCost) {
    const costDifference = proposedCost.annualVAT - currentCost.annualVAT;
    
    if (costDifference <= 0) {
      return {
        isImmediate: true,
        message: 'Immediate savings from scheme change'
      };
    }
    
    // Simple break-even calculation based on setup costs
    const setupCosts = 500; // Estimated administrative costs
    const monthsToBreakEven = Math.ceil(setupCosts / Math.max(Math.abs(costDifference) / 12, 1));
    
    return {
      isImmediate: false,
      monthsToBreakEven,
      setupCosts,
      message: `Break-even after ${monthsToBreakEven} months`
    };
  }
}

module.exports = VATCalculatorService;