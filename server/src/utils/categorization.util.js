const { AppError } = require('./errors.util');

/**
 * Transaction Categorization Utility with Direct OpenAI Processing
 * Processes each transaction line by line and maps to HMRC categories
 */
class CategorizationUtil {
  constructor() {
    // Direct OpenAI configuration
    this.openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4';
    this.openaiBaseUrl = 'https://api.openai.com/v1';
    
    console.log(`🔍 OpenAI API key found: ${this.openaiApiKey ? 'YES' : 'NO'}`);
    console.log(`🔍 Key valid format: ${this.openaiApiKey?.startsWith('sk-') ? 'YES' : 'NO'}`);
    
    if (!this.openaiApiKey || !this.openaiApiKey.startsWith('sk-')) {
      throw new Error('❌ Valid OpenAI API key required - no fallbacks allowed');
    }
    
    console.log('✅ OpenAI direct connection initialized - processing line by line');

    // Bind methods to ensure proper 'this' context
    this.processSpreadsheetLineByLine = this.processSpreadsheetLineByLine.bind(this);
    this._extractTransactionData = this._extractTransactionData.bind(this);
    this._categorizeTransactionWithAI = this._categorizeTransactionWithAI.bind(this);
    this._createTransactionPrompt = this._createTransactionPrompt.bind(this);
    this._getCategoryDescription = this._getCategoryDescription.bind(this);
  }

  /**
   * Process spreadsheet line by line through OpenAI
   */
  async processSpreadsheetLineByLine(rows, businessType, progressCallback) {
    console.log(`🚀 Processing ${rows.length} transactions line by line through OpenAI for ${businessType}`);

    const results = {
      totalRows: rows.length,
      processedTransactions: [],
      personalTransactions: [],
      errors: [],
      summary: {
        successful: 0,
        personal: 0,
        errors: 0,
        aiCategorized: 0
      },
      categoryTotals: {},
      processingDate: new Date().toISOString(),
      businessType
    };

    // Process each row individually
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const progress = Math.round(((i + 1) / rows.length) * 100);

      try {
        console.log(`\n📋 Processing row ${i + 1}/${rows.length}:`);
        console.log('Raw row data:', JSON.stringify(row, null, 2));

        // Extract transaction data
        const transactionData = this._extractTransactionData(row);
        console.log('Extracted transaction:', transactionData);

        if (transactionData.skip || (transactionData.amount === 0 && !transactionData.description)) {
          console.log('⚠️ Skipping empty/calculated row');
          continue;
        }

        // Get AI categorization for this specific transaction
        const categorization = await this._categorizeTransactionWithAI(transactionData, businessType);
        console.log('AI categorization result:', categorization);

        // Create transaction result
        const transactionResult = {
          success: true,
          originalRow: row,
          amount: transactionData.amount,
          description: transactionData.description,
          categorization: categorization,
          businessType,
          timestamp: new Date().toISOString()
        };

        if (categorization.category === 'PERSONAL') {
          results.personalTransactions.push(transactionResult);
          results.summary.personal++;
        } else {
          results.processedTransactions.push(transactionResult);
          results.summary.successful++;
          results.summary.aiCategorized++;

          // Add to category totals
          const category = categorization.category;
          if (!results.categoryTotals[category]) {
            results.categoryTotals[category] = 0;
          }
          results.categoryTotals[category] += transactionData.amount;
        }

        if (progressCallback) {
          progressCallback({
            stage: 'categorization',
            percentage: progress,
            stageDescription: `Processing transaction ${i + 1}/${rows.length} - ${categorization.category}`
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing row ${i + 1}:`, error.message);
        results.errors.push({
          success: false,
          error: error.message,
          originalRow: row,
          timestamp: new Date().toISOString()
        });
        results.summary.errors++;
      }
    }

    console.log('\n✅ Line-by-line processing complete!');
    console.log(`📊 Category Totals:`, results.categoryTotals);
    console.log(`📈 Summary: ${results.summary.successful} successful, ${results.summary.errors} errors`);

    // Create clean summary for frontend
    results.frontendSummary = this._createFrontendSummary(results.categoryTotals);
    console.log(`📋 Frontend Summary:`, results.frontendSummary);

    return results;
  }

  /**
   * Extract transaction data from a single row
   */
  _extractTransactionData(row) {
    let amount = 0;
    let description = '';

    // Skip calculated totals and empty rows
    if (this._isCalculatedTotal(row)) {
      console.log('⏭️ Skipping calculated total/summary row');
      return { amount: 0, description: '', skip: true };
    }

    // Extract Box number if present
    if (row.Box) {
      description = `Box ${row.Box}`;
    }

    // Find description and amount from all fields
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith('_') || !value) continue;

      // Try to extract amount
      if (typeof value === 'string' || typeof value === 'number') {
        const cleanValue = String(value).replace(/[£$,\s]/g, '');
        const numValue = parseFloat(cleanValue);
        if (!isNaN(numValue) && numValue > 0 && amount === 0) {
          amount = numValue;
        }

        // Build description from meaningful text (not n/a)
        if (typeof value === 'string' && value.trim() && key !== 'Box' && 
            !/^\s*[\d\.,£$-]+\s*$/.test(value) && 
            !value.toLowerCase().includes('n/a') &&
            !value.toLowerCase().includes('total') &&
            !value.toLowerCase().includes('taxable') &&
            !value.toLowerCase().includes('gross profit')) {
          if (description && !description.includes(value.trim())) {
            description += ` - ${value.trim()}`;
          } else if (!description) {
            description = value.trim();
          }
        }
      }
    }

    // Skip if no meaningful data or if it's n/a
    if (amount === 0 || description.toLowerCase().includes('n/a') || !description) {
      console.log('⏭️ Skipping empty or n/a row');
      return { amount: 0, description: '', skip: true };
    }

    return {
      amount: amount,
      description: description || 'Business transaction',
      skip: false
    };
  }

  /**
   * Check if row is a calculated total that should be ignored
   */
  _isCalculatedTotal(row) {
    const indicators = [
      'total allowances',
      'taxable =',
      'gross profit =',
      'total rent',
      'allowances',
      '= total rent',
      '- total allowances',
      '- res prop finance cost',
      'taxable',
      'gross profit',
      'net profit',
      'total expenses',
      'total income',
      'profit =',
      'loss =',
      'subtotal',
      'grand total'
    ];

    // Check all values in the row for calculation indicators
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase().trim();
        if (indicators.some(indicator => lowerValue.includes(indicator))) {
          console.log(`🚫 Detected calculated total: "${value}" - skipping row`);
          return true;
        }
      }
    }

    // Also skip rows with no Box number but have amounts (likely totals)
    if (!row.Box || row.Box === '') {
      // Check if it has an amount but no proper description
      let hasAmount = false;
      let hasDescription = false;
      
      for (const [key, value] of Object.entries(row)) {
        if (key.startsWith('_')) continue;
        
        // Check for amount
        if (value && !isNaN(parseFloat(String(value).replace(/[£$,\s]/g, '')))) {
          hasAmount = true;
        }
        
        // Check for meaningful description
        if (typeof value === 'string' && value.trim() && 
            !value.toLowerCase().includes('n/a') &&
            !/^\s*[\d\.,£$-]+\s*$/.test(value)) {
          hasDescription = true;
        }
      }
      
      if (hasAmount && !hasDescription) {
        console.log(`🚫 Detected total row (no Box, has amount, no description) - skipping`);
        return true;
      }
    }

    return false;
  }

  /**
   * Categorize a single transaction using OpenAI
   */
  async _categorizeTransactionWithAI(transactionData, businessType) {
    const prompt = this._createTransactionPrompt(transactionData, businessType);
    
    console.log(`🤖 Sending to OpenAI: £${transactionData.amount} - "${transactionData.description}"`);

    try {
      const response = await fetch(`${this.openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'QuixMTD/1.0'
        },
        body: JSON.stringify({
          model: this.openaiModel,
          messages: [
            {
              role: 'system',
              content: `You are an expert UK tax advisor for HMRC Making Tax Digital. Categorize transactions for ${businessType === 'landlord' ? 'property rental business' : 'sole trader business'}. Respond with JSON only: {"category": "category_name", "reasoning": "explanation", "confidence": 0.95}`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 150,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      const aiResponse = result.choices[0]?.message?.content?.trim();
      
      // Parse AI response
      let categoryData;
      try {
        categoryData = JSON.parse(aiResponse);
      } catch (parseError) {
        // If JSON parsing fails, extract category from text
        const categoryMatch = aiResponse.match(/category[":]\s*["']?(\w+)["']?/i);
        categoryData = {
          category: categoryMatch ? categoryMatch[1] : 'other',
          reasoning: 'AI response parsing fallback',
          confidence: 0.7
        };
      }

      console.log(`✅ AI categorized as: ${categoryData.category} (confidence: ${categoryData.confidence})`);

      return {
        category: categoryData.category || 'other',
        aiAnalysis: categoryData.reasoning || 'AI categorized transaction',
        categoryDescription: this._getCategoryDescription(categoryData.category || 'other'),
        confidence: categoryData.confidence || 0.8
      };

    } catch (error) {
      console.error('❌ OpenAI categorization failed:', error.message);
      throw error; // Re-throw to handle in main loop
    }
  }

  /**
   * Create prompt for individual transaction
   */
  _createTransactionPrompt(transactionData, businessType) {
    const businessContext = businessType === 'landlord' ? 'UK property rental business' : 'UK sole trader business';
    
    const categories = businessType === 'landlord' ? 
      'premiumsOfLeaseGrant, reversePremiums, periodAmount, taxDeducted, premisesRunningCosts, repairsAndMaintenance, financialCosts, professionalFees, costOfServices, travelCosts, other, PERSONAL' :
      'turnover, costOfGoodsBought, cisPaymentsToSubcontractors, staffCosts, travelCosts, premisesRunningCosts, maintenanceCosts, adminCosts, advertisingCosts, businessEntertainmentCosts, interestOnBankOtherLoans, financialCharges, badDebt, professionalFees, depreciation, other, PERSONAL';

    return `Categorize this ${businessContext} transaction for HMRC Making Tax Digital:

Amount: £${transactionData.amount}
Description: ${transactionData.description}

Available categories: ${categories}

Rules:
- Use "PERSONAL" for non-business transactions
- For property business: Box 20 = periodAmount (rental income), Box 44 = financialCosts, Box 24 = premisesRunningCosts, Box 25 = repairsAndMaintenance, Box 27 = professionalFees, Box 28 = costOfServices
- For sole trader: Income = turnover, Expenses = appropriate expense category

Respond with JSON: {"category": "exact_category_name", "reasoning": "why this category", "confidence": 0.95}`;
  }

  /**
   * Get category description
   */
  _getCategoryDescription(category) {
    const descriptions = {
      // Property categories
      'premiumsOfLeaseGrant': 'Property premiums received',
      'reversePremiums': 'Reverse premiums',
      'periodAmount': 'Rental income received',
      'taxDeducted': 'Tax deducted at source',
      'premisesRunningCosts': 'Rent, rates, insurance, ground rent',
      'repairsAndMaintenance': 'Maintenance, repairs, redecoration',
      'financialCosts': 'Mortgage interest, loan interest',
      'professionalFees': 'Letting agent fees, legal fees, accountant fees',
      'costOfServices': 'Gardening, cleaning, security services',
      
      // Business categories
      'turnover': 'Business sales, fees, commission, self-employment income',
      'costOfGoodsBought': 'Raw materials, stock, goods bought for resale',
      'cisPaymentsToSubcontractors': 'Construction Industry Scheme payments',
      'staffCosts': 'Wages, salaries, subcontractor payments, employer NICs',
      'travelCosts': 'Business travel, fuel, parking, hotels',
      'maintenanceCosts': 'Repairs and maintenance of property and equipment',
      'adminCosts': 'Phone, fax, stationery, postage, small equipment',
      'advertisingCosts': 'Advertising, marketing, website costs',
      'businessEntertainmentCosts': 'Entertaining clients, customer hospitality',
      'interestOnBankOtherLoans': 'Business loan interest, hire purchase interest',
      'financialCharges': 'Bank charges, credit card charges, factoring charges',
      'badDebt': 'Irrecoverable debts written off',
      'depreciation': 'Depreciation of equipment and machinery',
      'other': 'Other allowable business expenses',
      'PERSONAL': 'Personal transaction (excluded)'
    };
    return descriptions[category] || 'Other business expense';
  }

  /**
   * Create clean frontend summary with category totals
   */
  _createFrontendSummary(categoryTotals) {
    const summary = [];
    
    for (const [category, totalAmount] of Object.entries(categoryTotals)) {
      if (totalAmount > 0) {
        summary.push({
          category: category,
          categoryDescription: this._getCategoryDescription(category),
          totalAmount: totalAmount,
          formattedAmount: `£${totalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        });
      }
    }

    // Sort by amount (highest first)
    summary.sort((a, b) => b.totalAmount - a.totalAmount);

    return summary;
  }
}

// Create singleton instance
const categorizationUtil = new CategorizationUtil();

module.exports = categorizationUtil;