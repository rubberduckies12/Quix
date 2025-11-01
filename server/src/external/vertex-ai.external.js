const { AppError } = require('../utils/errors.util');
const { getCurrentTaxYear } = require('../utils/date.util');

/**
 * Vertex AI External Service
 * Handles all AI interactions for MTD Tax Bridge using Google AI Platform
 */
class VertexAIService {
  constructor() {
    this.config = {
      // Model configuration
      model: {
        name: 'gemini-2.0-flash-exp', // Using latest Gemini model
        temperature: 0.1, // Low temperature for consistent tax categorization
        maxTokens: 4096,
        topP: 0.8
      },
      
      // API configuration
      api: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: process.env.VERTEX_KEY,
        timeout: 30000
      },
      
      // Rate limiting
      rateLimiting: {
        requestsPerMinute: 60,
        requestsPerHour: 1000
      },

      // Error codes
      errorCodes: {
        API_KEY_MISSING: 'API_KEY_MISSING',
        RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
        MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
        INVALID_RESPONSE: 'INVALID_RESPONSE',
        QUOTA_EXCEEDED: 'QUOTA_EXCEEDED'
      }
    };

    // Initialize rate limiting tracking
    this.rateLimitTracker = {
      requests: [],
      lastHourRequests: []
    };

    // Check API key
    this._initializeClient();
  }

  /**
   * Initialize Vertex AI client
   * @private
   */
  _initializeClient() {
    if (!this.config.api.apiKey) {
      console.warn('VERTEX_KEY not found in environment - AI features will be simulated');
      this.isSimulationMode = true;
      return;
    }

    this.isSimulationMode = false;
    console.log('Vertex AI client initialized with API key');
  }

  /**
   * Categorize a single transaction using AI
   * @param {string} prompt - Categorization prompt
   * @param {Object} options - Request options
   * @returns {string} HMRC category code
   */
  async categorizeTransaction(prompt, options = {}) {
    try {
      this._checkRateLimit();
      
      if (this.isSimulationMode) {
        return this._simulateCategorizationResponse(prompt);
      }

      const response = await this._makeAIRequest(prompt, {
        ...options,
        requestType: 'categorization'
      });

      this._trackRequest();
      return this._extractCategorizationResult(response);

    } catch (error) {
      console.error('Transaction categorization failed:', error.message);
      throw new AppError(
        `AI categorization failed: ${error.message}`,
        500,
        this.config.errorCodes.INVALID_RESPONSE
      );
    }
  }

  /**
   * Format categorized data for quarterly submission
   * @param {string} prompt - Quarterly formatting prompt
   * @param {Object} options - Request options
   * @returns {string} Formatted quarterly JSON
   */
  async formatQuarterlySubmission(prompt, options = {}) {
    try {
      this._checkRateLimit();
      
      if (this.isSimulationMode) {
        return this._simulateQuarterlyResponse(prompt, options);
      }

      const response = await this._makeAIRequest(prompt, {
        ...options,
        requestType: 'quarterly'
      });

      this._trackRequest();
      return response;

    } catch (error) {
      console.error('Quarterly formatting failed:', error.message);
      throw new AppError(
        `AI quarterly formatting failed: ${error.message}`,
        500,
        this.config.errorCodes.INVALID_RESPONSE
      );
    }
  }

  /**
   * Analyze transactions for capital allowances
   * @param {string} prompt - Capital allowance analysis prompt
   * @param {Object} options - Request options
   * @returns {string} Capital allowance analysis JSON
   */
  async analyzeCapitalAllowances(prompt, options = {}) {
    try {
      this._checkRateLimit();
      
      if (this.isSimulationMode) {
        return this._simulateCapitalAllowanceResponse(prompt, options);
      }

      const response = await this._makeAIRequest(prompt, {
        ...options,
        requestType: 'capital_allowance'
      });

      this._trackRequest();
      return response;

    } catch (error) {
      console.error('Capital allowance analysis failed:', error.message);
      throw new AppError(
        `AI capital allowance analysis failed: ${error.message}`,
        500,
        this.config.errorCodes.INVALID_RESPONSE
      );
    }
  }

  /**
   * Format annual declaration
   * @param {string} prompt - Annual declaration prompt
   * @param {Object} options - Request options
   * @returns {string} Annual declaration JSON
   */
  async formatAnnualDeclaration(prompt, options = {}) {
    try {
      this._checkRateLimit();
      
      if (this.isSimulationMode) {
        return this._simulateAnnualDeclarationResponse(prompt, options);
      }

      const response = await this._makeAIRequest(prompt, {
        ...options,
        requestType: 'annual'
      });

      this._trackRequest();
      return response;

    } catch (error) {
      console.error('Annual declaration formatting failed:', error.message);
      throw new AppError(
        `AI annual declaration formatting failed: ${error.message}`,
        500,
        this.config.errorCodes.INVALID_RESPONSE
      );
    }
  }

  /**
   * Make AI request to Google AI Platform
   * @private
   */
  async _makeAIRequest(prompt, options = {}) {
    try {
      const url = `${this.config.api.baseUrl}/models/${this.config.model.name}:generateContent?key=${this.config.api.apiKey}`;
      
      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: this.config.model.temperature,
          topP: this.config.model.topP,
          maxOutputTokens: this.config.model.maxTokens
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.api.timeout)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429) {
          throw new AppError(
            'Rate limit exceeded for AI service',
            429,
            this.config.errorCodes.RATE_LIMIT_EXCEEDED
          );
        } else if (response.status === 403) {
          throw new AppError(
            'AI service quota exceeded or invalid API key',
            403,
            this.config.errorCodes.QUOTA_EXCEEDED
          );
        } else {
          throw new AppError(
            `AI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`,
            response.status,
            this.config.errorCodes.MODEL_UNAVAILABLE
          );
        }
      }

      const data = await response.json();
      
      // Extract text from Google AI Platform response structure
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Invalid response structure from AI API');
      }

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      if (error.name === 'AbortError') {
        throw new AppError(
          'AI request timeout',
          408,
          this.config.errorCodes.MODEL_UNAVAILABLE
        );
      }
      
      throw new AppError(
        `AI service error: ${error.message}`,
        500,
        this.config.errorCodes.MODEL_UNAVAILABLE
      );
    }
  }

  /**
   * Extract categorization result from AI response
   * @private
   */
  _extractCategorizationResult(response) {
    return response.trim();
  }

  // ====== SIMULATION METHODS (FALLBACK) ======

  /**
   * Simulate categorization response
   * @private
   */
  _simulateCategorizationResponse(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Simple keyword-based simulation for development
    if (lowerPrompt.includes('hotel') || lowerPrompt.includes('travel')) {
      return 'travelCosts';
    } else if (lowerPrompt.includes('accountant') || lowerPrompt.includes('solicitor')) {
      return 'professionalFees';
    } else if (lowerPrompt.includes('rent') || lowerPrompt.includes('office')) {
      return 'premisesRunningCosts';
    } else if (lowerPrompt.includes('stationery') || lowerPrompt.includes('phone')) {
      return 'adminCosts';
    } else if (lowerPrompt.includes('laptop') || lowerPrompt.includes('computer')) {
      return 'other';
    } else if (lowerPrompt.includes('advertising') || lowerPrompt.includes('marketing')) {
      return 'advertisingCosts';
    } else if (lowerPrompt.includes('tesco') || lowerPrompt.includes('personal')) {
      return 'PERSONAL';
    } else {
      return 'other';
    }
  }

  /**
   * Simulate quarterly response
   * @private
   */
  _simulateQuarterlyResponse(prompt, options) {
    const businessType = options.businessType || 'sole_trader';
    
    if (businessType === 'landlord') {
      return JSON.stringify({
        income: {
          premiumsOfLeaseGrant: 0.00,
          reversePremiums: 0.00,
          periodAmount: 2400.00,
          taxDeducted: 0.00
        },
        expenses: {
          premisesRunningCosts: 200.00,
          repairsAndMaintenance: 400.00,
          financialCosts: 800.00,
          professionalFees: 300.00,
          costOfServices: 150.00,
          travelCosts: 100.00,
          other: 200.00
        },
        summary: {
          totalIncome: 2400.00,
          totalExpenses: 2150.00,
          netProfitLoss: 250.00
        }
      });
    } else {
      return JSON.stringify({
        income: {
          turnover: 15000.00,
          other: 500.00
        },
        expenses: {
          costOfGoodsBought: 3000.00,
          cisPaymentsToSubcontractors: 0.00,
          staffCosts: 2000.00,
          travelCosts: 800.00,
          premisesRunningCosts: 1200.00,
          maintenanceCosts: 300.00,
          adminCosts: 400.00,
          advertisingCosts: 600.00,
          businessEntertainmentCosts: 200.00,
          interestOnBankOtherLoans: 150.00,
          financialCharges: 50.00,
          badDebt: 0.00,
          professionalFees: 500.00,
          other: 300.00
        },
        summary: {
          totalIncome: 15500.00,
          totalExpenses: 9500.00,
          netProfitLoss: 6000.00
        }
      });
    }
  }

  /**
   * Simulate capital allowance response
   * @private
   */
  _simulateCapitalAllowanceResponse(prompt, options) {
    return JSON.stringify({
      capitalAllowanceItems: [
        {
          transactionId: "txn_demo_1",
          description: "Laptop Dell XPS",
          amount: 1500.00,
          allowanceType: "annualInvestmentAllowance",
          allowanceRate: 1.00,
          recommendedAllowance: 1500.00,
          reasoning: "Business computer equipment qualifies for 100% AIA"
        }
      ],
      totalsByCategory: {
        annualInvestmentAllowance: 1500.00,
        capitalAllowanceMainPool: 0.00,
        capitalAllowanceSpecialRatePool: 0.00,
        zeroEmissionGoodsVehicle: 0.00,
        businessPremisesRenovationAllowance: 0.00,
        enhancedCapitalAllowance: 0.00,
        allowanceOnSales: 0.00
      },
      manualReviewRequired: []
    });
  }

  /**
   * Simulate annual declaration response
   * @private
   */
  _simulateAnnualDeclarationResponse(prompt, options) {
    const businessType = options.businessType || 'sole_trader';
    
    if (businessType === 'landlord') {
      return JSON.stringify({
        quarterlyDataComplete: true,
        adjustments: {
          privateUseAdjustment: 0.00,
          balancingCharge: 0.00,
          periodOfGraceAdjustment: 0.00,
          propertyIncomeAllowance: 1000.00,
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
          totalAnnualIncome: 9600.00,
          totalAnnualExpenses: 8600.00,
          totalCapitalAllowances: 0.00,
          totalAdjustments: 1000.00,
          netProfitBeforeAllowances: 1000.00,
          netProfitAfterAllowances: 0.00
        }
      });
    } else {
      return JSON.stringify({
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
          annualInvestmentAllowance: 1500.00,
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
          totalAnnualIncome: 62000.00,
          totalAnnualExpenses: 38000.00,
          totalCapitalAllowances: 1500.00,
          totalAdjustments: 0.00,
          netProfitBeforeAllowances: 24000.00,
          netProfitAfterAllowances: 22500.00
        }
      });
    }
  }

  // ====== UTILITY METHODS ======

  /**
   * Check rate limiting
   * @private
   */
  _checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    // Clean old requests
    this.rateLimitTracker.requests = this.rateLimitTracker.requests.filter(
      timestamp => timestamp > oneMinuteAgo
    );
    this.rateLimitTracker.lastHourRequests = this.rateLimitTracker.lastHourRequests.filter(
      timestamp => timestamp > oneHourAgo
    );

    // Check limits
    if (this.rateLimitTracker.requests.length >= this.config.rateLimiting.requestsPerMinute) {
      throw new AppError(
        'Rate limit exceeded: too many requests per minute',
        429,
        this.config.errorCodes.RATE_LIMIT_EXCEEDED
      );
    }

    if (this.rateLimitTracker.lastHourRequests.length >= this.config.rateLimiting.requestsPerHour) {
      throw new AppError(
        'Rate limit exceeded: too many requests per hour',
        429,
        this.config.errorCodes.RATE_LIMIT_EXCEEDED
      );
    }
  }

  /**
   * Track successful request
   * @private
   */
  _trackRequest() {
    const now = Date.now();
    this.rateLimitTracker.requests.push(now);
    this.rateLimitTracker.lastHourRequests.push(now);
  }

  /**
   * Add delay
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ====== PUBLIC API METHODS ======

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      isAvailable: !this.isSimulationMode,
      simulationMode: this.isSimulationMode,
      model: this.config.model.name,
      rateLimits: this.config.rateLimiting,
      currentRequests: {
        lastMinute: this.rateLimitTracker.requests.length,
        lastHour: this.rateLimitTracker.lastHourRequests.length
      }
    };
  }

  /**
   * Clear rate limit tracking (for testing)
   */
  clearRateLimitTracking() {
    this.rateLimitTracker.requests = [];
    this.rateLimitTracker.lastHourRequests = [];
  }
}

// Create and export singleton instance
const vertexAIService = new VertexAIService();

module.exports = {
  VertexAIService,
  default: vertexAIService,
  
  // Export main methods
  categorizeTransaction: (prompt, options) => 
    vertexAIService.categorizeTransaction(prompt, options),
  formatQuarterlySubmission: (prompt, options) => 
    vertexAIService.formatQuarterlySubmission(prompt, options),
  analyzeCapitalAllowances: (prompt, options) => 
    vertexAIService.analyzeCapitalAllowances(prompt, options),
  formatAnnualDeclaration: (prompt, options) => 
    vertexAIService.formatAnnualDeclaration(prompt, options),
  getStatus: () => 
    vertexAIService.getStatus()
};