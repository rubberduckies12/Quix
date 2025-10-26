const { validateTransaction, validateTransactionDescription, sanitizeString } = require('./validation.util');
const { ValidationError, createFieldError, AppError } = require('./errors.util');
const { formatForDisplay, getCurrentTaxYear } = require('./date.util');
const vertexAI = require('../external/vertex-api.external');
const fs = require('fs').promises;
const path = require('path');

/**
 * MTD Categorization Utility for HMRC Tax Categories
 * Supports sole traders and landlords with AI-powered transaction categorization
 */
class CategorizationUtil {
  constructor() {
    this.config = {
      // HMRC MTD Official Categories
      hmrcCategories: {
        // Self-Employment Expense Categories
        selfEmployment: {
          expenses: {
            costOfGoodsBought: {
              code: 'costOfGoodsBought',
              description: 'Raw materials, stock, goods for resale',
              keywords: ['stock', 'materials', 'goods', 'inventory', 'supplies', 'raw materials', 'wholesale', 'resale']
            },
            cisPaymentsToSubcontractors: {
              code: 'cisPaymentsToSubcontractors',
              description: 'Construction Industry Scheme payments',
              keywords: ['cis', 'subcontractor', 'construction', 'builder', 'tradesman', 'contractor payment']
            },
            staffCosts: {
              code: 'staffCosts',
              description: 'Wages, salaries, subcontractor payments, employer NICs',
              keywords: ['wages', 'salary', 'staff', 'employee', 'payroll', 'paye', 'nics', 'national insurance', 'pension']
            },
            travelCosts: {
              code: 'travelCosts',
              description: 'Business travel, fuel, parking, hotels (not home to work)',
              keywords: ['travel', 'fuel', 'petrol', 'diesel', 'parking', 'hotel', 'mileage', 'train', 'taxi', 'flight']
            },
            premisesRunningCosts: {
              code: 'premisesRunningCosts',
              description: 'Rent, business rates, heating, lighting, cleaning',
              keywords: ['rent', 'rates', 'business rates', 'electricity', 'gas', 'heating', 'lighting', 'water', 'cleaning']
            },
            maintenanceCosts: {
              code: 'maintenanceCosts',
              description: 'Repairs and maintenance of property and equipment',
              keywords: ['repair', 'maintenance', 'fix', 'service', 'mot', 'servicing', 'equipment repair']
            },
            adminCosts: {
              code: 'adminCosts',
              description: 'Phone, fax, stationery, postage, small equipment',
              keywords: ['phone', 'mobile', 'telephone', 'internet', 'stationery', 'postage', 'stamps', 'printer', 'computer']
            },
            advertisingCosts: {
              code: 'advertisingCosts',
              description: 'Advertising, marketing, website costs',
              keywords: ['advertising', 'marketing', 'website', 'google ads', 'facebook ads', 'promotion', 'leaflets']
            },
            businessEntertainmentCosts: {
              code: 'businessEntertainmentCosts',
              description: 'Entertaining clients, customer hospitality',
              keywords: ['entertainment', 'client lunch', 'hospitality', 'client dinner', 'business meal']
            },
            interestOnBankOtherLoans: {
              code: 'interestOnBankOtherLoans',
              description: 'Business loan interest, hire purchase interest',
              keywords: ['loan interest', 'bank interest', 'hire purchase', 'finance charges', 'credit interest']
            },
            financialCharges: {
              code: 'financialCharges',
              description: 'Bank charges, credit card charges, factoring charges',
              keywords: ['bank charges', 'credit card fee', 'transaction fee', 'overdraft', 'financial charges']
            },
            badDebt: {
              code: 'badDebt',
              description: 'Irrecoverable debts written off',
              keywords: ['bad debt', 'debt write off', 'unpaid invoice', 'irrecoverable debt']
            },
            professionalFees: {
              code: 'professionalFees',
              description: 'Accountant, solicitor, architect, surveyor fees',
              keywords: ['accountant', 'solicitor', 'lawyer', 'architect', 'surveyor', 'consultant', 'professional fees']
            },
            depreciation: {
              code: 'depreciation',
              description: 'Depreciation of equipment and machinery',
              keywords: ['depreciation', 'capital allowance', 'equipment depreciation']
            },
            other: {
              code: 'other',
              description: 'Other allowable business expenses',
              keywords: ['business expense', 'allowable expense']
            }
          },
          income: {
            turnover: {
              code: 'turnover',
              description: 'Business sales, fees, commission, self-employment income',
              keywords: ['sales', 'income', 'revenue', 'fees', 'commission', 'payment received', 'invoice payment']
            },
            other: {
              code: 'other',
              description: 'Other business income (grants, insurance payouts)',
              keywords: ['grant', 'insurance payout', 'other income', 'miscellaneous income']
            }
          }
        },
        
        // Property Rental Categories
        property: {
          expenses: {
            premisesRunningCosts: {
              code: 'premisesRunningCosts',
              description: 'Rent, rates, insurance, ground rent',
              keywords: ['rent', 'rates', 'council tax', 'insurance', 'ground rent', 'service charge']
            },
            repairsAndMaintenance: {
              code: 'repairsAndMaintenance',
              description: 'Maintenance, repairs, redecoration',
              keywords: ['repair', 'maintenance', 'decorating', 'painting', 'plumbing', 'electrical', 'boiler']
            },
            financialCosts: {
              code: 'financialCosts',
              description: 'Mortgage interest, loan interest',
              keywords: ['mortgage interest', 'loan interest', 'finance costs', 'mortgage payment']
            },
            professionalFees: {
              code: 'professionalFees',
              description: 'Letting agent fees, legal fees, accountant fees',
              keywords: ['letting agent', 'estate agent', 'legal fees', 'solicitor', 'accountant', 'management fees']
            },
            costOfServices: {
              code: 'costOfServices',
              description: 'Gardening, cleaning, security services',
              keywords: ['gardening', 'cleaning', 'security', 'caretaker', 'maintenance service']
            },
            travelCosts: {
              code: 'travelCosts',
              description: 'Travel to inspect properties',
              keywords: ['travel', 'mileage', 'fuel', 'property visit', 'inspection travel']
            },
            other: {
              code: 'other',
              description: 'Other allowable property expenses',
              keywords: ['property expense', 'allowable expense']
            }
          },
          income: {
            premiumsOfLeaseGrant: {
              code: 'premiumsOfLeaseGrant',
              description: 'Property premiums received',
              keywords: ['lease premium', 'premium received']
            },
            reversePremiums: {
              code: 'reversePremiums',
              description: 'Reverse premiums',
              keywords: ['reverse premium']
            },
            periodAmount: {
              code: 'periodAmount',
              description: 'Rental income received',
              keywords: ['rent received', 'rental income', 'tenant payment', 'property income']
            }
          }
        }
      },

      // Personal/Non-business indicators
      personalIndicators: [
        'groceries', 'supermarket', 'tesco', 'sainsbury', 'asda', 'morrisons',
        'clothes', 'clothing', 'fashion', 'shoes',
        'personal', 'private', 'home shopping',
        'gym', 'fitness', 'netflix', 'spotify',
        'personal care', 'haircut', 'beauty',
        'family', 'children', 'school fees'
      ],

      // Business type validation
      allowedBusinessTypes: ['sole_trader', 'landlord'],

      // AI configuration
      aiConfig: {
        maxRetries: 3,
        timeoutMs: 10000,
        fallbackToKeywords: true
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
  }

  // ====== CORE CATEGORIZATION METHODS ======

  /**
   * Categorize a single transaction
   * @param {Object} transaction - Transaction to categorize
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @returns {Object} Categorized transaction result
   */
  async categorizeTransaction(transaction, businessType = 'sole_trader') {
    try {
      // Validate inputs
      this._validateBusinessType(businessType);
      const validationResult = this._validateTransactionData(transaction);
      if (!validationResult.isValid) {
        throw new ValidationError(validationResult.error, validationResult.errors);
      }

      // Clean and prepare description
      const cleanedDescription = this.cleanDescription(transaction.description);
      
      // Check for personal transaction indicators
      const personalCheck = this._checkForPersonalTransaction(cleanedDescription);
      if (personalCheck.isPersonal) {
        return {
          transactionId: transaction.id || null,
          originalDescription: transaction.description,
          cleanedDescription,
          hmrcCategory: null,
          categoryDescription: null,
          matchMethod: 'personal_excluded',
          confidence: personalCheck.confidence,
          isPersonal: true,
          personalIndicators: personalCheck.indicators,
          originalData: { ...transaction },
          processingDate: new Date().toISOString(),
          error: 'Transaction appears to be personal rather than business'
        };
      }

      // Try AI categorization first
      let categorizationResult;
      try {
        categorizationResult = await this._categorizeWithAI(cleanedDescription, businessType, transaction);
        // Set high confidence for AI categorization (AI is definitive)
        categorizationResult.confidence = 0.95;
      } catch (aiError) {
        console.warn('AI categorization failed, falling back to keyword matching:', aiError.message);
        categorizationResult = this._categorizeWithKeywords(cleanedDescription, businessType);
        categorizationResult.matchMethod = 'keyword_fallback';
        categorizationResult.aiError = aiError.message;
      }

      // Prepare final result
      const result = {
        transactionId: transaction.id || null,
        originalDescription: transaction.description,
        cleanedDescription,
        hmrcCategory: categorizationResult.category,
        categoryDescription: categorizationResult.description,
        matchMethod: categorizationResult.matchMethod,
        confidence: categorizationResult.confidence,
        isPersonal: false,
        businessKeywords: categorizationResult.keywords || [],
        originalData: { ...transaction },
        processingDate: new Date().toISOString()
      };

      // Add AI-specific data if available
      if (categorizationResult.aiResponse) {
        result.aiResponse = categorizationResult.aiResponse;
      }
      if (categorizationResult.aiError) {
        result.aiError = categorizationResult.aiError;
      }

      return result;

    } catch (error) {
      return {
        transactionId: transaction.id || null,
        originalDescription: transaction.description,
        hmrcCategory: null,
        matchMethod: 'error',
        confidence: 0,
        isPersonal: false,
        error: error.message,
        errorCode: error.code || this.config.errorCodes.CATEGORIZATION_FAILED,
        originalData: { ...transaction },
        processingDate: new Date().toISOString()
      };
    }
  }

  /**
   * Categorize multiple transactions in batch
   * @param {Array} transactions - Array of transactions to categorize
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Object} Batch categorization results
   */
  async categorizeTransactionBatch(transactions, businessType = 'sole_trader', progressCallback = null) {
    const results = {
      totalTransactions: transactions.length,
      categorizedTransactions: [],
      personalTransactions: [],
      errors: [],
      summary: {
        successful: 0,
        personal: 0,
        errors: 0,
        aiCategorized: 0,
        keywordCategorized: 0
      },
      processingDate: new Date().toISOString(),
      businessType
    };

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      try {
        const result = await this.categorizeTransaction(transaction, businessType);
        
        if (result.error) {
          results.errors.push(result);
          results.summary.errors++;
        } else if (result.isPersonal) {
          results.personalTransactions.push(result);
          results.summary.personal++;
        } else {
          results.categorizedTransactions.push(result);
          results.summary.successful++;
          
          // Track categorization method
          if (result.matchMethod === 'ai' || result.matchMethod === 'ai_verified') {
            results.summary.aiCategorized++;
          } else if (result.matchMethod.includes('keyword')) {
            results.summary.keywordCategorized++;
          }
        }

        // Call progress callback if provided
        if (progressCallback && typeof progressCallback === 'function') {
          progressCallback({
            completed: i + 1,
            total: transactions.length,
            percentage: Math.round(((i + 1) / transactions.length) * 100),
            currentTransaction: result
          });
        }

        // Add small delay to avoid overwhelming AI service
        if (i < transactions.length - 1) {
          await this._delay(100);
        }

      } catch (error) {
        const errorResult = {
          transactionId: transaction.id || null,
          originalDescription: transaction.description || 'Unknown',
          error: error.message,
          errorCode: error.code || this.config.errorCodes.CATEGORIZATION_FAILED
        };
        results.errors.push(errorResult);
        results.summary.errors++;
      }
    }

    return results;
  }

  // ====== DESCRIPTION PROCESSING ======

  /**
   * Clean and sanitize transaction description for processing
   * @param {string} description - Raw transaction description
   * @returns {string} Cleaned description
   */
  cleanDescription(description) {
    if (!description || typeof description !== 'string') {
      return '';
    }

    let cleaned = sanitizeString(description);
    
    // Remove common bank transaction codes
    cleaned = cleaned.replace(/\b(TXN|REF|AUTH|ID)[\s:]*\d+/gi, '');
    
    // Remove dates in various formats
    cleaned = cleaned.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '');
    
    // Remove transaction IDs and references
    cleaned = cleaned.replace(/\b[A-Z0-9]{8,}\b/g, '');
    
    // Remove excess whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove common prefixes
    const prefixesToRemove = ['DD:', 'SO:', 'BP:', 'CHG:', 'FEE:', 'INT:', 'TFR:'];
    for (const prefix of prefixesToRemove) {
      if (cleaned.toUpperCase().startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }

    return cleaned;
  }

  /**
   * Extract business-relevant keywords from description
   * @param {string} description - Transaction description
   * @returns {Array} Array of business keywords found
   */
  extractBusinessKeywords(description) {
    const keywords = [];
    const lowerDesc = description.toLowerCase();
    
    // Check all category keywords
    const allCategories = {
      ...this.config.hmrcCategories.selfEmployment.expenses,
      ...this.config.hmrcCategories.selfEmployment.income,
      ...this.config.hmrcCategories.property.expenses,
      ...this.config.hmrcCategories.property.income
    };

    for (const [categoryCode, categoryData] of Object.entries(allCategories)) {
      for (const keyword of categoryData.keywords) {
        if (lowerDesc.includes(keyword.toLowerCase())) {
          keywords.push({
            keyword,
            category: categoryCode,
            description: categoryData.description
          });
        }
      }
    }

    return keywords;
  }

  // ====== AI INTEGRATION ======

  /**
   * Parse AI response and extract category
   * @private
   */
  _parseAIResponse(aiResponse, businessType) {
    if (!aiResponse || typeof aiResponse !== 'string') {
      throw new Error('Invalid response format');
    }

    const cleanResponse = aiResponse.trim().toLowerCase();
    
    // Check for personal transaction
    if (cleanResponse === 'personal' || cleanResponse.includes('personal')) {
      return { category: null, isPersonal: true };
    }

    // Check for unclear response
    if (cleanResponse === 'unclear' || cleanResponse.includes('unclear')) {
      return { category: null };
    }

    // Get valid categories for business type
    const validCategories = this._getValidCategoriesForBusinessType(businessType);
    
    // Clean the response to extract just the category code
    let extractedCategory = cleanResponse
      .replace(/['"]/g, '') // Remove quotes
      .replace(/\.$/, '') // Remove trailing period
      .trim();

    // Try exact match first
    for (const categoryCode of validCategories) {
      if (extractedCategory === categoryCode.toLowerCase()) {
        const categoryData = this._getCategoryData(categoryCode, businessType);
        return {
          category: categoryCode,
          description: categoryData?.description || 'Unknown category'
        };
      }
    }

    // Try partial match for common variations
    const categoryMappings = {
      // Travel variations
      'travel': 'travelCosts',
      'travelcosts': 'travelCosts',
      'fuel': 'travelCosts',
      'mileage': 'travelCosts',
      
      // Premises variations
      'premises': 'premisesRunningCosts',
      'premisesrunning': 'premisesRunningCosts',
      'rent': 'premisesRunningCosts',
      'utilities': 'premisesRunningCosts',
      
      // Admin variations
      'admin': 'adminCosts',
      'admincosts': 'adminCosts',
      'administration': 'adminCosts',
      
      // Professional fees variations
      'professional': 'professionalFees',
      'professionalfees': 'professionalFees',
      'fees': 'professionalFees',
      
      // Repairs variations (context dependent)
      'repairs': businessType === 'landlord' ? 'repairsAndMaintenance' : 'maintenanceCosts',
      'maintenance': businessType === 'landlord' ? 'repairsAndMaintenance' : 'maintenanceCosts',
      'repairsandmaintenance': 'repairsAndMaintenance',
      'maintenancecosts': 'maintenanceCosts',
      
      // Advertising variations
      'advertising': 'advertisingCosts',
      'advertisingcosts': 'advertisingCosts',
      'marketing': 'advertisingCosts',
      
      // Financial variations
      'financial': businessType === 'landlord' ? 'financialCosts' : 'financialCharges',
      'financialcosts': 'financialCosts',
      'financialcharges': 'financialCharges',
      'bankcharges': 'financialCharges',
      
      // Income variations
      'income': businessType === 'landlord' ? 'periodAmount' : 'turnover',
      'rental': 'periodAmount',
      'rent_received': 'periodAmount',
      'periodamount': 'periodAmount',
      'sales': 'turnover',
      'revenue': 'turnover',
      
      // Staff variations
      'staff': 'staffCosts',
      'staffcosts': 'staffCosts',
      'wages': 'staffCosts',
      'salary': 'staffCosts',
      
      // Goods variations
      'goods': 'costOfGoodsBought',
      'stock': 'costOfGoodsBought',
      'materials': 'costOfGoodsBought',
      'costofgoodsbought': 'costOfGoodsBought',
      
      // Services variations (landlord only)
      'services': 'costOfServices',
      'costofservices': 'costOfServices',
      'gardening': 'costOfServices',
      'cleaning': 'costOfServices',
      
      // Default fallback
      'other': 'other'
    };

    // Check mappings
    if (categoryMappings[extractedCategory]) {
      const mappedCategory = categoryMappings[extractedCategory];
      if (validCategories.includes(mappedCategory)) {
        const categoryData = this._getCategoryData(mappedCategory, businessType);
        return {
          category: mappedCategory,
          description: categoryData?.description || 'Unknown category'
        };
      }
    }

    // Try finding category that contains the response
    for (const categoryCode of validCategories) {
      if (categoryCode.toLowerCase().includes(extractedCategory) || 
          extractedCategory.includes(categoryCode.toLowerCase())) {
        const categoryData = this._getCategoryData(categoryCode, businessType);
        return {
          category: categoryCode,
          description: categoryData?.description || 'Unknown category'
        };
      }
    }

    // If we get here, the response couldn't be parsed
    console.warn(`Could not parse categorization response: "${aiResponse}" for business type: ${businessType}`);
    
    // Fall back to keyword analysis as a last resort
    return { 
      category: null,
      parseError: `Unrecognized categorization response: ${aiResponse}`
    };
  }

  /**
   * Categorize transaction using advanced service
   * @private
   */
  async _categorizeWithAI(description, businessType, transaction) {
    const prompt = this._buildAIPrompt(description, businessType, transaction);
    
    let lastError;
    for (let attempt = 1; attempt <= this.config.aiConfig.maxRetries; attempt++) {
      try {
        const response = await vertexAI.categorizeTransaction(prompt, {
          timeout: this.config.aiConfig.timeoutMs,
          businessType
        });

        const parsedResult = this._parseAIResponse(response, businessType);
        
        if (parsedResult.category) {
          return {
            category: parsedResult.category,
            description: parsedResult.description,
            matchMethod: 'advanced',
            serviceResponse: response,
            keywords: this.extractBusinessKeywords(description)
          };
        } else {
          throw new Error('Advanced categorization service did not return a valid HMRC category');
        }

      } catch (error) {
        lastError = error;
        console.warn(`Advanced categorization attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.config.aiConfig.maxRetries) {
          await this._delay(1000 * attempt); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  /**
   * Categorize a single transaction
   * @param {Object} transaction - Transaction to categorize
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @returns {Object} Categorized transaction result
   */
  async categorizeTransaction(transaction, businessType = 'sole_trader') {
    try {
      // Validate inputs
      this._validateBusinessType(businessType);
      const validationResult = this._validateTransactionData(transaction);
      if (!validationResult.isValid) {
        throw new ValidationError(validationResult.error, validationResult.errors);
      }

      // Clean and prepare description
      const cleanedDescription = this.cleanDescription(transaction.description);
      
      // Check for personal transaction indicators
      const personalCheck = this._checkForPersonalTransaction(cleanedDescription);
      if (personalCheck.isPersonal) {
        return {
          transactionId: transaction.id || null,
          originalDescription: transaction.description,
          cleanedDescription,
          hmrcCategory: null,
          categoryDescription: null,
          matchMethod: 'personal_excluded',
          confidence: personalCheck.confidence,
          isPersonal: true,
          personalIndicators: personalCheck.indicators,
          originalData: { ...transaction },
          processingDate: new Date().toISOString(),
          error: 'Transaction appears to be personal rather than business'
        };
      }

      // Try advanced categorization first
      let categorizationResult;
      try {
        categorizationResult = await this._categorizeWithAI(cleanedDescription, businessType, transaction);
        // Set high confidence for advanced categorization
        categorizationResult.confidence = 0.95;
      } catch (serviceError) {
        console.warn('Advanced categorization failed, falling back to keyword matching:', serviceError.message);
        categorizationResult = this._categorizeWithKeywords(cleanedDescription, businessType);
        categorizationResult.matchMethod = 'keyword_fallback';
        categorizationResult.serviceError = serviceError.message;
      }

      // Prepare final result
      const result = {
        transactionId: transaction.id || null,
        originalDescription: transaction.description,
        cleanedDescription,
        hmrcCategory: categorizationResult.category,
        categoryDescription: categorizationResult.description,
        matchMethod: categorizationResult.matchMethod,
        confidence: categorizationResult.confidence,
        isPersonal: false,
        businessKeywords: categorizationResult.keywords || [],
        originalData: { ...transaction },
        processingDate: new Date().toISOString()
      };

      // Add service-specific data if available
      if (categorizationResult.serviceResponse) {
        result.serviceResponse = categorizationResult.serviceResponse;
      }
      if (categorizationResult.serviceError) {
        result.serviceError = categorizationResult.serviceError;
      }

      return result;

    } catch (error) {
      return {
        transactionId: transaction.id || null,
        originalDescription: transaction.description,
        hmrcCategory: null,
        matchMethod: 'error',
        confidence: 0,
        isPersonal: false,
        error: error.message,
        errorCode: error.code || this.config.errorCodes.CATEGORIZATION_FAILED,
        originalData: { ...transaction },
        processingDate: new Date().toISOString()
      };
    }
  }

  /**
   * Categorize multiple transactions in batch
   * @param {Array} transactions - Array of transactions to categorize
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Object} Batch categorization results
   */
  async categorizeTransactionBatch(transactions, businessType = 'sole_trader', progressCallback = null) {
    const results = {
      totalTransactions: transactions.length,
      categorizedTransactions: [],
      personalTransactions: [],
      errors: [],
      summary: {
        successful: 0,
        personal: 0,
        errors: 0,
        advancedCategorized: 0,
        keywordCategorized: 0
      },
      processingDate: new Date().toISOString(),
      businessType
    };

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      try {
        const result = await this.categorizeTransaction(transaction, businessType);
        
        if (result.error) {
          results.errors.push(result);
          results.summary.errors++;
        } else if (result.isPersonal) {
          results.personalTransactions.push(result);
          results.summary.personal++;
        } else {
          results.categorizedTransactions.push(result);
          results.summary.successful++;
          
          // Track categorization method
          if (result.matchMethod === 'advanced' || result.matchMethod === 'advanced_verified') {
            results.summary.advancedCategorized++;
          } else if (result.matchMethod.includes('keyword')) {
            results.summary.keywordCategorized++;
          }
        }

        // Call progress callback if provided
        if (progressCallback && typeof progressCallback === 'function') {
          progressCallback({
            completed: i + 1,
            total: transactions.length,
            percentage: Math.round(((i + 1) / transactions.length) * 100),
            currentTransaction: result
          });
        }

        // Add small delay to avoid overwhelming categorization service
        if (i < transactions.length - 1) {
          await this._delay(100);
        }

      } catch (error) {
        const errorResult = {
          transactionId: transaction.id || null,
          originalDescription: transaction.description || 'Unknown',
          error: error.message,
          errorCode: error.code || this.config.errorCodes.CATEGORIZATION_FAILED
        };
        results.errors.push(errorResult);
        results.summary.errors++;
      }
    }

    return results;
  }

  // ====== DESCRIPTION PROCESSING ======

  /**
   * Clean and sanitize transaction description for processing
   * @param {string} description - Raw transaction description
   * @returns {string} Cleaned description
   */
  cleanDescription(description) {
    if (!description || typeof description !== 'string') {
      return '';
    }

    let cleaned = sanitizeString(description);
    
    // Remove common bank transaction codes
    cleaned = cleaned.replace(/\b(TXN|REF|AUTH|ID)[\s:]*\d+/gi, '');
    
    // Remove dates in various formats
    cleaned = cleaned.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '');
    
    // Remove transaction IDs and references
    cleaned = cleaned.replace(/\b[A-Z0-9]{8,}\b/g, '');
    
    // Remove excess whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove common prefixes
    const prefixesToRemove = ['DD:', 'SO:', 'BP:', 'CHG:', 'FEE:', 'INT:', 'TFR:'];
    for (const prefix of prefixesToRemove) {
      if (cleaned.toUpperCase().startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }

    return cleaned;
  }

  /**
   * Extract business-relevant keywords from description
   * @param {string} description - Transaction description
   * @returns {Array} Array of business keywords found
   */
  extractBusinessKeywords(description) {
    const keywords = [];
    const lowerDesc = description.toLowerCase();
    
    // Check all category keywords
    const allCategories = {
      ...this.config.hmrcCategories.selfEmployment.expenses,
      ...this.config.hmrcCategories.selfEmployment.income,
      ...this.config.hmrcCategories.property.expenses,
      ...this.config.hmrcCategories.property.income
    };

    for (const [categoryCode, categoryData] of Object.entries(allCategories)) {
      for (const keyword of categoryData.keywords) {
        if (lowerDesc.includes(keyword.toLowerCase())) {
          keywords.push({
            keyword,
            category: categoryCode,
            description: categoryData.description
          });
        }
      }
    }

    return keywords;
  }

  // ====== AI INTEGRATION ======

  /**
   * Parse AI response and extract category
   * @private
   */
  _parseAIResponse(aiResponse, businessType) {
    if (!aiResponse || typeof aiResponse !== 'string') {
      throw new Error('Invalid response format');
    }

    const cleanResponse = aiResponse.trim().toLowerCase();
    
    // Check for personal transaction
    if (cleanResponse === 'personal' || cleanResponse.includes('personal')) {
      return { category: null, isPersonal: true };
    }

    // Check for unclear response
    if (cleanResponse === 'unclear' || cleanResponse.includes('unclear')) {
      return { category: null };
    }

    // Get valid categories for business type
    const validCategories = this._getValidCategoriesForBusinessType(businessType);
    
    // Clean the response to extract just the category code
    let extractedCategory = cleanResponse
      .replace(/['"]/g, '') // Remove quotes
      .replace(/\.$/, '') // Remove trailing period
      .trim();

    // Try exact match first
    for (const categoryCode of validCategories) {
      if (extractedCategory === categoryCode.toLowerCase()) {
        const categoryData = this._getCategoryData(categoryCode, businessType);
        return {
          category: categoryCode,
          description: categoryData?.description || 'Unknown category'
        };
      }
    }

    // Try partial match for common variations
    const categoryMappings = {
      // Travel variations
      'travel': 'travelCosts',
      'travelcosts': 'travelCosts',
      'fuel': 'travelCosts',
      'mileage': 'travelCosts',
      
      // Premises variations
      'premises': 'premisesRunningCosts',
      'premisesrunning': 'premisesRunningCosts',
      'rent': 'premisesRunningCosts',
      'utilities': 'premisesRunningCosts',
      
      // Admin variations
      'admin': 'adminCosts',
      'admincosts': 'adminCosts',
      'administration': 'adminCosts',
      
      // Professional fees variations
      'professional': 'professionalFees',
      'professionalfees': 'professionalFees',
      'fees': 'professionalFees',
      
      // Repairs variations (context dependent)
      'repairs': businessType === 'landlord' ? 'repairsAndMaintenance' : 'maintenanceCosts',
      'maintenance': businessType === 'landlord' ? 'repairsAndMaintenance' : 'maintenanceCosts',
      'repairsandmaintenance': 'repairsAndMaintenance',
      'maintenancecosts': 'maintenanceCosts',
      
      // Advertising variations
      'advertising': 'advertisingCosts',
      'advertisingcosts': 'advertisingCosts',
      'marketing': 'advertisingCosts',
      
      // Financial variations
      'financial': businessType === 'landlord' ? 'financialCosts' : 'financialCharges',
      'financialcosts': 'financialCosts',
      'financialcharges': 'financialCharges',
      'bankcharges': 'financialCharges',
      
      // Income variations
      'income': businessType === 'landlord' ? 'periodAmount' : 'turnover',
      'rental': 'periodAmount',
      'rent_received': 'periodAmount',
      'periodamount': 'periodAmount',
      'sales': 'turnover',
      'revenue': 'turnover',
      
      // Staff variations
      'staff': 'staffCosts',
      'staffcosts': 'staffCosts',
      'wages': 'staffCosts',
      'salary': 'staffCosts',
      
      // Goods variations
      'goods': 'costOfGoodsBought',
      'stock': 'costOfGoodsBought',
      'materials': 'costOfGoodsBought',
      'costofgoodsbought': 'costOfGoodsBought',
      
      // Services variations (landlord only)
      'services': 'costOfServices',
      'costofservices': 'costOfServices',
      'gardening': 'costOfServices',
      'cleaning': 'costOfServices',
      
      // Default fallback
      'other': 'other'
    };

    // Check mappings
    if (categoryMappings[extractedCategory]) {
      const mappedCategory = categoryMappings[extractedCategory];
      if (validCategories.includes(mappedCategory)) {
        const categoryData = this._getCategoryData(mappedCategory, businessType);
        return {
          category: mappedCategory,
          description: categoryData?.description || 'Unknown category'
        };
      }
    }

    // Try finding category that contains the response
    for (const categoryCode of validCategories) {
      if (categoryCode.toLowerCase().includes(extractedCategory) || 
          extractedCategory.includes(categoryCode.toLowerCase())) {
        const categoryData = this._getCategoryData(categoryCode, businessType);
        return {
          category: categoryCode,
          description: categoryData?.description || 'Unknown category'
        };
      }
    }

    // If we get here, the response couldn't be parsed
    console.warn(`Could not parse categorization response: "${aiResponse}" for business type: ${businessType}`);
    
    // Fall back to keyword analysis as a last resort
    return { 
      category: null,
      parseError: `Unrecognized categorization response: ${aiResponse}`
    };
  }

  /**
   * Categorize transaction using advanced service
   * @private
   */
  async _categorizeWithAI(description, businessType, transaction) {
    const prompt = this._buildAIPrompt(description, businessType, transaction);
    
    let lastError;
    for (let attempt = 1; attempt <= this.config.aiConfig.maxRetries; attempt++) {
      try {
        const response = await vertexAI.categorizeTransaction(prompt, {
          timeout: this.config.aiConfig.timeoutMs,
          businessType
        });

        const parsedResult = this._parseAIResponse(response, businessType);
        
        if (parsedResult.category) {
          return {
            category: parsedResult.category,
            description: parsedResult.description,
            matchMethod: 'advanced',
            serviceResponse: response,
            keywords: this.extractBusinessKeywords(description)
          };
        } else {
          throw new Error('Advanced categorization service did not return a valid HMRC category');
        }

      } catch (error) {
        lastError = error;
        console.warn(`Advanced categorization attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.config.aiConfig.maxRetries) {
          await this._delay(1000 * attempt); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  /**
   * Categorize a single transaction
   * @param {Object} transaction - Transaction to categorize
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @returns {Object} Categorized transaction result
   */
  async categorizeTransaction(transaction, businessType = 'sole_trader') {
    try {
      // Validate inputs
      this._validateBusinessType(businessType);
      const validationResult = this._validateTransactionData(transaction);
      if (!validationResult.isValid) {
        throw new ValidationError(validationResult.error, validationResult.errors);
      }

      // Clean and prepare description
      const cleanedDescription = this.cleanDescription(transaction.description);
      
      // Check for personal transaction indicators
      const personalCheck = this._checkForPersonalTransaction(cleanedDescription);
      if (personalCheck.isPersonal) {
        return {
          transactionId: transaction.id || null,
          originalDescription: transaction.description,
          cleanedDescription,
          hmrcCategory: null,
          categoryDescription: null,
          matchMethod: 'personal_excluded',
          confidence: personalCheck.confidence,
          isPersonal: true,
          personalIndicators: personalCheck.indicators,
          originalData: { ...transaction },
          processingDate: new Date().toISOString(),
          error: 'Transaction appears to be personal rather than business'
        };
      }

      // Try advanced categorization first
      let categorizationResult;
      try {
        categorizationResult = await this._categorizeWithAI(cleanedDescription, businessType, transaction);
        // Set high confidence for advanced categorization
        categorizationResult.confidence = 0.95;
      } catch (serviceError) {
        console.warn('Advanced categorization failed, falling back to keyword matching:', serviceError.message);
        categorizationResult = this._categorizeWithKeywords(cleanedDescription, businessType);
        categorizationResult.matchMethod = 'keyword_fallback';
        categorizationResult.serviceError = serviceError.message;
      }

      // Prepare final result
      const result = {
        transactionId: transaction.id || null,
        originalDescription: transaction.description,
        cleanedDescription,
        hmrcCategory: categorizationResult.category,
        categoryDescription: categorizationResult.description,
        matchMethod: categorizationResult.matchMethod,
        confidence: categorizationResult.confidence,
        isPersonal: false,
        businessKeywords: categorizationResult.keywords || [],
        originalData: { ...transaction },
        processingDate: new Date().toISOString()
      };

      // Add service-specific data if available
      if (categorizationResult.serviceResponse) {
        result.serviceResponse = categorizationResult.serviceResponse;
      }
      if (categorizationResult.serviceError) {
        result.serviceError = categorizationResult.serviceError;
      }

      return result;

    } catch (error) {
      return {
        transactionId: transaction.id || null,
        originalDescription: transaction.description,
        hmrcCategory: null,
        matchMethod: 'error',
        confidence: 0,
        isPersonal: false,
        error: error.message,
        errorCode: error.code || this.config.errorCodes.CATEGORIZATION_FAILED,
        originalData: { ...transaction },
        processingDate: new Date().toISOString()
      };
    }
  }

  /**
   * Get contextual matches using advanced pattern recognition
   * @private
   */
  _getContextualMatches(description, businessType) {
    const matches = [];
    
    // Define contextual patterns with confidence scores
    const patterns = businessType === 'landlord' ? [
      // Property rental patterns
      { regex: /\b(rent|rental|tenant|property)\b/i, category: 'periodAmount', confidence: 0.9, type: 'income' },
      { regex: /\b(mortgage|interest|loan)\b/i, category: 'financialCosts', confidence: 0.8, type: 'expense' },
      { regex: /\b(repair|fix|maintenance|decorat|paint|plumb|electric|boiler)\b/i, category: 'repairsAndMaintenance', confidence: 0.9, type: 'expense' },
      { regex: /\b(letting agent|estate agent|management)\b/i, category: 'professionalFees', confidence: 0.9, type: 'expense' },
      { regex: /\b(council tax|business rates|insurance|utilities|gas|electric)\b/i, category: 'premisesRunningCosts', confidence: 0.8, type: 'expense' },
      { regex: /\b(garden|cleaning|security|caretaker)\b/i, category: 'costOfServices', confidence: 0.8, type: 'expense' },
      { regex: /\b(travel|mileage|fuel|visit|inspection)\b/i, category: 'travelCosts', confidence: 0.7, type: 'expense' },
      { regex: /\b(solicitor|legal|accountant)\b/i, category: 'professionalFees', confidence: 0.8, type: 'expense' }
    ] : [
      // Sole trader patterns
      { regex: /\b(sales|income|revenue|payment|invoice|client)\b/i, category: 'turnover', confidence: 0.9, type: 'income' },
      { regex: /\b(fuel|petrol|diesel|mileage|travel|train|taxi|flight|hotel)\b/i, category: 'travelCosts', confidence: 0.9, type: 'expense' },
      { regex: /\b(phone|mobile|internet|stationery|postage|computer|printer)\b/i, category: 'adminCosts', confidence: 0.8, type: 'expense' },
      { regex: /\b(advertising|marketing|website|google ads|facebook|promotion)\b/i, category: 'advertisingCosts', confidence: 0.9, type: 'expense' },
      { regex: /\b(accountant|solicitor|legal|consultant|professional)\b/i, category: 'professionalFees', confidence: 0.8, type: 'expense' },
      { regex: /\b(repair|service|maintenance|mot|fix)\b/i, category: 'maintenanceCosts', confidence: 0.7, type: 'expense' },
      { regex: /\b(rent|rates|business rates|electricity|gas|heating|water)\b/i, category: 'premisesRunningCosts', confidence: 0.8, type: 'expense' },
      { regex: /\b(wages|salary|staff|employee|payroll|paye|nics)\b/i, category: 'staffCosts', confidence: 0.9, type: 'expense' },
      { regex: /\b(stock|materials|goods|inventory|supplies|wholesale)\b/i, category: 'costOfGoodsBought', confidence: 0.8, type: 'expense' },
      { regex: /\b(bank charges|credit card|transaction fee|overdraft)\b/i, category: 'financialCharges', confidence: 0.8, type: 'expense' },
      { regex: /\b(subcontractor|cis|construction|builder)\b/i, category: 'cisPaymentsToSubcontractors', confidence: 0.9, type: 'expense' },
      { regex: /\b(client lunch|entertainment|hospitality|business meal)\b/i, category: 'businessEntertainmentCosts', confidence: 0.8, type: 'expense' },
      { regex: /\b(loan interest|hire purchase|finance)\b/i, category: 'interestOnBankOtherLoans', confidence: 0.8, type: 'expense' },
      { regex: /\b(bad debt|debt write|unpaid invoice)\b/i, category: 'badDebt', confidence: 0.9, type: 'expense' },
      { regex: /\b(depreciation|capital allowance)\b/i, category: 'depreciation', confidence: 0.9, type: 'expense' }
    ];

    // Test each pattern
    for (const pattern of patterns) {
      const match = description.match(pattern.regex);
      if (match) {
        matches.push({
          category: pattern.category,
          confidence: pattern.confidence,
          type: pattern.type,
          matchedTerms: match,
          pattern: pattern.regex.source
        });
      }
    }

    // Sort by confidence (highest first)
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Build AI prompt for transaction categorization
   * @private
   */
  _buildAIPrompt(description, businessType, transaction) {
    const businessContext = businessType === 'landlord' 
      ? 'UK property rental business'
      : 'UK sole trader self-employment business';

    let prompt = `You are an expert UK tax advisor with deep knowledge of HMRC Making Tax Digital (MTD) categories. Analyze this business transaction and provide the exact category code.

Business Type: ${businessContext}
Transaction: "${description}"`;

    if (transaction.amount) {
      prompt += `\nAmount: £${Math.abs(transaction.amount)}`;
    }
    if (transaction.date) {
      prompt += `\nDate: ${transaction.date}`;
    }

    if (businessType === 'landlord') {
      prompt += `

For property rental businesses, categorize into these HMRC codes:

EXPENSES:
- premisesRunningCosts (rent, rates, insurance, utilities)
- repairsAndMaintenance (repairs, decorating, maintenance)
- financialCosts (mortgage interest, loan interest)
- professionalFees (letting agents, legal fees, accountants)
- costOfServices (gardening, cleaning, security)
- travelCosts (property visits, inspections)
- other (other allowable property expenses)

INCOME:
- periodAmount (rental income from tenants)
- premiumsOfLeaseGrant (lease premiums)
- reversePremiums (reverse premiums)

INSTRUCTIONS:
- Analyze the transaction and determine the exact HMRC category
- If personal (groceries, personal shopping), respond "PERSONAL"
- Respond only with the exact category code
- Be definitive in your categorization`;

    } else {
      prompt += `

For sole trader businesses, categorize into these HMRC codes:

EXPENSES:
- travelCosts (business travel, fuel, mileage)
- premisesRunningCosts (rent, business rates, utilities)
- adminCosts (phone, internet, stationery, equipment)
- advertisingCosts (marketing, website, promotion)
- professionalFees (accountant, solicitor, consultants)
- maintenanceCosts (equipment repairs, vehicle servicing)
- staffCosts (wages, salaries, employer NICs)
- costOfGoodsBought (stock, materials, wholesale)
- financialCharges (bank charges, credit card fees)
- cisPaymentsToSubcontractors (construction subcontractors)
- businessEntertainmentCosts (client entertainment)
- interestOnBankOtherLoans (business loan interest)
- badDebt (irrecoverable debts)
- depreciation (equipment depreciation)
- other (other allowable business expenses)

INCOME:
- turnover (sales, fees, commission, business income)
- other (grants, insurance payouts, misc income)

INSTRUCTIONS:
- Analyze the transaction and determine the exact HMRC category
- If personal (groceries, personal items), respond "PERSONAL"
- Respond only with the exact category code
- Be definitive in your categorization`;
    }

    prompt += `

Response format: Return ONLY the category code (e.g., "travelCosts") or "PERSONAL"`;

    return prompt;
  }

  // ====== JSON OUTPUT ======

  /**
   * Generate categorized JSON file
   * @param {Array} categorizedTransactions - Processed transactions
   * @param {string} outputPath - Path to save JSON file
   * @param {Object} metadata - Additional metadata
   * @returns {Object} File generation result
   */
  async generateCategorizedJSON(categorizedTransactions, outputPath, metadata = {}) {
    try {
      const jsonData = {
        metadata: {
          generatedDate: new Date().toISOString(),
          taxYear: getCurrentTaxYear(),
          totalTransactions: categorizedTransactions.length,
          categorizedCount: categorizedTransactions.filter(t => t.hmrcCategory && !t.isPersonal).length,
          personalCount: categorizedTransactions.filter(t => t.isPersonal).length,
          errorCount: categorizedTransactions.filter(t => t.error).length,
          businessType: metadata.businessType || 'sole_trader',
          version: '1.0',
          ...metadata
        },
        transactions: categorizedTransactions.map(transaction => ({
          transactionId: transaction.transactionId,
          originalDescription: transaction.originalDescription,
          cleanedDescription: transaction.cleanedDescription,
          hmrcCategory: transaction.hmrcCategory,
          categoryDescription: transaction.categoryDescription,
          matchMethod: transaction.matchMethod,
          confidence: transaction.confidence,
          isPersonal: transaction.isPersonal,
          businessKeywords: transaction.businessKeywords || [],
          originalData: {
            date: transaction.originalData.date,
            amount: transaction.originalData.amount,
            type: transaction.originalData.type,
            reference: transaction.originalData.reference
          },
          processingDate: transaction.processingDate,
          error: transaction.error,
          errorCode: transaction.errorCode
        })),
        categorySummary: this._generateCategorySummary(categorizedTransactions),
        processingStats: this._generateProcessingStats(categorizedTransactions)
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
        transactionCount: categorizedTransactions.length,
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

  // ====== HELPER METHODS ======

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
   * Validate transaction data
   * @private
   */
  _validateTransactionData(transaction) {
    if (!transaction || typeof transaction !== 'object') {
      return {
        isValid: false,
        error: 'Transaction must be an object',
        errors: [createFieldError('transaction', 'Transaction is required')]
      };
    }

    const errors = [];

    // Validate description
    const descResult = validateTransactionDescription(transaction.description);
    if (!descResult.isValid) {
      errors.push(createFieldError('description', descResult.error, descResult.code));
    }

    // Amount is optional for categorization but if present should be valid
    if (transaction.amount !== undefined && transaction.amount !== null) {
      if (typeof transaction.amount !== 'number' || isNaN(transaction.amount)) {
        errors.push(createFieldError('amount', 'Amount must be a valid number'));
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if transaction appears to be personal
   * @private
   */
  _checkForPersonalTransaction(description) {
    const lowerDesc = description.toLowerCase();
    const foundIndicators = [];

    for (const indicator of this.config.personalIndicators) {
      if (lowerDesc.includes(indicator.toLowerCase())) {
        foundIndicators.push(indicator);
      }
    }

    return {
      isPersonal: foundIndicators.length > 0,
      confidence: Math.min(0.9, foundIndicators.length * 0.3),
      indicators: foundIndicators
    };
  }

  /**
   * Get valid categories for business type
   * @private
   */
  _getValidCategoriesForBusinessType(businessType) {
    const categories = businessType === 'landlord' 
      ? this.config.hmrcCategories.property
      : this.config.hmrcCategories.selfEmployment;

    return [
      ...Object.keys(categories.expenses || {}),
      ...Object.keys(categories.income || {})
    ];
  }

  /**
   * Get category data for a specific category and business type
   * @private
   */
  _getCategoryData(categoryCode, businessType) {
    const categories = businessType === 'landlord' 
      ? this.config.hmrcCategories.property
      : this.config.hmrcCategories.selfEmployment;

    return categories.expenses?.[categoryCode] || 
           categories.income?.[categoryCode] || 
           null;
  }

  /**
   * Generate category summary for JSON output
   * @private
   */
  _generateCategorySummary(transactions) {
    const summary = {};
    
    transactions.forEach(transaction => {
      if (transaction.hmrcCategory && !transaction.isPersonal) {
        if (!summary[transaction.hmrcCategory]) {
          summary[transaction.hmrcCategory] = {
            count: 0,
            description: transaction.categoryDescription,
            totalAmount: 0,
            averageConfidence: 0
          };
        }
        
        summary[transaction.hmrcCategory].count++;
        if (transaction.originalData?.amount) {
          summary[transaction.hmrcCategory].totalAmount += Math.abs(transaction.originalData.amount);
        }
        if (transaction.confidence) {
          summary[transaction.hmrcCategory].averageConfidence += transaction.confidence;
        }
      }
    });

    // Calculate averages
    Object.keys(summary).forEach(category => {
      if (summary[category].count > 0) {
        summary[category].averageConfidence = 
          summary[category].averageConfidence / summary[category].count;
      }
    });

    return summary;
  }

  /**
   * Generate processing statistics
   * @private
   */
  _generateProcessingStats(transactions) {
    const stats = {
      totalProcessed: transactions.length,
      successful: 0,
      personal: 0,
      errors: 0,
      methodBreakdown: {
        advanced: 0,
        keyword_match: 0,
        keyword_fallback: 0,
        keyword_default: 0,
        personal_excluded: 0,
        error: 0
      },
      averageConfidence: 0,
      confidenceDistribution: {
        high: 0,    // > 0.8
        medium: 0,  // 0.5 - 0.8
        low: 0      // < 0.5
      }
    };

    let totalConfidence = 0;
    let confidenceCount = 0;

    transactions.forEach(transaction => {
      if (transaction.error) {
        stats.errors++;
      } else if (transaction.isPersonal) {
        stats.personal++;
      } else {
        stats.successful++;
      }

      // Method breakdown
      if (stats.methodBreakdown.hasOwnProperty(transaction.matchMethod)) {
        stats.methodBreakdown[transaction.matchMethod]++;
      }

      // Confidence tracking
      if (transaction.confidence !== undefined && transaction.confidence !== null) {
        totalConfidence += transaction.confidence;
        confidenceCount++;

        if (transaction.confidence > 0.8) {
          stats.confidenceDistribution.high++;
        } else if (transaction.confidence >= 0.5) {
          stats.confidenceDistribution.medium++;
        } else {
          stats.confidenceDistribution.low++;
        }
      }
    });

    stats.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    return stats;
  }

  /**
   * Add delay for rate limiting
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all available HMRC categories for a business type
   * @param {string} businessType - 'sole_trader' or 'landlord'
   * @returns {Object} Available categories with descriptions
   */
  getAvailableCategories(businessType = 'sole_trader') {
    this._validateBusinessType(businessType);
    
    const categories = businessType === 'landlord' 
      ? this.config.hmrcCategories.property
      : this.config.hmrcCategories.selfEmployment;

    return {
      businessType,
      expenses: categories.expenses || {},
      income: categories.income || {}
    };
  }

  /**
   * Get configuration for external access
   * @returns {Object} Public configuration
   */
  getConfig() {
    return {
      allowedBusinessTypes: [...this.config.allowedBusinessTypes],
      errorCodes: { ...this.config.errorCodes },
      personalIndicators: [...this.config.personalIndicators]
    };
  }
}

// Create singleton instance
const categorizationUtil = new CategorizationUtil();

// Export both the class and instance
module.exports = {
  CategorizationUtil,
  default: categorizationUtil,
  
  // Export commonly used functions directly
  categorizeTransaction: (transaction, businessType) => 
    categorizationUtil.categorizeTransaction(transaction, businessType),
  categorizeTransactionBatch: (transactions, businessType, progressCallback) => 
    categorizationUtil.categorizeTransactionBatch(transactions, businessType, progressCallback),
  cleanDescription: (description) => 
    categorizationUtil.cleanDescription(description),
  extractBusinessKeywords: (description) => 
    categorizationUtil.extractBusinessKeywords(description),
  generateCategorizedJSON: (transactions, outputPath, metadata) => 
    categorizationUtil.generateCategorizedJSON(transactions, outputPath, metadata),
  getAvailableCategories: (businessType) => 
    categorizationUtil.getAvailableCategories(businessType),
  getConfig: () => 
    categorizationUtil.getConfig()
};