const { AppError } = require('./errors.util');

/**
 * Transaction Categorization Utility with Direct OpenAI Processing
 * Processes each transaction line by line and maps to HMRC categories
 */
class CategorizationUtil {
  constructor() {
    // Direct OpenAI configuration
    this.openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
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

        // Extract transaction data (can return multiple transactions for side-by-side columns)
        const extractedTransactions = this._extractTransactionData(row);
        console.log('Extracted transactions:', extractedTransactions);

        if (!extractedTransactions || extractedTransactions.length === 0) {
          console.log('⚠️ No transactions extracted from row');
          continue;
        }

        // Process each extracted transaction
        for (const transactionData of extractedTransactions) {
          if (transactionData.skip || (transactionData.amount === 0 && !transactionData.description)) {
            console.log('⚠️ Skipping empty/calculated transaction');
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

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        } // End inner transaction loop

        if (progressCallback) {
          progressCallback({
            stage: 'categorization',
            percentage: progress,
            stageDescription: `Processing row ${i + 1}/${rows.length}`
          });
        }

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
   * Extract transaction data from a single row - can return multiple transactions for side-by-side columns
   */
  _extractTransactionData(row) {
    const transactions = [];
    let boxNumber = '';

    // Skip calculated totals and empty rows
    if (this._isCalculatedTotal(row)) {
      console.log('⏭️ Skipping calculated total/summary row');
      return [{ amount: 0, description: '', skip: true }];
    }

    // Extract Box number first (for box-based spreadsheets)
    if (row.Box && row.Box.toString().trim()) {
      boxNumber = row.Box.toString().trim();
    }

    // Handle side-by-side Income/Expense columns
    const hasIncomeColumn = row.Income !== undefined && row.Income !== null && row.Income !== '';
    const hasExpenseColumn = row.Expense !== undefined && row.Expense !== null && row.Expense !== '';
    
    if (hasIncomeColumn || hasExpenseColumn) {
      // Check for Income amount
      if (hasIncomeColumn) {
        const cleanValue = String(row.Income).replace(/[£$,\s]/g, '');
        const numValue = parseFloat(cleanValue);
        if (!isNaN(numValue) && numValue > 0) {
          let description = 'Income transaction';
          
          // Get description from other columns
          if (row.Description && row.Description.toString().trim()) {
            description = `Income: ${row.Description.toString().trim()}`;
          } else if (row.rent && row.rent.toString().trim()) {
            description = `Income: ${row.rent.toString().trim()}`;
          } else if (boxNumber) {
            description = `Income: Box ${boxNumber}`;
          }
          
          transactions.push({
            amount: numValue,
            description: description,
            boxNumber: boxNumber,
            transactionType: 'income',
            skip: false
          });
        }
      }
      
      // Check for Expense amount (separate transaction)
      if (hasExpenseColumn) {
        // For expenses, the amount might be in different columns
        let expenseAmount = 0;
        let expenseDescription = '';
        
        // Try to get expense amount from Expense column first
        const expenseCleanValue = String(row.Expense).replace(/[£$,\s]/g, '');
        const expenseNumValue = parseFloat(expenseCleanValue);
        if (!isNaN(expenseNumValue) && expenseNumValue > 0) {
          expenseAmount = expenseNumValue;
          expenseDescription = 'Expense transaction';
        } else {
          // If Expense column has description, look for amount in other columns
          if (row.Expense && isNaN(parseFloat(row.Expense))) {
            expenseDescription = `Expense: ${row.Expense.toString().trim()}`;
            
            // Look for amount in Description or other numeric columns
            if (row.Description) {
              const descCleanValue = String(row.Description).replace(/[£$,\s]/g, '');
              const descNumValue = parseFloat(descCleanValue);
              if (!isNaN(descNumValue) && descNumValue > 0) {
                expenseAmount = descNumValue;
              }
            }
          }
        }
        
        if (expenseAmount > 0) {
          transactions.push({
            amount: expenseAmount,
            description: expenseDescription,
            boxNumber: boxNumber,
            transactionType: 'expense',
            skip: false
          });
        }
      }
    }

    
    // Fallback: single column format with direction indicators
    if (transactions.length === 0) {
      let amount = 0;
      let description = '';
      let transactionType = '';
      
      // Detect explicit direction column (e.g. 'in' which contains 'in' or 'out')
      for (const [key, value] of Object.entries(row)) {
        if (!key || typeof key !== 'string') continue;
        const lowerKey = key.toLowerCase().trim();
        if (['in', 'direction', 'in/out', 'in_out', 'flow'].includes(lowerKey)) {
          if (value && typeof value === 'string') {
            const lowerVal = value.toLowerCase().trim();
            if (lowerVal.includes('out') || lowerVal.includes('-') || lowerVal.includes('expense')) {
              transactionType = 'expense';
            } else if (lowerVal.includes('in') || lowerVal.includes('income') || lowerVal.includes('receipt')) {
              transactionType = 'income';
            }
          }
          break;
        }
      }

      // Find amount in unnamed column (original logic)
      for (const [key, value] of Object.entries(row)) {
        if (key.startsWith('_') || !value) continue;

        // The actual amounts are in the empty key column ""
        if (key === '' && value) {
          const cleanValue = String(value).replace(/[£$,\s]/g, '');
          const numValue = parseFloat(cleanValue);
          if (!isNaN(numValue) && numValue > 0) {
            amount = numValue;
            break; // Found the amount, stop looking
          }
        }
      }

      // Final fallback: try any numeric column
      if (amount === 0) {
        for (const [key, value] of Object.entries(row)) {
          if (key.startsWith('_') || key === 'Box' || !value) continue;
          
          const cleanValue = String(value).replace(/[£$,\s]/g, '');
          const numValue = parseFloat(cleanValue);
          if (!isNaN(numValue) && numValue > 0) {
            amount = numValue;
            
            // Try to find description in other columns
            if (!description) {
              for (const [descKey, descValue] of Object.entries(row)) {
                if (descKey !== key && descValue && !descKey.startsWith('_') && isNaN(parseFloat(descValue))) {
                  description = `${descKey}: ${descValue}`;
                  break;
                }
              }
            }
            break;
          }
        }
      }

      // If we detected a direction earlier but haven't set transactionType from amounts, try to infer
      if (!transactionType) {
        // If amount was found in what looked like an Income column, set income
        if (Object.keys(row).some(k => k && k.toLowerCase && k.toLowerCase().includes('income')) && row.Income) {
          transactionType = 'income';
        }
      }

      // Create single transaction if we found data
      if (amount > 0) {
        // Ensure we have some description
        if (!description) {
          description = transactionType || 'Transaction';
          if (boxNumber) {
            description = `Box ${boxNumber}`;
          }
        }

        transactions.push({
          amount: amount,
          description: description,
          boxNumber: boxNumber,
          transactionType: transactionType,
          skip: false
        });
      }
    }

    // If no transactions found, return skip marker
    if (transactions.length === 0) {
      console.log('⏭️ Skipping empty row');
      return [{ amount: 0, description: '', skip: true }];
    }

    // Log what we extracted
    transactions.forEach(txn => {
      console.log(`💰 Extracted: £${txn.amount} - ${txn.description} (${txn.transactionType || 'unknown'})`);
    });

    return transactions;
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
              content: `You are an expert UK tax advisor for HMRC Making Tax Digital. Categorize transactions for ${businessType === 'landlord' ? 'property rental business' : 'sole trader business'}. Respond with JSON only: {"category": "category_name", "type": "income_or_expense"}`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 100,
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
          type: 'expense'
        };
      }

      console.log(`✅ AI categorized as: ${categoryData.category} (${categoryData.type})`);

      // If we previously inferred transaction direction from the spreadsheet, prefer that
      if (transactionData.transactionType && categoryData.type && transactionData.transactionType !== categoryData.type) {
        console.log(`⚠️ Overriding AI type (${categoryData.type}) with extracted transaction type: ${transactionData.transactionType}`);
        categoryData.type = transactionData.transactionType;
      }

      return {
        category: categoryData.category || 'other',
        categoryDescription: this._getCategoryDescription(categoryData.category || 'other'),
        type: categoryData.type || 'expense'
      };

    } catch (error) {
      console.error('❌ OpenAI categorization failed:', error.message);
      throw error;
    }
  }

  /**
   * Create prompt for individual transaction
   */
  _createTransactionPrompt(transactionData, businessType) {
    const businessContext = businessType === 'landlord' ? 'UK property rental business' : 'UK sole trader business';
    
    const categories = businessType === 'landlord' ? 
      'periodAmount (income), financialCosts (expense), premisesRunningCosts (expense), repairsAndMaintenance (expense), professionalFees (expense), costOfServices (expense), other (expense)' :
      'turnover (income), costOfGoodsBought (expense), staffCosts (expense), travelCosts (expense), premisesRunningCosts (expense), adminCosts (expense), professionalFees (expense), other (expense)';

  return `Categorize this ${businessContext} transaction for HMRC:

Amount: £${transactionData.amount}
Description: ${transactionData.description}
Direction: ${transactionData.transactionType || 'unknown'}

Available categories: ${categories}

Rules for property business:
- Box 20 = periodAmount (rental income)
- Box 44 = financialCosts (mortgage interest, loan costs)
- Box 24 = premisesRunningCosts (rent, rates, insurance)
- Box 25 = repairsAndMaintenance (property repairs)
- Box 27 = professionalFees (legal, management fees)
- Box 28 = costOfServices (gardening, cleaning)
- Box 29 = other (other allowable expenses)

Respond with JSON: {"category": "exact_category_name", "type": "income_or_expense"}`;
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
          type: this._getCategoryType(category),
          totalAmount: totalAmount,
          formattedAmount: `£${totalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        });
      }
    }

    // Sort by amount (highest first)
    summary.sort((a, b) => b.totalAmount - a.totalAmount);

    return summary;
  }

  /**
   * Get category type (income/expense)
   */
  _getCategoryType(category) {
    const incomeCategories = ['periodAmount', 'turnover', 'premiumsOfLeaseGrant'];
    return incomeCategories.includes(category) ? 'income' : 'expense';
  }
}

// Create singleton instance
var categorizationUtil = new CategorizationUtil();

module.exports = categorizationUtil;