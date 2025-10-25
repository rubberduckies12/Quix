const logger = require('../../utils/logger.util');
const DateUtil = require('../../utils/date.util');
const { ValidationError, AppError } = require('../../utils/error.util');

/**
 * HMRC Categorization Service for UK MTD ITSA
 * Maps transactions to official HMRC expense categories following actual HMRC rules
 */
class HMRCCategoriesService {
  constructor() {
    this.hmrcCategories = this.initializeHMRCCategories();
    this.businessTypeRules = this.initializeBusinessTypeRules();
    this.allowableExpenseRules = this.initializeAllowableExpenseRules();
    this.nonAllowableKeywords = this.initializeNonAllowableKeywords();
    this.keywordMappings = this.initializeKeywordMappings();
    this.categoryConfidenceCache = new Map();
    this.userLearningData = new Map();
  }

  // =====================================================
  // HMRC CATEGORY DEFINITIONS
  // =====================================================

  /**
   * Initialize official HMRC expense and income categories
   */
  initializeHMRCCategories() {
    return {
      selfEmployment: {
        expenses: {
          costOfGoodsBought: {
            name: 'Cost of goods bought',
            description: 'Raw materials, stock, goods bought for resale',
            hmrcReference: 'SE040',
            allowedBusinessTypes: ['retail', 'wholesale', 'manufacturing', 'trading']
          },
          cisPaymentsToSubcontractors: {
            name: 'CIS payments to subcontractors',
            description: 'Construction Industry Scheme payments',
            hmrcReference: 'SE045',
            allowedBusinessTypes: ['construction', 'building']
          },
          staffCosts: {
            name: 'Staff costs',
            description: 'Wages, salaries, subcontractor payments, employer NICs',
            hmrcReference: 'SE050'
          },
          travelCosts: {
            name: 'Travel costs',
            description: 'Business travel, fuel, parking, hotel stays (not home to work)',
            hmrcReference: 'SE055'
          },
          premisesRunningCosts: {
            name: 'Premises running costs',
            description: 'Rent, business rates, heating, lighting, cleaning',
            hmrcReference: 'SE060'
          },
          maintenanceCosts: {
            name: 'Maintenance costs',
            description: 'Repairs and maintenance of property and equipment',
            hmrcReference: 'SE065'
          },
          adminCosts: {
            name: 'Admin costs',
            description: 'Phone, fax, stationery, postage, small equipment',
            hmrcReference: 'SE070'
          },
          advertisingCosts: {
            name: 'Advertising costs',
            description: 'Advertising, marketing, website costs',
            hmrcReference: 'SE075'
          },
          businessEntertainmentCosts: {
            name: 'Business entertainment costs',
            description: 'Entertaining clients, customer hospitality',
            hmrcReference: 'SE080',
            restrictions: 'Staff entertainment allowable, client entertainment not deductible'
          },
          interestOnBankOtherLoans: {
            name: 'Interest on bank and other loans',
            description: 'Business loan interest, hire purchase interest',
            hmrcReference: 'SE085'
          },
          financialCharges: {
            name: 'Financial charges',
            description: 'Bank charges, credit card charges, factoring charges',
            hmrcReference: 'SE090'
          },
          badDebt: {
            name: 'Bad debt',
            description: 'Irrecoverable debts written off',
            hmrcReference: 'SE095'
          },
          professionalFees: {
            name: 'Professional fees',
            description: 'Accountant, solicitor, architect, surveyor fees',
            hmrcReference: 'SE100'
          },
          depreciation: {
            name: 'Depreciation',
            description: 'Depreciation of equipment and machinery',
            hmrcReference: 'SE105',
            restrictions: 'Use capital allowances instead'
          },
          other: {
            name: 'Other allowable business expenses',
            description: 'Other allowable business expenses not covered above',
            hmrcReference: 'SE110'
          }
        },
        income: {
          turnover: {
            name: 'Turnover',
            description: 'Business sales, fees, commission, self-employment income',
            hmrcReference: 'SE010'
          },
          other: {
            name: 'Other business income',
            description: 'Other business income (grants, insurance payouts, etc.)',
            hmrcReference: 'SE015'
          }
        }
      },
      property: {
        expenses: {
          premisesRunningCosts: {
            name: 'Premises running costs',
            description: 'Rent, rates, insurance, ground rent',
            hmrcReference: 'PR040'
          },
          repairsAndMaintenance: {
            name: 'Repairs and maintenance',
            description: 'Maintenance, repairs, redecoration',
            hmrcReference: 'PR045'
          },
          financialCosts: {
            name: 'Financial costs',
            description: 'Mortgage interest, loan interest (restrictions apply)',
            hmrcReference: 'PR050',
            restrictions: 'Basic rate tax relief only from April 2020'
          },
          professionalFees: {
            name: 'Professional fees',
            description: 'Letting agent fees, legal fees, accountant fees',
            hmrcReference: 'PR055'
          },
          costOfServices: {
            name: 'Cost of services',
            description: 'Gardening, cleaning, security services',
            hmrcReference: 'PR060'
          },
          travelCosts: {
            name: 'Travel costs',
            description: 'Travel to inspect properties',
            hmrcReference: 'PR065'
          },
          other: {
            name: 'Other allowable property expenses',
            description: 'Other allowable property expenses',
            hmrcReference: 'PR070'
          }
        },
        income: {
          premiumsOfLeaseGrant: {
            name: 'Premiums of lease grant',
            description: 'Property premiums received',
            hmrcReference: 'PR010'
          },
          reversePremiums: {
            name: 'Reverse premiums',
            description: 'Reverse premiums',
            hmrcReference: 'PR015'
          },
          periodAmount: {
            name: 'Rental income',
            description: 'Rental income received',
            hmrcReference: 'PR020'
          },
          rentARoom: {
            name: 'Rent-a-room income',
            description: 'Rent-a-room income (max £7,500 exemption)',
            hmrcReference: 'PR025',
            exemptionLimit: 7500
          }
        }
      }
    };
  }

  /**
   * Initialize business type specific rules
   */
  initializeBusinessTypeRules() {
    return {
      retail: {
        primaryExpenses: ['costOfGoodsBought', 'premisesRunningCosts', 'staffCosts'],
        costOfGoodsRequired: true,
        typicalExpenseRatios: {
          costOfGoodsBought: { min: 0.3, max: 0.7 }, // 30-70% of turnover
          premisesRunningCosts: { min: 0.05, max: 0.2 }
        }
      },
      wholesale: {
        primaryExpenses: ['costOfGoodsBought', 'travelCosts', 'adminCosts'],
        costOfGoodsRequired: true,
        typicalExpenseRatios: {
          costOfGoodsBought: { min: 0.4, max: 0.8 }
        }
      },
      services: {
        primaryExpenses: ['professionalFees', 'adminCosts', 'travelCosts'],
        costOfGoodsRequired: false,
        typicalExpenseRatios: {
          professionalFees: { min: 0.02, max: 0.15 }
        }
      },
      construction: {
        primaryExpenses: ['cisPaymentsToSubcontractors', 'costOfGoodsBought', 'travelCosts'],
        costOfGoodsRequired: true,
        requiresCISTracking: true,
        typicalExpenseRatios: {
          cisPaymentsToSubcontractors: { min: 0.1, max: 0.6 }
        }
      },
      property: {
        primaryExpenses: ['financialCosts', 'repairsAndMaintenance', 'professionalFees'],
        incomeTypes: ['periodAmount', 'premiumsOfLeaseGrant']
      },
      freelancer: {
        primaryExpenses: ['adminCosts', 'professionalFees', 'travelCosts'],
        homeOfficeEligible: true,
        equipmentAllowances: true
      }
    };
  }

  /**
   * Initialize allowable expense rules based on HMRC guidance
   */
  initializeAllowableExpenseRules() {
    return {
      homeOffice: {
        simplifiedExpenses: {
          rate: 4, // £4 per hour
          maxHoursPerMonth: 200,
          description: 'Simplified expenses for home office use'
        },
        actualCosts: {
          allowedPercentage: true,
          requiresEvidence: true,
          description: 'Actual costs proportionate to business use'
        }
      },
      motorExpenses: {
        mileageRates: {
          first10k: 0.45, // 45p per mile for first 10,000 miles
          additional: 0.25 // 25p per mile thereafter
        },
        actualCosts: {
          allowed: true,
          excludesPersonalUse: true,
          requiresLogbook: true
        }
      },
      clothing: {
        allowable: ['uniforms', 'protective_clothing', 'branded_clothing'],
        notAllowable: ['ordinary_clothing', 'suits', 'everyday_wear']
      },
      entertainment: {
        staffEntertainment: {
          allowable: true,
          description: 'Staff parties, team building events'
        },
        clientEntertainment: {
          allowable: false,
          description: 'Client meals, entertainment generally not deductible'
        }
      },
      travel: {
        allowable: ['business_meetings', 'customer_visits', 'temporary_workplace'],
        notAllowable: ['home_to_office', 'ordinary_commuting'],
        overnightStays: {
          allowable: true,
          requiresBusinessPurpose: true
        }
      }
    };
  }

  /**
   * Initialize non-allowable expense keywords
   */
  initializeNonAllowableKeywords() {
    return {
      personal: [
        'personal', 'private', 'family', 'spouse', 'partner', 'children',
        'gym', 'health club', 'fitness', 'personal trainer',
        'clothing', 'suit', 'dress', 'shoes', 'personal care',
        'home improvement', 'personal insurance', 'life insurance'
      ],
      finesAndPenalties: [
        'parking fine', 'speeding fine', 'penalty', 'court fine',
        'hmrc penalty', 'tax penalty', 'interest on tax',
        'late payment surcharge'
      ],
      capitalExpenditures: [
        'building purchase', 'land purchase', 'property purchase',
        'major renovation', 'extension', 'new roof',
        'equipment over', 'machinery purchase', 'vehicle purchase',
        'computer equipment', 'furniture', 'fixtures'
      ],
      nonDeductible: [
        'dividend', 'salary draw', 'personal drawings',
        'business entertainment', 'client lunch', 'client dinner',
        'political donation', 'charitable donation',
        'client gifts over'
      ]
    };
  }

  /**
   * Initialize keyword to category mappings
   */
  initializeKeywordMappings() {
    return {
      costOfGoodsBought: [
        'stock', 'inventory', 'raw materials', 'goods for resale',
        'materials', 'supplies', 'components', 'parts',
        'wholesale purchase', 'trade purchase', 'supplier invoice'
      ],
      cisPaymentsToSubcontractors: [
        'cis', 'construction industry scheme', 'subcontractor',
        'building contractor', 'trades', 'scaffolding',
        'plumbing', 'electrical', 'roofing', 'plastering'
      ],
      staffCosts: [
        'salary', 'wages', 'payroll', 'employee', 'staff',
        'national insurance', 'pension contribution', 'paye',
        'recruitment', 'agency fees', 'temporary staff'
      ],
      travelCosts: [
        'travel', 'fuel', 'petrol', 'diesel', 'mileage',
        'train ticket', 'flight', 'hotel', 'accommodation',
        'parking', 'toll', 'taxi', 'uber', 'car rental'
      ],
      premisesRunningCosts: [
        'rent', 'rates', 'business rates', 'council tax',
        'utilities', 'electricity', 'gas', 'water',
        'heating', 'lighting', 'cleaning', 'security',
        'insurance premises', 'building insurance'
      ],
      maintenanceCosts: [
        'repairs', 'maintenance', 'servicing', 'fix',
        'plumber', 'electrician', 'decorator', 'painter',
        'equipment repair', 'machinery service', 'hvac'
      ],
      adminCosts: [
        'stationery', 'office supplies', 'postage', 'courier',
        'telephone', 'mobile phone', 'internet', 'broadband',
        'software', 'subscriptions', 'printing', 'photocopying'
      ],
      advertisingCosts: [
        'advertising', 'marketing', 'promotion', 'website',
        'seo', 'google ads', 'facebook ads', 'social media',
        'brochure', 'flyer', 'banner', 'exhibition'
      ],
      businessEntertainmentCosts: [
        'staff party', 'team building', 'staff meal',
        'christmas party', 'staff entertainment', 'employee event'
      ],
      interestOnBankOtherLoans: [
        'loan interest', 'business loan', 'overdraft interest',
        'hire purchase interest', 'finance interest',
        'equipment finance', 'asset finance'
      ],
      financialCharges: [
        'bank charges', 'bank fees', 'transaction fees',
        'credit card fees', 'merchant fees', 'factoring',
        'invoice discounting', 'currency exchange'
      ],
      badDebt: [
        'bad debt', 'write off', 'irrecoverable debt',
        'debt provision', 'uncollectable', 'defaulted payment'
      ],
      professionalFees: [
        'accountant', 'solicitor', 'lawyer', 'legal fees',
        'audit', 'bookkeeping', 'tax advice', 'consultant',
        'architect', 'surveyor', 'valuation', 'professional advice'
      ],
      depreciation: [
        'depreciation', 'amortisation', 'capital allowance',
        'writing down allowance', 'annual investment allowance'
      ],
      // Property specific
      repairsAndMaintenance: [
        'property repairs', 'maintenance', 'redecoration',
        'painting', 'flooring', 'bathroom repair', 'kitchen repair',
        'boiler service', 'roof repair', 'window repair'
      ],
      financialCosts: [
        'mortgage interest', 'property loan interest',
        'buy-to-let mortgage', 'bridging loan interest'
      ],
      costOfServices: [
        'gardening', 'garden maintenance', 'cleaning service',
        'property management', 'security service', 'concierge'
      ]
    };
  }

  // =====================================================
  // MAIN CATEGORIZATION METHODS
  // =====================================================

  /**
   * Categorize a single transaction using HMRC rules
   * @param {Object} transaction - Transaction to categorize
   * @param {Object} options - Categorization options
   * @returns {Object} Categorization result
   */
  async categorizeTransaction(transaction, options = {}) {
    try {
      // Validate transaction data
      this.validateTransactionData(transaction);
      
      // Clean and prepare description
      const cleanDescription = this.cleanTransactionDescription(transaction.description);
      
      // Determine income source type
      const incomeSource = options.incomeSource || this.detectIncomeSource(transaction);
      const businessType = options.businessType || 'general';
      
      // Check for non-allowable expenses first
      const nonAllowableCheck = this.detectNonAllowableExpenses(transaction);
      if (nonAllowableCheck.isNonAllowable) {
        return {
          category: null,
          confidence: 0.9,
          reason: 'non_allowable',
          explanation: nonAllowableCheck.reason,
          hmrcGuidance: nonAllowableCheck.guidance,
          alternatives: []
        };
      }
      
      // Detect capital vs revenue
      const capitalCheck = this.detectCapitalVsRevenue(transaction);
      if (capitalCheck.isCapital) {
        return {
          category: 'capital_expenditure',
          confidence: capitalCheck.confidence,
          reason: 'capital_expenditure',
          explanation: capitalCheck.explanation,
          hmrcGuidance: 'Consider capital allowances instead',
          alternatives: []
        };
      }
      
      // Apply business type specific rules
      const businessRules = this.applyBusinessTypeRules(transaction, businessType);
      
      // Perform keyword matching
      const keywordResults = this.implementKeywordMatching(
        cleanDescription, 
        incomeSource,
        businessRules.allowedCategories
      );
      
      // Handle mixed use expenses
      const mixedUseCheck = this.handleMixedUseExpenses(transaction, businessType);
      
      // Calculate final confidence score
      const confidence = this.calculateCategoryConfidence(
        transaction,
        keywordResults.category,
        keywordResults.confidence,
        businessRules.confidence || 0.5
      );
      
      // Get alternative suggestions
      const alternatives = this.suggestAlternativeCategories(
        transaction,
        keywordResults.category,
        incomeSource
      );
      
      // Learn from historical data if available
      const userLearning = this.applyUserLearningData(transaction, options.userId);
      
      const finalCategory = userLearning.category || keywordResults.category;
      const finalConfidence = Math.max(confidence, userLearning.confidence || 0);
      
      return {
        category: finalCategory,
        confidence: finalConfidence,
        reason: keywordResults.reason,
        explanation: this.explainCategorizationReason(transaction, finalCategory),
        hmrcGuidance: this.getHMRCGuidance(finalCategory, incomeSource),
        alternatives,
        mixedUse: mixedUseCheck,
        businessRules: businessRules.appliedRules || [],
        incomeSource,
        warnings: this.flagPotentialIssues(transaction, finalCategory)
      };
      
    } catch (error) {
      logger.logError('Transaction categorization failed', {
        transaction: transaction.id,
        error: error.message
      });
      
      return {
        category: 'other',
        confidence: 0.1,
        reason: 'error',
        explanation: 'Categorization failed, manual review required',
        error: error.message
      };
    }
  }

  /**
   * Batch categorize multiple transactions
   * @param {Array} transactions - Transactions to categorize
   * @param {Object} options - Categorization options
   * @returns {Array} Categorization results
   */
  async batchCategorizeTransactions(transactions, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 100;
    
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const batchPromises = batch.map(transaction => 
        this.categorizeTransaction(transaction, options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay to prevent overwhelming the system
      if (i + batchSize < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }

  // =====================================================
  // KEYWORD MATCHING & DETECTION
  // =====================================================

  /**
   * Implement keyword matching for HMRC categories
   * @param {string} description - Clean transaction description
   * @param {string} incomeSource - Income source type
   * @param {Array} allowedCategories - Business type allowed categories
   * @returns {Object} Matching result
   */
  implementKeywordMatching(description, incomeSource, allowedCategories = null) {
    const lowerDescription = description.toLowerCase();
    const categories = this.hmrcCategories[incomeSource] || this.hmrcCategories.selfEmployment;
    
    let bestMatch = null;
    let bestScore = 0;
    let bestReason = '';
    
    // Check each category's keywords
    Object.keys(this.keywordMappings).forEach(category => {
      // Skip if category not allowed for business type
      if (allowedCategories && !allowedCategories.includes(category)) {
        return;
      }
      
      // Skip if category doesn't exist for this income source
      if (!categories.expenses[category] && !categories.income[category]) {
        return;
      }
      
      const keywords = this.keywordMappings[category];
      let categoryScore = 0;
      let matchedKeywords = [];
      
      keywords.forEach(keyword => {
        if (lowerDescription.includes(keyword.toLowerCase())) {
          // Weight longer, more specific keywords higher
          const keywordWeight = keyword.length > 8 ? 2 : 1;
          categoryScore += keywordWeight;
          matchedKeywords.push(keyword);
        }
      });
      
      // Normalize score by number of keywords in category
      const normalizedScore = categoryScore / keywords.length;
      
      if (normalizedScore > bestScore) {
        bestScore = normalizedScore;
        bestMatch = category;
        bestReason = `Matched keywords: ${matchedKeywords.join(', ')}`;
      }
    });
    
    // If no good match found, use fallback logic
    if (!bestMatch || bestScore < 0.1) {
      return this.fallbackCategorization(description, incomeSource);
    }
    
    return {
      category: bestMatch,
      confidence: Math.min(bestScore, 0.95), // Cap confidence at 95%
      reason: bestReason,
      matchedKeywords: bestReason.split(': ')[1]?.split(', ') || []
    };
  }

  /**
   * Fallback categorization for unmatched transactions
   * @param {string} description - Transaction description
   * @param {string} incomeSource - Income source type
   * @returns {Object} Fallback categorization
   */
  fallbackCategorization(description, incomeSource) {
    // Try to detect transaction type from amount patterns or description
    const lowerDesc = description.toLowerCase();
    
    // Common fallback patterns
    if (lowerDesc.includes('payment') || lowerDesc.includes('invoice')) {
      return {
        category: 'other',
        confidence: 0.3,
        reason: 'Generic payment detected'
      };
    }
    
    if (lowerDesc.includes('refund') || lowerDesc.includes('credit')) {
      return {
        category: 'other',
        confidence: 0.4,
        reason: 'Refund or credit detected'
      };
    }
    
    return {
      category: 'other',
      confidence: 0.2,
      reason: 'No specific category match found'
    };
  }

  // =====================================================
  // BUSINESS RULES & VALIDATION
  // =====================================================

  /**
   * Apply business type specific rules
   * @param {Object} transaction - Transaction to analyze
   * @param {string} businessType - Type of business
   * @returns {Object} Business rules result
   */
  applyBusinessTypeRules(transaction, businessType) {
    const rules = this.businessTypeRules[businessType];
    if (!rules) {
      return {
        allowedCategories: null,
        appliedRules: [],
        confidence: 0.5
      };
    }
    
    const appliedRules = [];
    let confidence = 0.7; // Higher confidence for business-specific rules
    
    // Check if cost of goods is required
    if (rules.costOfGoodsRequired && 
        transaction.transactionType === 'expense' &&
        transaction.amount > 1000) {
      appliedRules.push('Cost of goods may be required for this business type');
    }
    
    // Check typical expense ratios
    if (rules.typicalExpenseRatios) {
      Object.keys(rules.typicalExpenseRatios).forEach(category => {
        if (transaction.category === category) {
          confidence = 0.8; // Higher confidence for primary expense categories
        }
      });
    }
    
    return {
      allowedCategories: this.getCategoriesForBusinessType(businessType),
      appliedRules,
      confidence,
      businessRules: rules
    };
  }

  /**
   * Get allowed categories for business type
   * @param {string} businessType - Business type
   * @returns {Array} Allowed HMRC categories
   */
  getCategoriesForBusinessType(businessType) {
    const rules = this.businessTypeRules[businessType];
    if (!rules) return null;
    
    // Return primary expenses plus common categories
    const commonCategories = [
      'adminCosts', 'professionalFees', 'financialCharges', 'other'
    ];
    
    return [...(rules.primaryExpenses || []), ...commonCategories];
  }

  /**
   * Handle mixed business/personal use expenses
   * @param {Object} transaction - Transaction to analyze
   * @param {string} businessType - Business type
   * @returns {Object} Mixed use analysis
   */
  handleMixedUseExpenses(transaction, businessType) {
    const description = transaction.description.toLowerCase();
    const amount = transaction.amount;
    
    // Common mixed use scenarios
    const mixedUseIndicators = {
      homeOffice: ['home office', 'home working', 'office at home'],
      motorExpenses: ['car', 'vehicle', 'fuel', 'mileage'],
      utilities: ['electricity', 'gas', 'internet', 'phone'],
      insurance: ['insurance'],
      mobilePhone: ['mobile', 'phone', 'telephone']
    };
    
    for (const [type, keywords] of Object.entries(mixedUseIndicators)) {
      if (keywords.some(keyword => description.includes(keyword))) {
        return {
          isMixedUse: true,
          type,
          suggestedBusinessPercentage: this.getSuggestedBusinessPercentage(type, businessType),
          hmrcGuidance: this.getMixedUseGuidance(type),
          requiresApportionment: true
        };
      }
    }
    
    return {
      isMixedUse: false,
      requiresApportionment: false
    };
  }

  /**
   * Get suggested business percentage for mixed use expenses
   * @param {string} expenseType - Type of mixed use expense
   * @param {string} businessType - Business type
   * @returns {number} Suggested business percentage
   */
  getSuggestedBusinessPercentage(expenseType, businessType) {
    const suggestions = {
      homeOffice: businessType === 'freelancer' ? 25 : 15, // 15-25% typical
      motorExpenses: 50, // 50% unless detailed records kept
      utilities: businessType === 'freelancer' ? 20 : 10,
      insurance: 100, // Business insurance fully deductible
      mobilePhone: businessType === 'freelancer' ? 80 : 50
    };
    
    return suggestions[expenseType] || 50;
  }

  /**
   * Detect non-allowable expenses
   * @param {Object} transaction - Transaction to check
   * @returns {Object} Non-allowable detection result
   */
  detectNonAllowableExpenses(transaction) {
    const description = transaction.description.toLowerCase();
    
    // Check against non-allowable keywords
    for (const [category, keywords] of Object.entries(this.nonAllowableKeywords)) {
      for (const keyword of keywords) {
        if (description.includes(keyword.toLowerCase())) {
          return {
            isNonAllowable: true,
            category,
            reason: `${keyword} expenses are not allowable for tax purposes`,
            guidance: this.getNonAllowableGuidance(category)
          };
        }
      }
    }
    
    // Check for high-value personal items
    if (transaction.amount > 500 && this.isPotentialPersonalExpense(description)) {
      return {
        isNonAllowable: true,
        category: 'potential_personal',
        reason: 'High-value item that may be personal use',
        guidance: 'Ensure this expense is wholly and exclusively for business use'
      };
    }
    
    return {
      isNonAllowable: false
    };
  }

  /**
   * Detect capital vs revenue expenditure
   * @param {Object} transaction - Transaction to analyze
   * @returns {Object} Capital/revenue classification
   */
  detectCapitalVsRevenue(transaction) {
    const description = transaction.description.toLowerCase();
    const amount = transaction.amount;
    
    // Capital expenditure indicators
    const capitalIndicators = [
      'building', 'property purchase', 'land', 'equipment purchase',
      'machinery', 'vehicle purchase', 'major renovation',
      'extension', 'new roof', 'structural'
    ];
    
    // Check for capital keywords
    const hasCapitalKeywords = capitalIndicators.some(indicator => 
      description.includes(indicator)
    );
    
    // High-value equipment threshold
    const isHighValueEquipment = amount > 500 && (
      description.includes('equipment') || 
      description.includes('machinery') || 
      description.includes('computer')
    );
    
    if (hasCapitalKeywords || isHighValueEquipment) {
      return {
        isCapital: true,
        confidence: hasCapitalKeywords ? 0.8 : 0.6,
        explanation: 'This appears to be capital expenditure rather than a revenue expense',
        recommendation: 'Consider claiming capital allowances instead'
      };
    }
    
    return {
      isCapital: false,
      confidence: 0.8
    };
  }

  // =====================================================
  // VALIDATION & COMPLIANCE
  // =====================================================

  /**
   * Validate against HMRC guidance
   * @param {string} category - HMRC category
   * @param {string} description - Transaction description
   * @param {number} amount - Transaction amount
   * @returns {Object} Validation result
   */
  validateAgainstHMRCGuidance(category, description, amount) {
    const validationRules = {
      costOfGoodsBought: {
        maxPercentageOfTurnover: 0.8,
        requiresBusinessType: ['retail', 'wholesale', 'manufacturing']
      },
      businessEntertainmentCosts: {
        clientEntertainmentNotAllowed: true,
        staffEntertainmentAllowed: true
      },
      travelCosts: {
        homeToWorkNotAllowed: true,
        requiresBusinessPurpose: true
      },
      clothingCosts: {
        uniformsAllowed: true,
        ordinaryClothingNotAllowed: true
      }
    };
    
    const rules = validationRules[category];
    if (!rules) {
      return { isValid: true, warnings: [] };
    }
    
    const warnings = [];
    
    // Apply specific validation rules
    if (category === 'businessEntertainmentCosts' && rules.clientEntertainmentNotAllowed) {
      if (description.toLowerCase().includes('client') || 
          description.toLowerCase().includes('customer')) {
        warnings.push('Client entertainment is generally not allowable');
      }
    }
    
    if (category === 'travelCosts' && rules.homeToWorkNotAllowed) {
      if (description.toLowerCase().includes('commute') || 
          description.toLowerCase().includes('home to office')) {
        warnings.push('Home to work travel is not allowable');
      }
    }
    
    return {
      isValid: warnings.length === 0,
      warnings
    };
  }

  /**
   * Flag potential issues for HMRC queries
   * @param {Object} transaction - Transaction
   * @param {string} category - Assigned category
   * @returns {Array} Potential issues
   */
  flagPotentialIssues(transaction, category) {
    const issues = [];
    const amount = transaction.amount;
    const description = transaction.description.toLowerCase();
    
    // High-value transactions
    if (amount > 10000) {
      issues.push({
        type: 'high_value',
        message: 'High-value transaction may require additional documentation',
        severity: 'medium'
      });
    }
    
    // Round number amounts (may indicate estimates)
    if (amount % 100 === 0 && amount > 500) {
      issues.push({
        type: 'round_amount',
        message: 'Round amount may indicate estimate - ensure accurate records',
        severity: 'low'
      });
    }
    
    // Frequent similar transactions
    if (this.isFrequentSimilarTransaction(transaction)) {
      issues.push({
        type: 'frequent_similar',
        message: 'Similar transactions occur frequently - ensure all are business-related',
        severity: 'low'
      });
    }
    
    // Category-specific issues
    if (category === 'other' && amount > 1000) {
      issues.push({
        type: 'uncategorized_high_value',
        message: 'High-value uncategorized expense requires specific categorization',
        severity: 'high'
      });
    }
    
    return issues;
  }

  /**
   * Calculate reasonableness checks
   * @param {Array} expenses - Expense transactions
   * @param {Array} income - Income transactions
   * @returns {Object} Reasonableness analysis
   */
  calculateReasonablenessChecks(expenses, income) {
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);
    
    const expenseToIncomeRatio = totalIncome > 0 ? totalExpenses / totalIncome : 0;
    
    const issues = [];
    
    // High expense to income ratio
    if (expenseToIncomeRatio > 0.9) {
      issues.push({
        type: 'high_expense_ratio',
        ratio: expenseToIncomeRatio,
        message: 'Expenses are unusually high compared to income',
        severity: 'high'
      });
    }
    
    // Check category-specific ratios
    const categoryTotals = this.aggregateByCategory(expenses);
    
    Object.entries(categoryTotals).forEach(([category, amount]) => {
      const categoryRatio = totalIncome > 0 ? amount / totalIncome : 0;
      
      if (category === 'costOfGoodsBought' && categoryRatio > 0.8) {
        issues.push({
          type: 'high_cost_of_goods',
          category,
          ratio: categoryRatio,
          message: 'Cost of goods seems high - verify calculations',
          severity: 'medium'
        });
      }
      
      if (category === 'travelCosts' && categoryRatio > 0.3) {
        issues.push({
          type: 'high_travel_costs',
          category,
          ratio: categoryRatio,
          message: 'Travel costs seem high - ensure business purpose',
          severity: 'medium'
        });
      }
    });
    
    return {
      expenseToIncomeRatio,
      issues,
      summary: {
        totalExpenses,
        totalIncome,
        netProfit: totalIncome - totalExpenses
      }
    };
  }

  // =====================================================
  // LEARNING & IMPROVEMENT
  // =====================================================

  /**
   * Learn from user corrections
   * @param {string} userId - User ID
   * @param {Object} transaction - Original transaction
   * @param {string} originalCategory - AI suggested category
   * @param {string} correctedCategory - User corrected category
   */
  learnFromUserCorrections(userId, transaction, originalCategory, correctedCategory) {
    if (!this.userLearningData.has(userId)) {
      this.userLearningData.set(userId, {
        corrections: [],
        patterns: new Map()
      });
    }
    
    const userData = this.userLearningData.get(userId);
    
    // Store the correction
    userData.corrections.push({
      transaction: {
        description: transaction.description,
        amount: transaction.amount,
        category: transaction.category
      },
      originalCategory,
      correctedCategory,
      timestamp: new Date()
    });
    
    // Update patterns
    const descriptionKey = this.cleanTransactionDescription(transaction.description)
      .toLowerCase()
      .substring(0, 50); // Use first 50 chars as key
    
    userData.patterns.set(descriptionKey, {
      category: correctedCategory,
      confidence: 0.9,
      lastUsed: new Date()
    });
    
    // Limit stored data to prevent memory issues
    if (userData.corrections.length > 1000) {
      userData.corrections = userData.corrections.slice(-500);
    }
    
    logger.logInfo('User categorization correction learned', {
      userId,
      originalCategory,
      correctedCategory,
      description: transaction.description.substring(0, 100)
    });
  }

  /**
   * Apply user learning data to categorization
   * @param {Object} transaction - Transaction to categorize
   * @param {string} userId - User ID
   * @returns {Object} Learning-based categorization
   */
  applyUserLearningData(transaction, userId) {
    if (!userId || !this.userLearningData.has(userId)) {
      return { confidence: 0 };
    }
    
    const userData = this.userLearningData.get(userId);
    const descriptionKey = this.cleanTransactionDescription(transaction.description)
      .toLowerCase()
      .substring(0, 50);
    
    // Check for exact pattern match
    if (userData.patterns.has(descriptionKey)) {
      const pattern = userData.patterns.get(descriptionKey);
      
      // Check if pattern is recent (within 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      if (pattern.lastUsed > sixMonthsAgo) {
        return {
          category: pattern.category,
          confidence: pattern.confidence,
          reason: 'user_learning'
        };
      }
    }
    
    // Check for similar patterns
    const similarPatterns = this.findSimilarPatterns(transaction, userData.patterns);
    if (similarPatterns.length > 0) {
      const bestPattern = similarPatterns[0];
      return {
        category: bestPattern.category,
        confidence: bestPattern.confidence * 0.8, // Reduce confidence for similar matches
        reason: 'similar_user_pattern'
      };
    }
    
    return { confidence: 0 };
  }

  /**
   * Calculate category confidence score
   * @param {Object} transaction - Transaction
   * @param {string} category - Suggested category
   * @param {number} keywordConfidence - Keyword matching confidence
   * @param {number} businessRuleConfidence - Business rule confidence
   * @returns {number} Overall confidence score
   */
  calculateCategoryConfidence(transaction, category, keywordConfidence, businessRuleConfidence) {
    let confidence = keywordConfidence;
    
    // Boost confidence for business rule matches
    confidence = Math.max(confidence, businessRuleConfidence);
    
    // Boost confidence for exact amount patterns
    if (this.hasExactAmountPattern(transaction)) {
      confidence = Math.min(confidence + 0.1, 0.95);
    }
    
    // Reduce confidence for vague descriptions
    if (this.isVagueDescription(transaction.description)) {
      confidence = Math.max(confidence - 0.2, 0.1);
    }
    
    // Boost confidence for detailed descriptions
    if (transaction.description.length > 50) {
      confidence = Math.min(confidence + 0.05, 0.95);
    }
    
    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }

  // =====================================================
  // INTEGRATION & MAPPING
  // =====================================================

  /**
   * Map categorized transactions to quarterly submission fields
   * @param {Array} categorizedTransactions - Transactions with categories
   * @param {string} incomeSource - Income source type
   * @returns {Object} HMRC submission format
   */
  mapToQuarterlySubmissionFields(categorizedTransactions, incomeSource = 'self-employment') {
    const result = {
      income: {},
      expenses: {}
    };
    
    const categories = this.hmrcCategories[incomeSource];
    
    // Initialize all categories with zero
    Object.keys(categories.income || {}).forEach(category => {
      result.income[category] = 0;
    });
    
    Object.keys(categories.expenses || {}).forEach(category => {
      result.expenses[category] = 0;
    });
    
    // Aggregate transactions by category
    categorizedTransactions.forEach(transaction => {
      if (!transaction.category || transaction.category === 'capital_expenditure') {
        return; // Skip uncategorized or capital expenditure
      }
      
      const amount = Math.round(transaction.netAmount || transaction.amount || 0);
      
      if (transaction.transactionType === 'income') {
        if (result.income.hasOwnProperty(transaction.category)) {
          result.income[transaction.category] += amount;
        } else {
          result.income.other = (result.income.other || 0) + amount;
        }
      } else if (transaction.transactionType === 'expense') {
        if (result.expenses.hasOwnProperty(transaction.category)) {
          result.expenses[transaction.category] += amount;
        } else {
          result.expenses.other = (result.expenses.other || 0) + amount;
        }
      }
    });
    
    // Remove zero amounts for cleaner submission
    Object.keys(result.income).forEach(category => {
      if (result.income[category] === 0) {
        delete result.income[category];
      }
    });
    
    Object.keys(result.expenses).forEach(category => {
      if (result.expenses[category] === 0) {
        delete result.expenses[category];
      }
    });
    
    return result;
  }

  /**
   * Aggregate transactions by HMRC category
   * @param {Array} transactions - Categorized transactions
   * @param {Object} period - Period information
   * @returns {Object} Aggregated data
   */
  aggregateByHMRCCategory(transactions, period) {
    const aggregated = this.mapToQuarterlySubmissionFields(transactions);
    
    return {
      ...aggregated,
      period,
      metadata: {
        transactionCount: transactions.length,
        categorizedCount: transactions.filter(t => t.category && t.category !== 'other').length,
        uncategorizedCount: transactions.filter(t => !t.category || t.category === 'other').length,
        totalIncome: Object.values(aggregated.income).reduce((sum, val) => sum + val, 0),
        totalExpenses: Object.values(aggregated.expenses).reduce((sum, val) => sum + val, 0)
      }
    };
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Clean transaction description for better matching
   * @param {string} description - Original description
   * @returns {string} Cleaned description
   */
  cleanTransactionDescription(description) {
    if (!description) return '';
    
    return description
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .toLowerCase();
  }

  /**
   * Validate transaction data
   * @param {Object} transaction - Transaction to validate
   */
  validateTransactionData(transaction) {
    const required = ['id', 'description', 'amount', 'transactionType'];
    const missing = required.filter(field => !transaction[field]);
    
    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }
    
    if (typeof transaction.amount !== 'number' || transaction.amount < 0) {
      throw new ValidationError('Amount must be a positive number');
    }
    
    if (!['income', 'expense'].includes(transaction.transactionType)) {
      throw new ValidationError('Transaction type must be income or expense');
    }
  }

  /**
   * Get HMRC guidance for category
   * @param {string} category - HMRC category
   * @param {string} incomeSource - Income source type
   * @returns {string} HMRC guidance
   */
  getHMRCGuidance(category, incomeSource = 'self-employment') {
    const categories = this.hmrcCategories[incomeSource];
    const categoryInfo = categories?.expenses?.[category] || categories?.income?.[category];
    
    if (categoryInfo) {
      return `${categoryInfo.description}. HMRC Reference: ${categoryInfo.hmrcReference}`;
    }
    
    return 'Please refer to HMRC guidance for this category';
  }

  /**
   * Suggest alternative categories
   * @param {Object} transaction - Transaction
   * @param {string} primaryCategory - Primary suggested category
   * @param {string} incomeSource - Income source type
   * @returns {Array} Alternative categories
   */
  suggestAlternativeCategories(transaction, primaryCategory, incomeSource = 'self-employment') {
    const alternatives = [];
    const description = transaction.description.toLowerCase();
    
    // Get secondary matches with lower confidence
    const keywordResults = this.implementKeywordMatching(description, incomeSource);
    
    // Add common alternatives based on primary category
    const categoryAlternatives = {
      adminCosts: ['professionalFees', 'other'],
      travelCosts: ['motorExpenses', 'other'],
      premisesRunningCosts: ['maintenanceCosts', 'other'],
      other: ['adminCosts', 'professionalFees']
    };
    
    const suggested = categoryAlternatives[primaryCategory] || [];
    suggested.forEach(alt => {
      if (alt !== primaryCategory) {
        alternatives.push({
          category: alt,
          confidence: 0.3,
          reason: 'Common alternative category'
        });
      }
    });
    
    return alternatives.slice(0, 3); // Limit to 3 alternatives
  }

  /**
   * Explain categorization reason
   * @param {Object} transaction - Transaction
   * @param {string} category - Assigned category
   * @returns {string} Explanation
   */
  explainCategorizationReason(transaction, category) {
    const categoryInfo = this.getHMRCCategoryInfo(category);
    
    if (!categoryInfo) {
      return 'This transaction has been categorized based on its description and amount.';
    }
    
    return `This transaction appears to be ${categoryInfo.description.toLowerCase()}. ${categoryInfo.name} includes ${categoryInfo.description}.`;
  }

  /**
   * Get HMRC category information
   * @param {string} category - Category name
   * @returns {Object} Category information
   */
  getHMRCCategoryInfo(category) {
    // Search in both self-employment and property categories
    for (const source of ['selfEmployment', 'property']) {
      const categories = this.hmrcCategories[source];
      if (categories.expenses[category]) {
        return categories.expenses[category];
      }
      if (categories.income[category]) {
        return categories.income[category];
      }
    }
    return null;
  }

  /**
   * Detect income source from transaction
   * @param {Object} transaction - Transaction to analyze
   * @returns {string} Income source type
   */
  detectIncomeSource(transaction) {
    const description = transaction.description.toLowerCase();
    
    // Property-related keywords
    const propertyKeywords = ['rent', 'rental', 'property', 'landlord', 'tenant'];
    if (propertyKeywords.some(keyword => description.includes(keyword))) {
      return 'property';
    }
    
    // Default to self-employment
    return 'selfEmployment';
  }

  /**
   * Check if description is vague
   * @param {string} description - Transaction description
   * @returns {boolean} True if vague
   */
  isVagueDescription(description) {
    const vagueTerms = ['payment', 'transaction', 'transfer', 'misc', 'other', 'various'];
    const lowerDesc = description.toLowerCase();
    
    return vagueTerms.some(term => lowerDesc.includes(term)) || description.length < 10;
  }

  /**
   * Check for exact amount patterns
   * @param {Object} transaction - Transaction
   * @returns {boolean} True if has exact pattern
   */
  hasExactAmountPattern(transaction) {
    // Check if amount is a round number or follows a pattern
    const amount = transaction.amount;
    return amount % 10 === 0 || amount % 25 === 0;
  }

  /**
   * Check if potentially personal expense
   * @param {string} description - Transaction description
   * @returns {boolean} True if potentially personal
   */
  isPotentialPersonalExpense(description) {
    const personalIndicators = [
      'personal', 'family', 'home', 'private', 'grocery',
      'restaurant', 'clothing', 'entertainment'
    ];
    
    return personalIndicators.some(indicator => 
      description.toLowerCase().includes(indicator)
    );
  }

  /**
   * Check if frequent similar transaction
   * @param {Object} transaction - Transaction to check
   * @returns {boolean} True if frequent
   */
  isFrequentSimilarTransaction(transaction) {
    // This would check against historical data
    // Implementation depends on your data storage
    return false; // Placeholder
  }

  /**
   * Find similar patterns in user learning data
   * @param {Object} transaction - Transaction
   * @param {Map} patterns - User patterns
   * @returns {Array} Similar patterns
   */
  findSimilarPatterns(transaction, patterns) {
    const cleanDesc = this.cleanTransactionDescription(transaction.description);
    const similar = [];
    
    for (const [patternKey, patternData] of patterns) {
      // Simple similarity check - could be enhanced with fuzzy matching
      if (this.calculateStringSimilarity(cleanDesc, patternKey) > 0.7) {
        similar.push({
          ...patternData,
          similarity: this.calculateStringSimilarity(cleanDesc, patternKey)
        });
      }
    }
    
    return similar.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Calculate string similarity
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateStringSimilarity(str1, str2) {
    // Simple implementation - could use more sophisticated algorithms
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.calculateEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate edit distance between strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  calculateEditDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get non-allowable guidance
   * @param {string} category - Non-allowable category
   * @returns {string} HMRC guidance
   */
  getNonAllowableGuidance(category) {
    const guidance = {
      personal: 'Personal expenses are not allowable. Only expenses wholly and exclusively for business purposes can be deducted.',
      finesAndPenalties: 'Fines and penalties are not allowable business expenses.',
      capitalExpenditures: 'Capital expenditure is not allowable as a business expense. Consider capital allowances instead.',
      nonDeductible: 'This type of expense is specifically not allowable under HMRC rules.'
    };
    
    return guidance[category] || 'This expense may not be allowable. Please check HMRC guidance.';
  }

  /**
   * Get mixed use guidance
   * @param {string} expenseType - Type of mixed use expense
   * @returns {string} HMRC guidance
   */
  getMixedUseGuidance(expenseType) {
    const guidance = {
      homeOffice: 'For home office expenses, you can use simplified expenses (£4/hour) or claim actual costs based on business use percentage.',
      motorExpenses: 'For vehicle expenses, use mileage rates (45p/25p per mile) or actual costs with business use percentage.',
      utilities: 'Only the business portion of utilities can be claimed. Calculate based on business use of the property.',
      insurance: 'Only business insurance is fully deductible. Personal insurance is not allowable.',
      mobilePhone: 'Business calls and data usage can be claimed. Separate business and personal use.'
    };
    
    return guidance[expenseType] || 'Only the business portion of mixed use expenses can be claimed.';
  }

  /**
   * Aggregate expenses by category
   * @param {Array} expenses - Expense transactions
   * @returns {Object} Category totals
   */
  aggregateByCategory(expenses) {
    const totals = {};
    
    expenses.forEach(expense => {
      const category = expense.category || 'other';
      totals[category] = (totals[category] || 0) + expense.amount;
    });
    
    return totals;
  }
}

module.exports = HMRCCategoriesService;