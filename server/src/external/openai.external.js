const { AppError } = require('../utils/errors.util');

/**
 * OpenAI API Service for Transaction Categorization
 * Connects to OpenAI GPT-4 API for intelligent transaction analysis
 */
class OpenAIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseURL = 'https://api.openai.com/v1';
    this.model = process.env.OPENAI_MODEL || 'gpt-4';
    
    // Check if we have a real API key (starts with sk-)
    if (!this.apiKey || !this.apiKey.startsWith('sk-')) {
      console.warn('OPENAI_API_KEY not found or invalid - using simple categorization');
      this.mockMode = true;
    } else {
      this.mockMode = false;
      console.log('✅ OpenAI service initialized with API key');
    }

    // Rate limiting and retry configuration
    this.config = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      timeout: 30000,
      maxTokens: 150,
      temperature: 0.1
    };
  }

  /**
   * Categorize a single transaction using OpenAI GPT-4
   */
  async categorizeTransaction(prompt, options = {}) {
    console.log('📤 OpenAI categorizeTransaction called with:', {
      promptLength: prompt?.length || 0,
      options,
      mockMode: this.mockMode
    });

    if (this.mockMode) {
      console.log('🔄 Using mock mode - generating simulated response');
      return this._getMockResponse(prompt);
    }

    const requestOptions = {
      businessType: options.businessType || 'sole_trader',
      timeout: options.timeout || this.config.timeout,
      maxRetries: options.maxRetries || this.config.maxRetries
    };

    return this._makeRequest(prompt, requestOptions);
  }

  /**
   * Make actual API request to OpenAI
   */
  async _makeRequest(prompt, options) {
    console.log('🔗 Making OpenAI API request...');
    let lastError;
    
    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        console.log(`OpenAI API attempt ${attempt}/${options.maxRetries}`);
        
        const response = await this._sendRequest(prompt, options);
        
        if (response && response.choices && response.choices[0]) {
          const result = response.choices[0].message.content.trim();
          console.log(`✅ OpenAI categorization successful: "${result}"`);
          return result;
        } else {
          throw new Error('Invalid response format from OpenAI');
        }

      } catch (error) {
        lastError = error;
        console.error(`❌ OpenAI attempt ${attempt} failed:`, error.message);
        
        // Don't retry on certain errors
        if (this._isNonRetryableError(error)) {
          throw error;
        }
        
        // Exponential backoff for retries
        if (attempt < options.maxRetries) {
          const delay = Math.min(
            this.config.baseDelay * Math.pow(2, attempt - 1),
            this.config.maxDelay
          );
          console.log(`Retrying in ${delay}ms...`);
          await this._delay(delay);
        }
      }
    }

    throw new AppError(
      `OpenAI categorization failed after ${options.maxRetries} attempts: ${lastError.message}`,
      500,
      'OPENAI_SERVICE_ERROR'
    );
  }

  /**
   * Send HTTP request to OpenAI API
   */
  async _sendRequest(prompt, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      console.log('📡 Sending request to OpenAI API...');
      
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'QuixMTD/1.0'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert UK tax advisor specializing in HMRC Making Tax Digital categorization. You provide precise, single-word category responses based on HMRC guidelines.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ OpenAI API error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('📥 OpenAI API response received successfully');
      return result;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`OpenAI request timeout after ${options.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Check if error should not be retried
   */
  _isNonRetryableError(error) {
    const nonRetryablePatterns = [
      'authentication',
      'authorization', 
      'invalid_api_key',
      'model_not_found',
      'insufficient_quota'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return nonRetryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Generate mock response for testing without API key
   */
  _getMockResponse(prompt) {
    console.log('🔄 OpenAI simple categorization - analyzing transaction');
    
    // Extract key info from prompt for smart categorization
    const promptLower = prompt.toLowerCase();
    
    // Look for amount to help with categorization
    const amountMatch = prompt.match(/£(\d+)/);
    const amount = amountMatch ? parseInt(amountMatch[1]) : 0;
    
    // Box-based categorization for tax return data
    if (promptLower.includes('box 1') || promptLower.includes('sales') || promptLower.includes('turnover')) {
      console.log('✅ Categorized as: turnover');
      return 'turnover';
    }
    
    if (promptLower.includes('box 2') || promptLower.includes('other business income')) {
      console.log('✅ Categorized as: other');
      return 'other';
    }
    
    if (promptLower.includes('box 3') || promptLower.includes('cost of goods')) {
      console.log('✅ Categorized as: costOfGoodsBought');
      return 'costOfGoodsBought';
    }
    
    if (promptLower.includes('box 4') || promptLower.includes('construction industry scheme')) {
      console.log('✅ Categorized as: cisPaymentsToSubcontractors');
      return 'cisPaymentsToSubcontractors';
    }
    
    if (promptLower.includes('box 5') || promptLower.includes('staff costs') || promptLower.includes('wages')) {
      console.log('✅ Categorized as: staffCosts');
      return 'staffCosts';
    }
    
    if (promptLower.includes('box 6') || promptLower.includes('travel costs') || 
        promptLower.includes('hotel') || promptLower.includes('fuel') || promptLower.includes('petrol')) {
      console.log('✅ Categorized as: travelCosts');
      return 'travelCosts';
    }
    
    if (promptLower.includes('box 7') || promptLower.includes('premises running costs') ||
        promptLower.includes('rent') || promptLower.includes('electricity') || 
        promptLower.includes('utilities') || promptLower.includes('gas')) {
      console.log('✅ Categorized as: premisesRunningCosts');
      return 'premisesRunningCosts';
    }
    
    if (promptLower.includes('box 8') || promptLower.includes('repairs and maintenance')) {
      console.log('✅ Categorized as: repairsAndMaintenance');
      return 'repairsAndMaintenance';
    }
    
    if (promptLower.includes('box 9') || promptLower.includes('office') || 
        promptLower.includes('supplies') || promptLower.includes('stationery') || promptLower.includes('paper')) {
      console.log('✅ Categorized as: adminCosts');
      return 'adminCosts';
    }
    
    if (promptLower.includes('box 10') || promptLower.includes('advertising') || 
        promptLower.includes('marketing') || promptLower.includes('website') || promptLower.includes('google')) {
      console.log('✅ Categorized as: advertisingCosts');
      return 'advertisingCosts';
    }
    
    if (promptLower.includes('box 11') || promptLower.includes('interest on bank')) {
      console.log('✅ Categorized as: interestOnBankOtherLoans');
      return 'interestOnBankOtherLoans';
    }
    
    if (promptLower.includes('box 12') || promptLower.includes('financial charges')) {
      console.log('✅ Categorized as: financialCharges');
      return 'financialCharges';
    }
    
    if (promptLower.includes('box 13') || promptLower.includes('bad debt')) {
      console.log('✅ Categorized as: badDebt');
      return 'badDebt';
    }
    
    if (promptLower.includes('box 14') || promptLower.includes('professional fees') ||
        promptLower.includes('accountant') || promptLower.includes('legal') || 
        promptLower.includes('consultant') || promptLower.includes('lawyer')) {
      console.log('✅ Categorized as: professionalFees');
      return 'professionalFees';
    }
    
    if (promptLower.includes('box 15') || promptLower.includes('depreciation')) {
      console.log('✅ Categorized as: depreciation');
      return 'depreciation';
    }
    
    if (promptLower.includes('box 16') || promptLower.includes('other business expenses')) {
      console.log('✅ Categorized as: other');
      return 'other';
    }
    
    // General categorization rules
    if (promptLower.includes('accountant') || promptLower.includes('legal') || promptLower.includes('consultant') || promptLower.includes('lawyer')) {
      console.log('✅ Categorized as: professionalFees');
      return 'professionalFees';
    }
    
    if (promptLower.includes('office') || promptLower.includes('supplies') || promptLower.includes('stationery') || promptLower.includes('paper')) {
      console.log('✅ Categorized as: adminCosts');
      return 'adminCosts';
    }
    
    if (promptLower.includes('advertising') || promptLower.includes('marketing') || promptLower.includes('website') || promptLower.includes('google')) {
      console.log('✅ Categorized as: advertisingCosts');
      return 'advertisingCosts';
    }
    
    // Check for personal transactions
    if (promptLower.includes('tesco') || promptLower.includes('grocery') || promptLower.includes('supermarket') || 
        promptLower.includes('personal') || promptLower.includes('sainsbury') || promptLower.includes('asda')) {
      console.log('✅ Categorized as: PERSONAL');
      return 'PERSONAL';
    }
    
    // Business type specific categorization
    if (promptLower.includes('landlord') || promptLower.includes('property rental')) {
      if (promptLower.includes('repair') || promptLower.includes('maintenance')) {
        console.log('✅ Categorized as: repairsAndMaintenance');
        return 'repairsAndMaintenance';
      }
      if (amount > 0 || promptLower.includes('rental') || promptLower.includes('income')) {
        console.log('✅ Categorized as: periodAmount');
        return 'periodAmount';
      }
      console.log('✅ Categorized as: premisesRunningCosts');
      return 'premisesRunningCosts';
    }
    
    // Default categorization - if it mentions income/sales/revenue, categorize as income
    if (promptLower.includes('income') || promptLower.includes('sales') || 
        promptLower.includes('revenue') || promptLower.includes('turnover')) {
      console.log('✅ Categorized as: turnover (income)');
      return 'turnover';
    } else {
      console.log('✅ Categorized as: other (expense)');
      return 'other';
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      if (this.mockMode) {
        console.log('✅ OpenAI service in mock mode - connection test passed');
        return { success: true, mock: true };
      }

      const testPrompt = 'Test categorization for £10 office supplies expense.';
      const result = await this.categorizeTransaction(testPrompt, { maxRetries: 1 });
      
      console.log('✅ OpenAI connection test successful');
      return { success: true, model: this.model, response: result };
      
    } catch (error) {
      console.error('❌ OpenAI connection test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get service status and configuration
   */
  getStatus() {
    return {
      service: 'OpenAI',
      model: this.model,
      mockMode: this.mockMode,
      hasApiKey: !!this.apiKey,
      config: {
        maxRetries: this.config.maxRetries,
        timeout: this.config.timeout,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature
      }
    };
  }

  /**
   * Utility delay function
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const openAIService = new OpenAIService();

module.exports = openAIService;
module.exports.OpenAIService = OpenAIService;