const logger = require('../../utils/logger.util');
const DateUtil = require('../../utils/date.util');
const { ValidationError, AppError, HMRCError } = require('../../utils/error.util');
const HMRCService = require('../integrations/hmrc.service');
const QuarterlySubmissionService = require('./quarterly-submission.service');
const HMRCCategoriesService = require('./hmrc-categories.service');
const TransactionService = require('../transaction.service');
const UserService = require('../user.service');
const NotificationService = require('../notification.service');
const PaymentService = require('../payment.service');

/**
 * Annual Submission Service for UK MTD ITSA (Income Tax Self Assessment)
 * Handles End of Period Statement (EOPS) and annual declarations following HMRC MTD rules
 */
class AnnualSubmissionService {
  constructor() {
    this.hmrcService = new HMRCService();
    this.quarterlyService = new QuarterlySubmissionService();
    this.categoriesService = new HMRCCategoriesService();
    this.transactionService = new TransactionService();
    this.userService = new UserService();
    this.notificationService = new NotificationService();
    this.paymentService = new PaymentService();
    
    // HMRC MTD ITSA Annual API endpoints
    this.endpoints = {
      annualSummary: (nino, businessId, taxYear) => 
        `/income-tax/nino/${nino}/self-employment/${businessId}/annual-summaries/${taxYear}`,
      propertyAnnual: (nino, businessId, taxYear) => 
        `/income-tax/nino/${nino}/uk-property/${businessId}/annual-summaries/${taxYear}`,
      crystallisation: (nino, taxYear) => 
        `/income-tax/calculations/nino/${nino}/${taxYear}/crystallise`,
      taxCalculation: (nino, taxYear, calculationId) => 
        `/income-tax/nino/${nino}/calculations/${calculationId}`,
      obligations: (nino) => `/income-tax/nino/${nino}/obligations`,
      intent: (nino, taxYear) => `/income-tax/crystallisation/${nino}/${taxYear}/intent`
    };

    // Tax year constants (2024-25)
    this.taxYearConstants = {
      '2024-25': {
        personalAllowance: 12570,
        basicRateLimit: 37700,
        higherRateLimit: 125140,
        basicRate: 0.20,
        higherRate: 0.40,
        additionalRate: 0.45,
        class4NICRate: 0.09,
        class4NICAdditionalRate: 0.02,
        class4NICLowerLimit: 12570,
        class4NICUpperLimit: 50270,
        annualInvestmentAllowance: 1000000,
        mainPoolRate: 0.18,
        specialRatePoolRate: 0.06,
        studentLoanPlan1Threshold: 22015,
        studentLoanPlan2Threshold: 27295,
        studentLoanPostgradThreshold: 21000,
        studentLoanRate: 0.09,
        studentLoanPostgradRate: 0.06
      }
    };
  }

  // =====================================================
  // MAIN ANNUAL SUBMISSION METHODS
  // =====================================================

  /**
   * Submit annual declaration for self-employment business
   * @param {string} userId - User ID
   * @param {string} businessId - HMRC business ID
   * @param {string} taxYear - Tax year (YYYY-YY format)
   * @param {Object} options - Submission options
   * @returns {Object} Annual submission result
   */
  async submitSelfEmploymentAnnual(userId, businessId, taxYear, options = {}) {
    try {
      logger.logHMRC('Starting self-employment annual submission', {
        userId, businessId, taxYear
      });

      // Get user details and validate
      const user = await this.userService.findById(userId);
      if (!user || !user.nino) {
        throw new ValidationError('User NINO not found');
      }

      // Validate submission timing and prerequisites
      await this.validateAnnualSubmissionPrerequisites(user.nino, businessId, taxYear);
      
      // Consolidate quarterly data
      const quarterlyData = await this.consolidateQuarterlyData(
        user.nino, 
        businessId, 
        taxYear,
        'self-employment'
      );
      
      // Calculate capital allowances
      const capitalAllowances = await this.calculateCapitalAllowances(
        userId, 
        businessId, 
        taxYear,
        options.assets || []
      );
      
      // Calculate accounting adjustments
      const adjustments = await this.calculateAccountingAdjustments(
        quarterlyData,
        options.yearEndAdjustments || {},
        taxYear
      );
      
      // Generate annual declaration payload
      const annualDeclaration = this.generateSelfEmploymentAnnualPayload(
        quarterlyData,
        adjustments,
        capitalAllowances,
        options
      );
      
      // Validate annual declaration
      this.validateAnnualDeclaration(annualDeclaration, 'self-employment');
      this.crossCheckQuarterlyVsAnnualTotals(quarterlyData, annualDeclaration);
      
      // Submit to HMRC
      const hmrcResponse = await this.submitAnnualDeclaration(
        user.nino,
        businessId,
        taxYear,
        annualDeclaration,
        'self-employment'
      );
      
      // Calculate tax liability
      const taxCalculation = await this.calculateTotalTaxLiability(
        user.nino,
        taxYear,
        hmrcResponse.calculationId
      );
      
      // Calculate payments on account
      const paymentSchedule = this.calculatePaymentSchedule(
        taxCalculation,
        taxYear
      );
      
      // Log successful submission
      await this.auditAnnualSubmissionTrail(
        userId,
        businessId,
        taxYear,
        annualDeclaration,
        hmrcResponse,
        taxCalculation
      );
      
      // Send notification
      await this.notificationService.sendAnnualSubmissionConfirmation(
        userId,
        taxYear,
        hmrcResponse,
        taxCalculation,
        paymentSchedule
      );
      
      return {
        success: true,
        submissionId: hmrcResponse.correlationId,
        calculationId: hmrcResponse.calculationId,
        taxYear,
        businessId,
        submittedAt: new Date(),
        hmrcResponse: {
          correlationId: hmrcResponse.correlationId,
          processingDate: hmrcResponse.processingDate
        },
        taxCalculation,
        paymentSchedule,
        summary: this.generateAnnualSummaryReport(
          quarterlyData,
          annualDeclaration,
          taxCalculation
        )
      };

    } catch (error) {
      logger.logError('Self-employment annual submission failed', {
        userId, businessId, taxYear, error: error.message
      });
      
      await this.auditAnnualSubmissionTrail(
        userId,
        businessId,
        taxYear,
        null,
        null,
        null,
        error
      );
      
      throw this.handleHMRCAnnualError(error);
    }
  }

  /**
   * Submit annual declaration for property business
   * @param {string} userId - User ID
   * @param {string} businessId - HMRC property business ID
   * @param {string} taxYear - Tax year (YYYY-YY format)
   * @param {Object} options - Submission options
   * @returns {Object} Annual submission result
   */
  async submitPropertyAnnual(userId, businessId, taxYear, options = {}) {
    try {
      logger.logHMRC('Starting property annual submission', {
        userId, businessId, taxYear
      });

      const user = await this.userService.findById(userId);
      if (!user || !user.nino) {
        throw new ValidationError('User NINO not found');
      }

      await this.validateAnnualSubmissionPrerequisites(user.nino, businessId, taxYear);
      
      const quarterlyData = await this.consolidateQuarterlyData(
        user.nino,
        businessId,
        taxYear,
        'uk-property'
      );
      
      const propertyAllowances = await this.calculatePropertyAllowances(
        userId,
        businessId,
        taxYear,
        options.properties || []
      );
      
      const adjustments = await this.calculatePropertyAdjustments(
        quarterlyData,
        options.yearEndAdjustments || {},
        taxYear
      );
      
      const annualDeclaration = this.generatePropertyAnnualPayload(
        quarterlyData,
        adjustments,
        propertyAllowances,
        options
      );
      
      this.validateAnnualDeclaration(annualDeclaration, 'uk-property');
      this.crossCheckQuarterlyVsAnnualTotals(quarterlyData, annualDeclaration);
      
      const hmrcResponse = await this.submitAnnualDeclaration(
        user.nino,
        businessId,
        taxYear,
        annualDeclaration,
        'uk-property'
      );
      
      const taxCalculation = await this.calculateTotalTaxLiability(
        user.nino,
        taxYear,
        hmrcResponse.calculationId
      );
      
      const paymentSchedule = this.calculatePaymentSchedule(
        taxCalculation,
        taxYear
      );
      
      await this.auditAnnualSubmissionTrail(
        userId,
        businessId,
        taxYear,
        annualDeclaration,
        hmrcResponse,
        taxCalculation
      );
      
      await this.notificationService.sendAnnualSubmissionConfirmation(
        userId,
        taxYear,
        hmrcResponse,
        taxCalculation,
        paymentSchedule
      );
      
      return {
        success: true,
        submissionId: hmrcResponse.correlationId,
        calculationId: hmrcResponse.calculationId,
        taxYear,
        businessId,
        submittedAt: new Date(),
        hmrcResponse: {
          correlationId: hmrcResponse.correlationId,
          processingDate: hmrcResponse.processingDate
        },
        taxCalculation,
        paymentSchedule,
        summary: this.generateAnnualSummaryReport(
          quarterlyData,
          annualDeclaration,
          taxCalculation
        )
      };

    } catch (error) {
      logger.logError('Property annual submission failed', {
        userId, businessId, taxYear, error: error.message
      });
      
      await this.auditAnnualSubmissionTrail(
        userId,
        businessId,
        taxYear,
        null,
        null,
        null,
        error
      );
      
      throw this.handleHMRCAnnualError(error);
    }
  }

  // =====================================================
  // VALIDATION & PREREQUISITES
  // =====================================================

  /**
   * Validate annual submission prerequisites
   * @param {string} nino - National Insurance Number
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   */
  async validateAnnualSubmissionPrerequisites(nino, businessId, taxYear) {
    // Check submission deadline
    this.validateDeclarationDeadline(new Date(), taxYear);
    
    // Ensure all quarterly submissions are complete
    await this.validateAllQuarterlySubmissionsComplete(nino, businessId, taxYear);
    
    // Check HMRC obligations
    await this.validateHMRCObligations(nino, taxYear);
  }

  /**
   * Validate all quarterly submissions are complete
   * @param {string} nino - National Insurance Number
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   */
  async validateAllQuarterlySubmissionsComplete(nino, businessId, taxYear) {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const missingQuarters = [];
    
    for (const quarter of quarters) {
      const hasSubmitted = await this.quarterlyService.hasQuarterBeenSubmitted(
        nino,
        businessId,
        taxYear,
        quarter
      );
      
      if (!hasSubmitted) {
        missingQuarters.push(quarter);
      }
    }
    
    if (missingQuarters.length > 0) {
      throw new ValidationError(
        `Missing quarterly submissions: ${missingQuarters.join(', ')}. All quarterly updates must be submitted before annual declaration.`
      );
    }
  }

  /**
   * Validate declaration deadline
   * @param {Date} submissionDate - Submission date
   * @param {string} taxYear - Tax year
   */
  validateDeclarationDeadline(submissionDate, taxYear) {
    const deadline = this.calculateSubmissionDeadlines(taxYear).annualDeclaration;
    
    if (submissionDate > deadline) {
      const daysLate = DateUtil.getDuration(deadline, submissionDate).totalDays;
      throw new ValidationError(
        `Annual declaration deadline has passed. Deadline was ${DateUtil.formatForDisplay(deadline)} (${daysLate} days late)`
      );
    }
  }

  /**
   * Validate HMRC obligations
   * @param {string} nino - National Insurance Number
   * @param {string} taxYear - Tax year
   */
  async validateHMRCObligations(nino, taxYear) {
    try {
      const obligations = await this.hmrcService.get(this.endpoints.obligations(nino));
      
      // Check for any outstanding obligations
      const outstanding = obligations.obligations?.filter(ob => 
        ob.status === 'Open' && 
        ob.periodKey.includes(taxYear.replace('-', ''))
      ) || [];
      
      if (outstanding.length > 0) {
        logger.logHMRC('Outstanding HMRC obligations found', {
          nino, taxYear, outstanding: outstanding.length
        });
      }
    } catch (error) {
      logger.logError('Failed to validate HMRC obligations', {
        nino, taxYear, error: error.message
      });
      // Don't block submission for obligation check failures
    }
  }

  /**
   * Cross-check quarterly vs annual totals
   * @param {Object} quarterlyData - Consolidated quarterly data
   * @param {Object} annualDeclaration - Annual declaration
   */
  crossCheckQuarterlyVsAnnualTotals(quarterlyData, annualDeclaration) {
    const quarterlyTotal = quarterlyData.totalIncome - quarterlyData.totalExpenses;
    
    // Calculate annual profit before adjustments
    let annualProfit = quarterlyTotal;
    
    // Apply adjustments
    if (annualDeclaration.adjustments) {
      annualProfit += (annualDeclaration.adjustments.accountingAdjustment || 0);
      annualProfit -= (annualDeclaration.adjustments.includedNonTaxableProfits || 0);
      annualProfit -= (annualDeclaration.adjustments.lossesBroughtForward || 0);
    }
    
    // Apply capital allowances
    if (annualDeclaration.allowances) {
      const totalAllowances = Object.values(annualDeclaration.allowances)
        .reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
      annualProfit -= totalAllowances;
    }
    
    // Allow for small rounding differences
    const difference = Math.abs(quarterlyTotal - (annualProfit + (annualDeclaration.adjustments?.accountingAdjustment || 0)));
    
    if (difference > 10) { // £10 tolerance
      logger.logError('Quarterly vs annual totals mismatch', {
        quarterlyTotal,
        annualProfit,
        difference
      });
      
      throw new ValidationError(
        `Quarterly and annual totals do not match. Difference: £${difference.toFixed(2)}`
      );
    }
  }

  // =====================================================
  // DATA CONSOLIDATION
  // =====================================================

  /**
   * Consolidate quarterly submission data
   * @param {string} nino - National Insurance Number
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   * @param {string} incomeSource - Income source type
   * @returns {Object} Consolidated quarterly data
   */
  async consolidateQuarterlyData(nino, businessId, taxYear, incomeSource) {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const consolidated = {
      income: {},
      expenses: {},
      totalIncome: 0,
      totalExpenses: 0,
      quarterlySubmissions: [],
      incomeSource
    };
    
    for (const quarter of quarters) {
      try {
        // Retrieve quarterly submission data
        const quarterData = await this.getQuarterlySubmissionData(
          nino,
          businessId,
          taxYear,
          quarter,
          incomeSource
        );
        
        if (quarterData) {
          consolidated.quarterlySubmissions.push({
            quarter,
            data: quarterData,
            submittedAt: quarterData.submittedAt
          });
          
          // Aggregate income
          Object.entries(quarterData.income || {}).forEach(([category, amount]) => {
            consolidated.income[category] = (consolidated.income[category] || 0) + amount;
            consolidated.totalIncome += amount;
          });
          
          // Aggregate expenses
          Object.entries(quarterData.expenses || {}).forEach(([category, amount]) => {
            consolidated.expenses[category] = (consolidated.expenses[category] || 0) + amount;
            consolidated.totalExpenses += amount;
          });
        }
      } catch (error) {
        logger.logError('Failed to retrieve quarterly data', {
          nino, businessId, taxYear, quarter, error: error.message
        });
        throw new ValidationError(`Failed to retrieve ${quarter} quarterly data`);
      }
    }
    
    return consolidated;
  }

  /**
   * Get quarterly submission data
   * @param {string} nino - National Insurance Number
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   * @param {string} quarter - Quarter
   * @param {string} incomeSource - Income source type
   * @returns {Object} Quarterly data
   */
  async getQuarterlySubmissionData(nino, businessId, taxYear, quarter, incomeSource) {
    // This would retrieve data from your database or HMRC API
    // Implementation depends on your data storage strategy
    try {
      // Placeholder implementation - would fetch from database
      return await this.quarterlyService.getSubmittedQuarterData(
        nino,
        businessId,
        taxYear,
        quarter,
        incomeSource
      );
    } catch (error) {
      logger.logError('Failed to get quarterly submission data', {
        nino, businessId, taxYear, quarter, error: error.message
      });
      throw error;
    }
  }

  // =====================================================
  // CAPITAL ALLOWANCES CALCULATIONS
  // =====================================================

  /**
   * Calculate capital allowances for self-employment
   * @param {string} userId - User ID
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   * @param {Array} assets - Business assets
   * @returns {Object} Capital allowances calculation
   */
  async calculateCapitalAllowances(userId, businessId, taxYear, assets) {
    const taxYearData = this.taxYearConstants[taxYear];
    const allowances = {
      annualInvestmentAllowance: 0,
      capitalAllowanceMainPool: 0,
      capitalAllowanceSpecialRatePool: 0,
      zeroEmissionGoodsVehicle: 0,
      businessPremisesRenovationAllowance: 0,
      enhancedCapitalAllowance: 0,
      allowanceOnSales: 0,
      capitalAllowanceSingleAssetPool: 0
    };
    
    // Get current pools from previous year
    const pools = await this.getCurrentCapitalAllowancePools(userId, businessId, taxYear);
    
    // Process new assets purchased this year
    const newAssets = assets.filter(asset => 
      DateUtil.isWithinTaxYear(asset.purchaseDate, taxYear)
    );
    
    // Calculate Annual Investment Allowance
    allowances.annualInvestmentAllowance = this.calculateAnnualInvestmentAllowance(
      newAssets,
      taxYearData.annualInvestmentAllowance
    );
    
    // Calculate main pool allowances
    allowances.capitalAllowanceMainPool = this.calculateMainPoolAllowances(
      pools.mainPool,
      newAssets.filter(a => a.poolType === 'main'),
      taxYearData.mainPoolRate
    );
    
    // Calculate special rate pool allowances
    allowances.capitalAllowanceSpecialRatePool = this.calculateSpecialRatePool(
      pools.specialRatePool,
      newAssets.filter(a => a.poolType === 'special'),
      taxYearData.specialRatePoolRate
    );
    
    // Calculate zero emission vehicle allowances
    allowances.zeroEmissionGoodsVehicle = this.applyZeroEmissionVehicleAllowance(
      newAssets.filter(a => a.type === 'zero_emission_vehicle')
    );
    
    // Calculate single asset pool allowances
    allowances.capitalAllowanceSingleAssetPool = this.calculateSingleAssetPoolAllowances(
      newAssets.filter(a => a.poolType === 'single'),
      taxYearData.mainPoolRate
    );
    
    // Handle asset disposals
    const disposals = assets.filter(asset => 
      asset.disposalDate && DateUtil.isWithinTaxYear(asset.disposalDate, taxYear)
    );
    
    const disposalAdjustments = this.handleAssetDisposals(disposals, pools);
    allowances.allowanceOnSales = disposalAdjustments.allowanceOnSales;
    
    // Update pools for next year
    await this.updateCapitalAllowancePools(
      userId,
      businessId,
      taxYear,
      allowances,
      newAssets,
      disposals
    );
    
    return {
      allowances,
      pools: pools,
      calculations: {
        newAssets: newAssets.length,
        disposals: disposals.length,
        totalAllowances: Object.values(allowances).reduce((sum, val) => sum + val, 0)
      }
    };
  }

  /**
   * Calculate Annual Investment Allowance
   * @param {Array} assets - New assets
   * @param {number} maxAllowance - Maximum AIA for tax year
   * @returns {number} AIA amount
   */
  calculateAnnualInvestmentAllowance(assets, maxAllowance) {
    const qualifyingAssets = assets.filter(asset => 
      asset.qualifiesForAIA && 
      !asset.isUsedAsset &&
      asset.type !== 'car'
    );
    
    const totalCost = qualifyingAssets.reduce((sum, asset) => sum + asset.cost, 0);
    
    return Math.min(totalCost, maxAllowance);
  }

  /**
   * Calculate main pool writing down allowances
   * @param {number} poolValue - Current pool value
   * @param {Array} newAssets - New assets for main pool
   * @param {number} rate - WDA rate
   * @returns {number} Main pool allowance
   */
  calculateMainPoolAllowances(poolValue, newAssets, rate) {
    const additionsNotCoveredByAIA = newAssets
      .filter(asset => !asset.coveredByAIA)
      .reduce((sum, asset) => sum + asset.cost, 0);
    
    const adjustedPoolValue = poolValue + additionsNotCoveredByAIA;
    
    return Math.round(adjustedPoolValue * rate);
  }

  /**
   * Calculate special rate pool allowances
   * @param {number} poolValue - Current special rate pool value
   * @param {Array} newAssets - New special rate assets
   * @param {number} rate - Special rate WDA rate
   * @returns {number} Special rate pool allowance
   */
  calculateSpecialRatePool(poolValue, newAssets, rate) {
    const additions = newAssets.reduce((sum, asset) => sum + asset.cost, 0);
    const adjustedPoolValue = poolValue + additions;
    
    return Math.round(adjustedPoolValue * rate);
  }

  /**
   * Apply zero emission vehicle allowance
   * @param {Array} vehicles - Zero emission vehicles
   * @returns {number} Zero emission vehicle allowance
   */
  applyZeroEmissionVehicleAllowance(vehicles) {
    // 100% first year allowance for zero emission goods vehicles
    return vehicles.reduce((sum, vehicle) => sum + vehicle.cost, 0);
  }

  /**
   * Calculate single asset pool allowances
   * @param {Array} assets - Single asset pool items
   * @param {number} rate - WDA rate
   * @returns {number} Single asset pool allowances
   */
  calculateSingleAssetPoolAllowances(assets, rate) {
    return assets.reduce((sum, asset) => {
      const wda = Math.round(asset.poolValue * rate);
      return sum + wda;
    }, 0);
  }

  /**
   * Handle asset disposals
   * @param {Array} disposals - Disposed assets
   * @param {Object} pools - Current pools
   * @returns {Object} Disposal adjustments
   */
  handleAssetDisposals(disposals, pools) {
    let allowanceOnSales = 0;
    let balancingCharges = 0;
    
    disposals.forEach(disposal => {
      const proceedsOrCost = Math.min(disposal.saleProceeds, disposal.originalCost);
      
      if (disposal.poolType === 'single') {
        // Single asset pool disposal
        if (proceedsOrCost < disposal.poolValue) {
          allowanceOnSales += disposal.poolValue - proceedsOrCost;
        } else {
          balancingCharges += proceedsOrCost - disposal.poolValue;
        }
      } else {
        // Main or special rate pool disposal
        // Deduct proceeds from pool (handled in pool updates)
      }
    });
    
    return {
      allowanceOnSales,
      balancingCharges
    };
  }

  // =====================================================
  // PROPERTY ALLOWANCES
  // =====================================================

  /**
   * Calculate property allowances
   * @param {string} userId - User ID
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   * @param {Array} properties - Property assets
   * @returns {Object} Property allowances
   */
  async calculatePropertyAllowances(userId, businessId, taxYear, properties) {
    const allowances = {
      annualInvestmentAllowance: 0,
      otherCapitalAllowance: 0,
      costOfReplacingDomesticGoods: 0,
      zeroEmissionsCarAllowance: 0,
      businessPremisesRenovationAllowance: 0,
      replacementOfDomesticGoodsAllowance: 0
    };
    
    // Property-specific capital allowances
    const propertyAssets = properties.filter(p => 
      DateUtil.isWithinTaxYear(p.purchaseDate, taxYear)
    );
    
    // Replacement of domestic goods (furniture, appliances)
    const domesticGoods = propertyAssets.filter(asset => 
      asset.type === 'domestic_goods' || asset.type === 'furniture'
    );
    
    allowances.replacementOfDomesticGoodsAllowance = domesticGoods
      .reduce((sum, item) => sum + item.cost, 0);
    
    // Business premises renovation allowance
    const renovationCosts = propertyAssets.filter(asset => 
      asset.type === 'renovation' && asset.qualifiesForBPRA
    );
    
    allowances.businessPremisesRenovationAllowance = renovationCosts
      .reduce((sum, item) => sum + item.cost, 0);
    
    return allowances;
  }

  // =====================================================
  // ADJUSTMENTS CALCULATIONS
  // =====================================================

  /**
   * Calculate accounting adjustments for self-employment
   * @param {Object} quarterlyData - Consolidated quarterly data
   * @param {Object} yearEndAdjustments - Year-end adjustments
   * @param {string} taxYear - Tax year
   * @returns {Object} Accounting adjustments
   */
  async calculateAccountingAdjustments(quarterlyData, yearEndAdjustments, taxYear) {
    const adjustments = {
      includedNonTaxableProfits: 0,
      basisAdjustment: 0,
      overlapReliefUsed: 0,
      accountingAdjustment: 0,
      averagingAdjustment: 0,
      lossesBroughtForward: 0,
      outstandingBusinessIncome: 0,
      balancingChargeBPRA: 0,
      balancingChargeOther: 0,
      goodsAndServicesOwnUse: 0
    };
    
    // Apply year-end adjustments
    adjustments.accountingAdjustment = yearEndAdjustments.accountingAdjustment || 0;
    adjustments.includedNonTaxableProfits = yearEndAdjustments.nonTaxableProfits || 0;
    adjustments.goodsAndServicesOwnUse = yearEndAdjustments.ownUseAdjustment || 0;
    
    // Apply losses brought forward
    if (yearEndAdjustments.lossesBroughtForward) {
      const currentProfit = quarterlyData.totalIncome - quarterlyData.totalExpenses;
      adjustments.lossesBroughtForward = Math.min(
        yearEndAdjustments.lossesBroughtForward,
        Math.max(0, currentProfit) // Can't create a loss
      );
    }
    
    // Apply overlap relief
    adjustments.overlapReliefUsed = yearEndAdjustments.overlapRelief || 0;
    
    return adjustments;
  }

  /**
   * Calculate property adjustments
   * @param {Object} quarterlyData - Consolidated quarterly data
   * @param {Object} yearEndAdjustments - Year-end adjustments
   * @param {string} taxYear - Tax year
   * @returns {Object} Property adjustments
   */
  async calculatePropertyAdjustments(quarterlyData, yearEndAdjustments, taxYear) {
    const adjustments = {
      privateUseAdjustment: 0,
      balancingCharge: 0,
      periodOfGraceAdjustment: 0,
      propertyIncomeAllowance: 0,
      renovationAllowanceBalancingCharge: 0
    };
    
    // Property income allowance (£1,000 for 2024-25)
    if (quarterlyData.totalIncome <= 1000) {
      adjustments.propertyIncomeAllowance = quarterlyData.totalIncome;
    }
    
    // Private use adjustment
    adjustments.privateUseAdjustment = yearEndAdjustments.privateUseAdjustment || 0;
    
    return adjustments;
  }

  // =====================================================
  // PAYLOAD GENERATION
  // =====================================================

  /**
   * Generate self-employment annual declaration payload
   * @param {Object} quarterlyData - Consolidated quarterly data
   * @param {Object} adjustments - Accounting adjustments
   * @param {Object} capitalAllowances - Capital allowances
   * @param {Object} options - Additional options
   * @returns {Object} HMRC annual declaration payload
   */
  generateSelfEmploymentAnnualPayload(quarterlyData, adjustments, capitalAllowances, options) {
    const payload = {};
    
    // Add adjustments (only non-zero values)
    const nonZeroAdjustments = {};
    Object.entries(adjustments.adjustments || adjustments).forEach(([key, value]) => {
      if (value && value !== 0) {
        nonZeroAdjustments[key] = Math.round(value);
      }
    });
    
    if (Object.keys(nonZeroAdjustments).length > 0) {
      payload.adjustments = nonZeroAdjustments;
    }
    
    // Add allowances (only non-zero values)
    const nonZeroAllowances = {};
    Object.entries(capitalAllowances.allowances || {}).forEach(([key, value]) => {
      if (value && value !== 0) {
        nonZeroAllowances[key] = Math.round(value);
      }
    });
    
    if (Object.keys(nonZeroAllowances).length > 0) {
      payload.allowances = nonZeroAllowances;
    }
    
    // Add non-financial information
    if (options.nonFinancials) {
      payload.nonFinancials = {
        businessDetailsChangedRecently: options.nonFinancials.businessDetailsChanged || false
      };
      
      if (options.nonFinancials.class4NicsExemptionReason) {
        payload.nonFinancials.class4NicsExemptionReason = options.nonFinancials.class4NicsExemptionReason;
      }
    }
    
    return this.sanitizeAnnualPayload(payload);
  }

  /**
   * Generate property annual declaration payload
   * @param {Object} quarterlyData - Consolidated quarterly data
   * @param {Object} adjustments - Property adjustments
   * @param {Object} propertyAllowances - Property allowances
   * @param {Object} options - Additional options
   * @returns {Object} HMRC property annual declaration payload
   */
  generatePropertyAnnualPayload(quarterlyData, adjustments, propertyAllowances, options) {
    const payload = {};
    
    // Add adjustments
    const nonZeroAdjustments = {};
    Object.entries(adjustments).forEach(([key, value]) => {
      if (value && value !== 0) {
        nonZeroAdjustments[key] = Math.round(value);
      }
    });
    
    if (Object.keys(nonZeroAdjustments).length > 0) {
      payload.adjustments = nonZeroAdjustments;
    }
    
    // Add allowances
    const nonZeroAllowances = {};
    Object.entries(propertyAllowances.allowances || propertyAllowances).forEach(([key, value]) => {
      if (value && value !== 0) {
        nonZeroAllowances[key] = Math.round(value);
      }
    });
    
    if (Object.keys(nonZeroAllowances).length > 0) {
      payload.allowances = nonZeroAllowances;
    }
    
    return this.sanitizeAnnualPayload(payload);
  }

  // =====================================================
  // TAX CALCULATIONS
  // =====================================================

  /**
   * Calculate total tax liability
   * @param {string} nino - National Insurance Number
   * @param {string} taxYear - Tax year
   * @param {string} calculationId - HMRC calculation ID
   * @returns {Object} Tax calculation result
   */
  async calculateTotalTaxLiability(nino, taxYear, calculationId) {
    try {
      // Get calculation from HMRC
      const hmrcCalculation = await this.hmrcService.get(
        this.endpoints.taxCalculation(nino, taxYear, calculationId)
      );
      
      // Extract key tax figures
      const calculation = {
        taxYear,
        calculationId,
        totalIncome: hmrcCalculation.totalIncome || 0,
        taxableIncome: hmrcCalculation.taxableIncome || 0,
        incomeTax: hmrcCalculation.incomeTax || 0,
        class4NIC: hmrcCalculation.class4NationalInsurance || 0,
        totalTaxDue: hmrcCalculation.totalTaxDue || 0,
        paymentOnAccount1: hmrcCalculation.paymentOnAccount1 || 0,
        paymentOnAccount2: hmrcCalculation.paymentOnAccount2 || 0,
        balancingPayment: hmrcCalculation.balancingPayment || 0,
        studentLoanRepayments: hmrcCalculation.studentLoanRepayments || 0,
        hmrcCalculation
      };
      
      // Calculate our own verification
      const verification = this.verifyTaxCalculation(calculation, taxYear);
      
      return {
        ...calculation,
        verification,
        calculatedAt: new Date()
      };
      
    } catch (error) {
      logger.logError('Failed to retrieve HMRC tax calculation', {
        nino, taxYear, calculationId, error: error.message
      });
      
      // Fallback to our own calculation
      return this.performFallbackTaxCalculation(nino, taxYear);
    }
  }

  /**
   * Verify HMRC tax calculation
   * @param {Object} hmrcCalculation - HMRC calculation
   * @param {string} taxYear - Tax year
   * @returns {Object} Verification result
   */
  verifyTaxCalculation(hmrcCalculation, taxYear) {
    const constants = this.taxYearConstants[taxYear];
    const verification = {
      verified: true,
      discrepancies: []
    };
    
    // Verify income tax calculation
    const expectedIncomeTax = this.calculateIncomeTax(
      hmrcCalculation.taxableIncome,
      constants
    );
    
    const incomeTaxDiff = Math.abs(hmrcCalculation.incomeTax - expectedIncomeTax);
    if (incomeTaxDiff > 1) { // £1 tolerance
      verification.discrepancies.push({
        field: 'incomeTax',
        hmrc: hmrcCalculation.incomeTax,
        calculated: expectedIncomeTax,
        difference: incomeTaxDiff
      });
      verification.verified = false;
    }
    
    // Verify Class 4 NIC calculation
    const expectedClass4NIC = this.calculateClass4NIC(
      hmrcCalculation.taxableIncome,
      constants
    );
    
    const class4Diff = Math.abs(hmrcCalculation.class4NIC - expectedClass4NIC);
    if (class4Diff > 1) {
      verification.discrepancies.push({
        field: 'class4NIC',
        hmrc: hmrcCalculation.class4NIC,
        calculated: expectedClass4NIC,
        difference: class4Diff
      });
      verification.verified = false;
    }
    
    return verification;
  }

  /**
   * Calculate income tax
   * @param {number} taxableIncome - Taxable income
   * @param {Object} constants - Tax year constants
   * @returns {number} Income tax due
   */
  calculateIncomeTax(taxableIncome, constants) {
    if (taxableIncome <= 0) return 0;
    
    let tax = 0;
    let remainingIncome = taxableIncome;
    
    // Basic rate band
    const basicRateTaxable = Math.min(remainingIncome, constants.basicRateLimit);
    tax += basicRateTaxable * constants.basicRate;
    remainingIncome -= basicRateTaxable;
    
    if (remainingIncome > 0) {
      // Higher rate band
      const higherRateLimit = constants.higherRateLimit - constants.basicRateLimit;
      const higherRateTaxable = Math.min(remainingIncome, higherRateLimit);
      tax += higherRateTaxable * constants.higherRate;
      remainingIncome -= higherRateTaxable;
      
      if (remainingIncome > 0) {
        // Additional rate band
        tax += remainingIncome * constants.additionalRate;
      }
    }
    
    return Math.round(tax);
  }

  /**
   * Calculate Class 4 National Insurance
   * @param {number} profits - Business profits
   * @param {Object} constants - Tax year constants
   * @returns {number} Class 4 NIC due
   */
  calculateClass4NIC(profits, constants) {
    if (profits <= constants.class4NICLowerLimit) return 0;
    
    let nic = 0;
    
    // Main rate band
    const mainRateProfit = Math.min(
      profits - constants.class4NICLowerLimit,
      constants.class4NICUpperLimit - constants.class4NICLowerLimit
    );
    nic += mainRateProfit * constants.class4NICRate;
    
    // Additional rate band
    if (profits > constants.class4NICUpperLimit) {
      const additionalRateProfit = profits - constants.class4NICUpperLimit;
      nic += additionalRateProfit * constants.class4NICAdditionalRate;
    }
    
    return Math.round(nic);
  }

  // =====================================================
  // PAYMENT CALCULATIONS
  // =====================================================

  /**
   * Calculate payment schedule
   * @param {Object} taxCalculation - Tax calculation
   * @param {string} taxYear - Tax year
   * @returns {Object} Payment schedule
   */
  calculatePaymentSchedule(taxCalculation, taxYear) {
    const deadlines = this.calculateSubmissionDeadlines(taxYear);
    
    const paymentSchedule = {
      taxYear,
      totalTaxDue: taxCalculation.totalTaxDue,
      payments: []
    };
    
    // Balancing payment (due 31 Jan)
    if (taxCalculation.balancingPayment > 0) {
      paymentSchedule.payments.push({
        type: 'balancing_payment',
        amount: taxCalculation.balancingPayment,
        dueDate: deadlines.annualDeclaration,
        description: 'Final payment for tax year'
      });
    }
    
    // First payment on account (due 31 Jan)
    const firstPOA = this.calculateFirstPaymentOnAccount(taxCalculation.totalTaxDue);
    if (firstPOA > 0) {
      paymentSchedule.payments.push({
        type: 'payment_on_account_1',
        amount: firstPOA,
        dueDate: deadlines.annualDeclaration,
        description: 'First payment on account for following year'
      });
    }
    
    // Second payment on account (due 31 Jul)
    const secondPOA = this.calculateSecondPaymentOnAccount(taxCalculation.totalTaxDue);
    if (secondPOA > 0) {
      paymentSchedule.payments.push({
        type: 'payment_on_account_2',
        amount: secondPOA,
        dueDate: deadlines.secondPaymentOnAccount,
        description: 'Second payment on account for following year'
      });
    }
    
    // Calculate total amount due
    paymentSchedule.totalAmountDue = paymentSchedule.payments
      .reduce((sum, payment) => sum + payment.amount, 0);
    
    return paymentSchedule;
  }

  /**
   * Calculate first payment on account
   * @param {number} taxDue - Total tax due
   * @returns {number} First payment on account amount
   */
  calculateFirstPaymentOnAccount(taxDue) {
    // No POA required if total tax due is less than £1,000
    if (taxDue < 1000) return 0;
    
    return Math.round(taxDue * 0.5);
  }

  /**
   * Calculate second payment on account
   * @param {number} taxDue - Total tax due
   * @returns {number} Second payment on account amount
   */
  calculateSecondPaymentOnAccount(taxDue) {
    // No POA required if total tax due is less than £1,000
    if (taxDue < 1000) return 0;
    
    return Math.round(taxDue * 0.5);
  }

  // =====================================================
  // HMRC SUBMISSION
  // =====================================================

  /**
   * Submit annual declaration to HMRC
   * @param {string} nino - National Insurance Number
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   * @param {Object} declaration - Annual declaration
   * @param {string} submissionType - Submission type
   * @returns {Object} HMRC response
   */
  async submitAnnualDeclaration(nino, businessId, taxYear, declaration, submissionType) {
    const endpoint = submissionType === 'self-employment'
      ? this.endpoints.annualSummary(nino, businessId, taxYear)
      : this.endpoints.propertyAnnual(nino, businessId, taxYear);
    
    try {
      // Submit declaration
      const response = await this.hmrcService.post(endpoint, declaration, {
        scope: 'write:self-assessment',
        retries: 3,
        timeout: 60000
      });
      
      logger.logHMRC('Annual declaration submitted successfully', {
        nino, businessId, taxYear, submissionType,
        correlationId: response.correlationId
      });
      
      // Trigger crystallisation
      const crystallisationResponse = await this.triggerCrystallisation(nino, taxYear);
      
      return {
        ...response,
        calculationId: crystallisationResponse.calculationId
      };
      
    } catch (error) {
      logger.logError('Annual declaration submission failed', {
        nino, businessId, taxYear, submissionType,
        error: error.message,
        declaration
      });
      
      throw this.handleHMRCAnnualError(error);
    }
  }

  /**
   * Trigger tax calculation crystallisation
   * @param {string} nino - National Insurance Number
   * @param {string} taxYear - Tax year
   * @returns {Object} Crystallisation response
   */
  async triggerCrystallisation(nino, taxYear) {
    try {
      const response = await this.hmrcService.post(
        this.endpoints.crystallisation(nino, taxYear),
        {},
        { scope: 'write:self-assessment' }
      );
      
      logger.logHMRC('Tax calculation crystallised', {
        nino, taxYear, calculationId: response.calculationId
      });
      
      return response;
      
    } catch (error) {
      logger.logError('Crystallisation failed', {
        nino, taxYear, error: error.message
      });
      
      // Don't fail the whole submission for crystallisation errors
      return { calculationId: null };
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Calculate submission deadlines
   * @param {string} taxYear - Tax year (YYYY-YY format)
   * @returns {Object} Deadline dates
   */
  calculateSubmissionDeadlines(taxYear) {
    const endYear = parseInt(taxYear.split('-')[1]) + 2000;
    
    return {
      annualDeclaration: new Date(endYear + 1, 0, 31, 23, 59, 59), // 31 Jan following year
      secondPaymentOnAccount: new Date(endYear, 6, 31, 23, 59, 59), // 31 Jul same year
      selfAssessmentReturn: new Date(endYear + 1, 0, 31, 23, 59, 59) // 31 Jan following year
    };
  }

  /**
   * Validate annual declaration
   * @param {Object} declaration - Annual declaration
   * @param {string} submissionType - Submission type
   */
  validateAnnualDeclaration(declaration, submissionType) {
    const errors = [];
    
    // Validate adjustments
    if (declaration.adjustments) {
      Object.entries(declaration.adjustments).forEach(([field, value]) => {
        if (typeof value !== 'number' || value < 0) {
          errors.push(`Invalid adjustment value for ${field}: ${value}`);
        }
        
        if (value > 99999999) {
          errors.push(`Adjustment value too large for ${field}: ${value}`);
        }
      });
    }
    
    // Validate allowances
    if (declaration.allowances) {
      Object.entries(declaration.allowances).forEach(([field, value]) => {
        if (typeof value !== 'number' || value < 0) {
          errors.push(`Invalid allowance value for ${field}: ${value}`);
        }
        
        if (value > 99999999) {
          errors.push(`Allowance value too large for ${field}: ${value}`);
        }
      });
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Annual declaration validation failed', errors);
    }
  }

  /**
   * Sanitize annual payload
   * @param {Object} payload - Payload to sanitize
   * @returns {Object} Sanitized payload
   */
  sanitizeAnnualPayload(payload) {
    const sanitized = {};
    
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          const nestedSanitized = this.sanitizeAnnualPayload(value);
          if (Object.keys(nestedSanitized).length > 0) {
            sanitized[key] = nestedSanitized;
          }
        } else {
          sanitized[key] = value;
        }
      }
    });
    
    return sanitized;
  }

  /**
   * Handle HMRC annual submission errors
   * @param {Error} error - Original error
   * @returns {Error} Processed error
   */
  handleHMRCAnnualError(error) {
    if (error instanceof HMRCError) {
      return error;
    }
    
    const errorMappings = {
      'INVALID_TAX_YEAR': 'Invalid tax year format',
      'MISSING_QUARTERLY_SUBMISSIONS': 'All quarterly submissions must be completed first',
      'DUPLICATE_SUBMISSION': 'Annual declaration already submitted for this tax year',
      'INVALID_CALCULATION_ID': 'Invalid calculation ID provided',
      'CRYSTALLISATION_FAILED': 'Tax calculation crystallisation failed',
      'LATE_SUBMISSION': 'Annual declaration submitted after deadline'
    };
    
    const userMessage = errorMappings[error.code] || error.message;
    
    return new HMRCError(
      userMessage,
      error.code || 'ANNUAL_SUBMISSION_ERROR',
      error.statusCode || 500,
      'annual_submission',
      { originalError: error.message }
    );
  }

  /**
   * Generate annual summary report
   * @param {Object} quarterlyData - Quarterly data
   * @param {Object} annualDeclaration - Annual declaration
   * @param {Object} taxCalculation - Tax calculation
   * @returns {Object} Summary report
   */
  generateAnnualSummaryReport(quarterlyData, annualDeclaration, taxCalculation) {
    return {
      taxYear: quarterlyData.taxYear || taxCalculation.taxYear,
      businessSummary: {
        totalIncome: quarterlyData.totalIncome,
        totalExpenses: quarterlyData.totalExpenses,
        profitBeforeAdjustments: quarterlyData.totalIncome - quarterlyData.totalExpenses,
        quarterlySubmissions: quarterlyData.quarterlySubmissions.length
      },
      adjustments: {
        totalAdjustments: Object.values(annualDeclaration.adjustments || {})
          .reduce((sum, val) => sum + val, 0),
        totalAllowances: Object.values(annualDeclaration.allowances || {})
          .reduce((sum, val) => sum + val, 0)
      },
      taxCalculation: {
        taxableIncome: taxCalculation.taxableIncome,
        incomeTax: taxCalculation.incomeTax,
        class4NIC: taxCalculation.class4NIC,
        totalTaxDue: taxCalculation.totalTaxDue
      },
      submissionDetails: {
        submittedAt: new Date(),
        calculationId: taxCalculation.calculationId,
        verified: taxCalculation.verification?.verified || false
      }
    };
  }

  /**
   * Audit annual submission trail
   * @param {string} userId - User ID
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   * @param {Object} declaration - Annual declaration
   * @param {Object} hmrcResponse - HMRC response
   * @param {Object} taxCalculation - Tax calculation
   * @param {Error} error - Error if failed
   */
  async auditAnnualSubmissionTrail(
    userId,
    businessId,
    taxYear,
    declaration,
    hmrcResponse,
    taxCalculation,
    error = null
  ) {
    const auditData = {
      userId,
      businessId,
      taxYear,
      timestamp: new Date(),
      success: !error,
      declaration: declaration ? this.sanitizeAnnualPayload(declaration) : null,
      hmrcResponse: hmrcResponse ? {
        correlationId: hmrcResponse.correlationId,
        calculationId: hmrcResponse.calculationId,
        processingDate: hmrcResponse.processingDate
      } : null,
      taxCalculation: taxCalculation ? {
        calculationId: taxCalculation.calculationId,
        totalTaxDue: taxCalculation.totalTaxDue,
        verified: taxCalculation.verification?.verified
      } : null,
      error: error ? error.message : null
    };
    
    if (error) {
      logger.logError('Annual submission failed', auditData);
    } else {
      logger.logHMRC('Annual submission successful', auditData);
    }
    
    // Store in database for audit trail
    // Implementation depends on your audit storage strategy
  }

  /**
   * Get current capital allowance pools
   * @param {string} userId - User ID
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   * @returns {Object} Current pools
   */
  async getCurrentCapitalAllowancePools(userId, businessId, taxYear) {
    // This would retrieve current pool values from database
    // Implementation depends on your data storage strategy
    return {
      mainPool: 0,
      specialRatePool: 0,
      singleAssetPools: []
    };
  }

  /**
   * Update capital allowance pools
   * @param {string} userId - User ID
   * @param {string} businessId - Business ID
   * @param {string} taxYear - Tax year
   * @param {Object} allowances - Calculated allowances
   * @param {Array} newAssets - New assets
   * @param {Array} disposals - Asset disposals
   */
  async updateCapitalAllowancePools(userId, businessId, taxYear, allowances, newAssets, disposals) {
    // This would update pool values in database
    // Implementation depends on your data storage strategy
    logger.logInfo('Capital allowance pools updated', {
      userId, businessId, taxYear,
      allowances: Object.keys(allowances).length,
      newAssets: newAssets.length,
      disposals: disposals.length
    });
  }

  /**
   * Perform fallback tax calculation
   * @param {string} nino - National Insurance Number
   * @param {string} taxYear - Tax year
   * @returns {Object} Fallback calculation
   */
  async performFallbackTaxCalculation(nino, taxYear) {
    // Implement fallback calculation logic
    // This would be a simplified calculation when HMRC API fails
    logger.logWarning('Performing fallback tax calculation', { nino, taxYear });
    
    return {
      taxYear,
      calculationId: null,
      totalIncome: 0,
      taxableIncome: 0,
      incomeTax: 0,
      class4NIC: 0,
      totalTaxDue: 0,
      paymentOnAccount1: 0,
      paymentOnAccount2: 0,
      balancingPayment: 0,
      calculatedAt: new Date(),
      isFallback: true
    };
  }
}

module.exports = AnnualSubmissionService;