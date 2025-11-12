/**
 * Quarterly Same Sheet Separately Defined Utility
 * 
 * Handles "same spreadsheet with separated quarters" type quarterly submissions.
 * 
 * This is for spreadsheets where the user has multiple sections/tables within 
 * one file, with each quarter explicitly labeled (e.g., "QUARTER 1", "QUARTER 2", etc.).
 * 
 * Uses OpenAI to read the entire spreadsheet and extract the target quarter's data.
 * 
 * Example spreadsheet structure:
 * 
 * QUARTER 1
 * Box | Description                           | Amount
 * 20  | Total rents and other income         | £10,000
 * 24  | Rent, rates, insurance               | £500
 * ...
 * 
 * QUARTER 2
 * Box | Description                           | Amount
 * 20  | Total rents and other income         | £12,000
 * 24  | Rent, rates, insurance               | £550
 * ...
 */

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPEN_AI_KEY || process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// HMRC Category definitions (matching categorization.util.js)
const CATEGORY_DESCRIPTIONS = {
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

const INCOME_CATEGORIES = ['periodAmount', 'turnover', 'premiumsOfLeaseGrant', 'reversePremiums'];

/**
 * Detect quarter section boundaries in the spreadsheet
 * Looks for rows containing quarter labels like "QUARTER 1", "Q2", "Quarter 3", etc.
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @returns {Object} - Map of quarters to their start/end row indices
 */
function detectQuarterSections(rawRows) {
  console.log(`\n🔍 Detecting quarter sections in spreadsheet...`);
  console.log(`   Total rows to scan: ${rawRows.length}`);

  const quarterSections = {
    q1: null,
    q2: null,
    q3: null,
    q4: null
  };

  const quarterPatterns = [
    { pattern: /QUARTER\s*1|Q\s*1|Quarter\s*1/i, quarter: 'q1' },
    { pattern: /QUARTER\s*2|Q\s*2|Quarter\s*2/i, quarter: 'q2' },
    { pattern: /QUARTER\s*3|Q\s*3|Quarter\s*3/i, quarter: 'q3' },
    { pattern: /QUARTER\s*4|Q\s*4|Quarter\s*4/i, quarter: 'q4' }
  ];

  const sectionBoundaries = [];

  rawRows.forEach((row, index) => {
    // Check all values in the row for quarter labels
    const rowValues = Object.values(row).filter(val => val !== null && val !== undefined);
    const rowText = rowValues.join(' ').toString();

    for (const { pattern, quarter } of quarterPatterns) {
      if (pattern.test(rowText)) {
        console.log(`   ✓ Found ${quarter.toUpperCase()} at row ${index + 1}: "${rowText}"`);
        sectionBoundaries.push({ quarter, startRow: index });
        break;
      }
    }
  });

  // Calculate end rows for each section
  sectionBoundaries.forEach((section, index) => {
    const nextSection = sectionBoundaries[index + 1];
    section.endRow = nextSection ? nextSection.startRow - 1 : rawRows.length - 1;
    
    quarterSections[section.quarter] = {
      startRow: section.startRow,
      endRow: section.endRow,
      rowCount: section.endRow - section.startRow + 1
    };
  });

  console.log(`\n📊 Quarter sections detected:`);
  Object.entries(quarterSections).forEach(([quarter, section]) => {
    if (section) {
      console.log(`   ${quarter.toUpperCase()}: rows ${section.startRow + 1}-${section.endRow + 1} (${section.rowCount} rows)`);
    } else {
      console.log(`   ${quarter.toUpperCase()}: not found`);
    }
  });

  return quarterSections;
}

/**
 * Extract data for a specific quarter section
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @param {Object} quarterSection - Section boundaries { startRow, endRow, rowCount }
 * @param {string} targetQuarter - Quarter to extract (q1, q2, q3, q4)
 * @returns {Array<Object>} - Rows belonging to the target quarter
 */
function extractQuarterData(rawRows, quarterSection, targetQuarter) {
  console.log(`\n📂 Extracting ${targetQuarter.toUpperCase()} data...`);

  if (!quarterSection) {
    throw new Error(`${targetQuarter.toUpperCase()} section not found in spreadsheet. Please ensure the spreadsheet contains a "${targetQuarter.toUpperCase()}" or "QUARTER ${targetQuarter.replace('q', '')}" label.`);
  }

  const quarterRows = rawRows.slice(quarterSection.startRow, quarterSection.endRow + 1);
  
  // Skip the header row (which contains the quarter label)
  const dataRows = quarterRows.filter((row, index) => {
    // Skip first row (quarter label)
    if (index === 0) return false;
    
    // Skip empty rows
    const values = Object.values(row).filter(val => val !== null && val !== undefined && val !== '');
    if (values.length === 0) return false;
    
    // Skip rows that look like headers (contain "Box", "Description", etc.)
    const rowText = values.join(' ').toString().toLowerCase();
    if (rowText.includes('box') && rowText.includes('description')) return false;
    
    return true;
  });

  console.log(`   Section rows: ${quarterSection.rowCount}`);
  console.log(`   Data rows extracted: ${dataRows.length}`);
  console.log(`   Skipped rows: ${quarterSection.rowCount - dataRows.length}`);

  return dataRows;
}

/**
 * Validate that the extracted data contains expected structure
 * 
 * @param {Array<Object>} quarterData - Extracted quarter rows
 * @param {string} targetQuarter - Quarter being validated
 * @returns {Object} - Validation result
 */
function validateQuarterData(quarterData, targetQuarter) {
  console.log(`\n✅ Validating ${targetQuarter.toUpperCase()} data...`);

  const validation = {
    valid: true,
    warnings: [],
    errors: [],
    stats: {
      totalRows: quarterData.length,
      rowsWithAmounts: 0,
      rowsWithDescriptions: 0,
      emptyRows: 0
    }
  };

  if (quarterData.length === 0) {
    validation.valid = false;
    validation.errors.push(`No data rows found in ${targetQuarter.toUpperCase()} section`);
    return validation;
  }

  quarterData.forEach((row, index) => {
    const values = Object.values(row).filter(val => val !== null && val !== undefined && val !== '');
    
    if (values.length === 0) {
      validation.stats.emptyRows++;
      return;
    }

    // Check for numeric values (amounts)
    const hasNumeric = values.some(val => !isNaN(parseFloat(val)));
    if (hasNumeric) validation.stats.rowsWithAmounts++;

    // Check for text values (descriptions)
    const hasText = values.some(val => typeof val === 'string' && val.length > 3);
    if (hasText) validation.stats.rowsWithDescriptions++;
  });

  if (validation.stats.rowsWithAmounts === 0) {
    validation.warnings.push(`No rows with amounts detected in ${targetQuarter.toUpperCase()}`);
  }

  if (validation.stats.rowsWithDescriptions === 0) {
    validation.warnings.push(`No rows with descriptions detected in ${targetQuarter.toUpperCase()}`);
  }

  console.log(`   Total rows: ${validation.stats.totalRows}`);
  console.log(`   Rows with amounts: ${validation.stats.rowsWithAmounts}`);
  console.log(`   Rows with descriptions: ${validation.stats.rowsWithDescriptions}`);
  console.log(`   Empty rows: ${validation.stats.emptyRows}`);

  if (validation.warnings.length > 0) {
    console.log(`   ⚠️  Warnings: ${validation.warnings.length}`);
    validation.warnings.forEach(w => console.log(`      - ${w}`));
  }

  if (validation.errors.length > 0) {
    console.log(`   ❌ Errors: ${validation.errors.length}`);
    validation.errors.forEach(e => console.log(`      - ${e}`));
    validation.valid = false;
  }

  return validation;
}

/**
 * Detect if spreadsheet uses box-based format or transaction-level format
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @returns {Object} - { format: 'box' | 'transaction', confidence: number }
 */
function detectSpreadsheetFormat(rawRows) {
  console.log(`\n🔍 Detecting spreadsheet format...`);
  
  let boxIndicators = 0;
  let transactionIndicators = 0;
  const sampleSize = Math.min(50, rawRows.length); // Check first 50 rows
  
  for (let i = 0; i < sampleSize; i++) {
    const row = rawRows[i];
    
    // Check for box-based indicators
    // Look for "Box" column name OR numeric values that look like box numbers (20, 21, 24, 25, etc.)
    if (row.Box || row.box || row.BOX) {
      boxIndicators++;
    } else {
      // Check if any column contains what looks like a box number (20-29, 44)
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' || typeof value === 'number') {
          const numValue = parseInt(String(value).trim());
          // HMRC box numbers are typically: 20-29, 44, or similar
          if ([20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 44].includes(numValue)) {
            boxIndicators++;
            break; // Found box indicator in this row
          }
        }
      }
    }
    
    // Check for transaction-based indicators (date, description, amount columns)
    const hasDateLikeColumn = Object.keys(row).some(key => 
      key && (key.toLowerCase().includes('date') || key.toLowerCase().includes('transaction'))
    );
    const hasDescriptionColumn = Object.keys(row).some(key => 
      key && (key.toLowerCase().includes('description') || key.toLowerCase().includes('details') || key.toLowerCase().includes('merchant'))
    );
    const hasAmountColumn = Object.keys(row).some(key => 
      key && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('debit') || key.toLowerCase().includes('credit'))
    );
    
    if (hasDateLikeColumn || (hasDescriptionColumn && hasAmountColumn)) {
      transactionIndicators++;
    }
  }
  
  const format = boxIndicators > transactionIndicators ? 'box' : 'transaction';
  const confidence = Math.max(boxIndicators, transactionIndicators) / sampleSize;
  
  console.log(`   Box indicators: ${boxIndicators}`);
  console.log(`   Transaction indicators: ${transactionIndicators}`);
  console.log(`   Format detected: ${format.toUpperCase()}`);
  console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);
  
  return { format, confidence };
}

/**
 * Process separately defined quarter spreadsheet using AI
 * Main entry point for handling "same_separated" spreadsheet type
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @param {string} targetQuarter - Quarter to extract (q1, q2, q3, q4)
 * @param {string} businessType - Business type for categorization
 * @param {Function} progressCallback - Progress callback function
 * @returns {Object} - Categorization results for the target quarter only
 */
async function processSeparatelyDefinedQuarters(rawRows, targetQuarter, businessType, progressCallback) {
  console.log(`\n🔄 Processing separately defined quarters for ${targetQuarter.toUpperCase()}`);
  console.log(`   Business type: ${businessType}`);
  console.log(`   Total rows in spreadsheet: ${rawRows.length}`);

  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    // Step 1: Detect quarter sections
    if (progressCallback) {
      progressCallback({ stage: 'analysis', percentage: 10, stageDescription: 'Detecting quarter sections' });
    }

    const quarterSections = detectQuarterSections(rawRows);
    
    // Step 2: Detect spreadsheet format (box-based vs transaction-based)
    const formatDetection = detectSpreadsheetFormat(rawRows);
    
    // Step 3: Route to appropriate processing method
    let extractedData;
    
    if (formatDetection.format === 'transaction') {
      // Process transaction-level data (like categorization.util)
      console.log(`\n📊 Processing as TRANSACTION-LEVEL data`);
      
      if (progressCallback) {
        progressCallback({ stage: 'categorization', percentage: 30, stageDescription: `Processing ${targetQuarter.toUpperCase()} transactions` });
      }
      
      extractedData = await processTransactionLevelQuarter(rawRows, targetQuarter, businessType, quarterSections, progressCallback);
      
    } else {
      // Process box-based data with AI extraction
      console.log(`\n📋 Processing as BOX-BASED data`);
      
      if (progressCallback) {
        progressCallback({ stage: 'extraction', percentage: 30, stageDescription: `Extracting ${targetQuarter.toUpperCase()} with AI` });
      }

      extractedData = await extractQuarterWithAI(rawRows, targetQuarter, businessType);
    }

    if (progressCallback) {
      progressCallback({ stage: 'categorization', percentage: 100, stageDescription: 'Processing complete' });
    }

    console.log(`\n✅ Separately defined quarters processing complete`);
    console.log(`   Quarter extracted: ${targetQuarter.toUpperCase()}`);
    console.log(`   Format: ${formatDetection.format.toUpperCase()}`);
    console.log(`   Categories found: ${Object.keys(extractedData.categoryTotals).length}`);
    console.log(`   Successfully categorized: ${extractedData.summary.successful}`);

    // Add extraction details to the results
    return {
      ...extractedData,
      processingMethod: `separately_defined_quarters_${formatDetection.format}`,
      extractionDetails: {
        targetQuarter,
        totalSpreadsheetRows: rawRows.length,
        sectionsDetected: Object.keys(quarterSections).filter(q => quarterSections[q] !== null),
        format: formatDetection.format,
        formatConfidence: formatDetection.confidence,
        extractedAt: new Date().toISOString(),
        method: formatDetection.format === 'box' ? 'OpenAI box extraction' : 'Transaction-level categorization'
      }
    };

  } catch (error) {
    console.error(`❌ Error processing separately defined quarters:`, error);
    throw error;
  }
}

/**
 * Process transaction-level quarter data (similar to categorization.util)
 * Extracts the target quarter section and processes each transaction line by line
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @param {string} targetQuarter - Target quarter (q1, q2, q3, q4)
 * @param {string} businessType - Business type
 * @param {Object} quarterSections - Detected quarter section boundaries
 * @param {Function} progressCallback - Progress callback
 * @returns {Object} - Categorization results
 */
async function processTransactionLevelQuarter(rawRows, targetQuarter, businessType, quarterSections, progressCallback) {
  console.log(`\n📊 Processing transaction-level data for ${targetQuarter.toUpperCase()}`);
  
  // Extract rows for target quarter only
  const quarterBoundary = quarterSections[targetQuarter];
  let quarterRows = rawRows;
  
  if (quarterBoundary) {
    quarterRows = rawRows.slice(quarterBoundary.startRow, quarterBoundary.endRow || rawRows.length);
    console.log(`   Extracted ${quarterRows.length} rows for ${targetQuarter.toUpperCase()} (rows ${quarterBoundary.startRow} to ${quarterBoundary.endRow || rawRows.length})`);
  } else {
    console.log(`   ⚠️  Quarter boundary not detected, processing all ${rawRows.length} rows`);
  }

  const results = {
    totalRows: quarterRows.length,
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
    businessType,
    quarter: targetQuarter
  };

  // Process each row individually (like categorization.util)
  for (let i = 0; i < quarterRows.length; i++) {
    const row = quarterRows[i];
    const progress = Math.round(((i + 1) / quarterRows.length) * 100);

    try {
      // Extract transaction data
      const extractedTransactions = extractTransactionData(row);

      if (!extractedTransactions || extractedTransactions.length === 0) {
        continue;
      }

      // Process each extracted transaction
      for (const transactionData of extractedTransactions) {
        if (transactionData.skip || (transactionData.amount === 0 && !transactionData.description)) {
          continue;
        }

        // Get AI categorization for this specific transaction
        const categorization = await categorizeTransactionWithAI(transactionData, businessType);

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

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (progressCallback) {
        progressCallback({
          stage: 'categorization',
          percentage: progress,
          stageDescription: `Processing transaction ${i + 1}/${quarterRows.length}`
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

  console.log(`\n✅ Transaction-level processing complete for ${targetQuarter.toUpperCase()}`);
  console.log(`   Processed: ${results.summary.successful} transactions`);
  console.log(`   Personal: ${results.summary.personal} transactions`);
  console.log(`   Errors: ${results.summary.errors}`);
  console.log(`   Category Totals:`, results.categoryTotals);

  // Create clean summary for frontend
  results.frontendSummary = createFrontendSummary(results.categoryTotals);

  return results;
}

/**
 * Extract transaction data from a single row (similar to categorization.util)
 */
function extractTransactionData(row) {
  const transactions = [];
  
  // Skip quarter label rows
  const rowText = Object.values(row).join(' ').toString();
  if (/QUARTER\s*[1-4]|Q\s*[1-4]/i.test(rowText)) {
    return [{ amount: 0, description: '', skip: true }];
  }

  // Skip calculated totals
  if (isCalculatedTotal(row)) {
    return [{ amount: 0, description: '', skip: true }];
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
        let description = row.Description?.toString().trim() || 
                         row.description?.toString().trim() || 
                         row.Details?.toString().trim() ||
                         'Income transaction';
        
        transactions.push({
          amount: numValue,
          description: description,
          transactionType: 'income',
          skip: false
        });
      }
    }
    
    // Check for Expense amount
    if (hasExpenseColumn) {
      const cleanValue = String(row.Expense).replace(/[£$,\s]/g, '');
      const numValue = parseFloat(cleanValue);
      if (!isNaN(numValue) && numValue > 0) {
        let description = row.Description?.toString().trim() || 
                         row.description?.toString().trim() || 
                         row.Details?.toString().trim() ||
                         'Expense transaction';
        
        transactions.push({
          amount: numValue,
          description: description,
          transactionType: 'expense',
          skip: false
        });
      }
    }
  }

  // Fallback: find amount and description in any columns
  if (transactions.length === 0) {
    let amount = 0;
    let description = '';
    let transactionType = '';
    
    // Look for amount in common column names
    const amountColumns = ['Amount', 'amount', 'Debit', 'debit', 'Credit', 'credit', 'Value', 'value'];
    for (const col of amountColumns) {
      if (row[col]) {
        const cleanValue = String(row[col]).replace(/[£$,\s]/g, '');
        const numValue = parseFloat(cleanValue);
        if (!isNaN(numValue) && numValue > 0) {
          amount = numValue;
          break;
        }
      }
    }
    
    // Look for description in common column names
    const descColumns = ['Description', 'description', 'Details', 'details', 'Merchant', 'merchant', 'Narrative', 'narrative'];
    for (const col of descColumns) {
      if (row[col] && typeof row[col] === 'string') {
        description = row[col].toString().trim();
        break;
      }
    }
    
    // Final fallback: scan all columns
    if (amount === 0 || !description) {
      for (const [key, value] of Object.entries(row)) {
        if (key.startsWith('_') || !value) continue;
        
        // Try to find amount
        if (amount === 0) {
          const cleanValue = String(value).replace(/[£$,\s]/g, '');
          const numValue = parseFloat(cleanValue);
          if (!isNaN(numValue) && numValue > 0) {
            amount = numValue;
          }
        }
        
        // Try to find description
        if (!description && typeof value === 'string' && isNaN(parseFloat(value))) {
          description = value.toString().trim();
        }
      }
    }
    
    // Create transaction if we found data
    if (amount > 0) {
      transactions.push({
        amount: amount,
        description: description || 'Transaction',
        transactionType: transactionType,
        skip: false
      });
    }
  }

  return transactions.length > 0 ? transactions : [{ amount: 0, description: '', skip: true }];
}

/**
 * Check if row is a calculated total (similar to categorization.util)
 */
function isCalculatedTotal(row) {
  const indicators = [
    'total', 'subtotal', 'grand total', 'sum', 'balance',
    'taxable', 'gross profit', 'net profit', 'profit =', 'loss =',
    'total allowances', 'total expenses', 'total income'
  ];

  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      if (indicators.some(indicator => lowerValue.includes(indicator))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Categorize a single transaction using OpenAI (similar to categorization.util)
 */
async function categorizeTransactionWithAI(transactionData, businessType) {
  const prompt = createTransactionPrompt(transactionData, businessType);
  
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'QuixMTD/1.0'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
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
      const categoryMatch = aiResponse.match(/category[":]\s*["']?(\w+)["']?/i);
      categoryData = {
        category: categoryMatch ? categoryMatch[1] : 'other',
        type: 'expense'
      };
    }

    // Override type if we detected it from the spreadsheet
    if (transactionData.transactionType && categoryData.type && transactionData.transactionType !== categoryData.type) {
      categoryData.type = transactionData.transactionType;
    }

    return {
      category: categoryData.category || 'other',
      categoryDescription: CATEGORY_DESCRIPTIONS[categoryData.category || 'other'] || 'Other business expense',
      type: categoryData.type || 'expense'
    };

  } catch (error) {
    console.error('❌ OpenAI categorization failed:', error.message);
    throw error;
  }
}

/**
 * Create prompt for individual transaction categorization
 */
function createTransactionPrompt(transactionData, businessType) {
  const businessContext = businessType === 'landlord' ? 'UK property rental business' : 'UK sole trader business';
  
  const categories = businessType === 'landlord' ? 
    'periodAmount (income), financialCosts (expense), premisesRunningCosts (expense), repairsAndMaintenance (expense), professionalFees (expense), costOfServices (expense), other (expense)' :
    'turnover (income), costOfGoodsBought (expense), staffCosts (expense), travelCosts (expense), premisesRunningCosts (expense), adminCosts (expense), professionalFees (expense), other (expense)';

  return `Categorize this ${businessContext} transaction for HMRC:

Amount: £${transactionData.amount}
Description: ${transactionData.description}
Direction: ${transactionData.transactionType || 'unknown'}

Available categories: ${categories}

Respond with JSON: {"category": "exact_category_name", "type": "income_or_expense"}`;
}

/**
 * Extract and categorize target quarter using OpenAI
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @param {string} targetQuarter - Target quarter (q1, q2, q3, q4)
 * @param {string} businessType - Business type
 * @returns {Object} - Categorization results
 */
async function extractQuarterWithAI(rawRows, targetQuarter, businessType) {
  console.log(`\n🤖 OpenAI extracting ${targetQuarter.toUpperCase()} from multi-quarter spreadsheet`);
  console.log(`   Raw rows count: ${rawRows.length}`);
  console.log(`   Business type: ${businessType}`);
  console.log(`   First 10 rows:`, JSON.stringify(rawRows.slice(0, 10), null, 2));
  console.log(`   Rows 15-25:`, JSON.stringify(rawRows.slice(15, 25), null, 2));

  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is not set!');
    throw new Error('OpenAI API key not configured');
  }

  console.log(`   ✓ OpenAI API key is configured`);

  // Format spreadsheet for AI
  console.log(`\n📄 Formatting spreadsheet for AI...`);
  const spreadsheetText = formatSpreadsheetForAI(rawRows);
  console.log(`   Spreadsheet text length: ${spreadsheetText.length} characters`);
  console.log(`   First 500 chars:\n${spreadsheetText.substring(0, 500)}`);
  
  const prompt = createQuarterExtractionPrompt(spreadsheetText, targetQuarter, businessType);
  console.log(`   Prompt length: ${prompt.length} characters`);

    console.log(`\n📡 Sending request to OpenAI...`);

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'QuixMTD/1.0'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a financial data extraction specialist. Extract EXACT numerical amounts from spreadsheet data and return ONLY valid JSON. Do not explain, just return the JSON object with the amounts you find.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.1
      })
    });    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ OpenAI API error: ${response.status}`);
      console.error(`   Error details:`, errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    console.log(`✅ OpenAI response received (status: ${response.status})`);

    const result = await response.json();
    const aiResponse = result.choices[0]?.message?.content?.trim();

    console.log(`🤖 OpenAI raw response:\n${aiResponse}`);
    console.log(`   Response length: ${aiResponse?.length || 0} characters`);

    // Parse AI response
    let extractedData;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`   Found JSON in response, parsing...`);
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        console.log(`   Attempting to parse entire response as JSON...`);
        extractedData = JSON.parse(aiResponse);
      }
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('AI Response:', aiResponse);
      throw new Error('AI returned invalid JSON format');
    }

    console.log('✅ AI extracted category totals:', extractedData.categoryTotals);
    console.log(`   Categories extracted: ${Object.keys(extractedData.categoryTotals || {}).length}`);

    // Create frontend summary
    const frontendSummary = createFrontendSummary(extractedData.categoryTotals);

    return {
      categoryTotals: extractedData.categoryTotals || {},
      frontendSummary,
      summary: {
        successful: Object.keys(extractedData.categoryTotals || {}).length,
        personal: 0,
        errors: 0,
        aiCategorized: Object.keys(extractedData.categoryTotals || {}).length
      },
      totalRows: rawRows.length,
      businessType,
      quarter: targetQuarter,
      processingDate: new Date().toISOString(),
      extractionMethod: 'openai_quarter_extraction'
    };

  } catch (error) {
    console.error('❌ OpenAI extraction failed:', error);
    throw error;
  }
}

/**
 * Format spreadsheet for AI processing
 * Handles spreadsheets with multiple columns including unnamed/empty columns
 */
function formatSpreadsheetForAI(rawRows) {
  let formattedText = 'SPREADSHEET DATA:\n\n';
  
  // First, let's see what columns we actually have
  if (rawRows.length > 0) {
    const sampleRow = rawRows[0];
    // Get ALL keys except _rowNumber and _originalRowIndex
    const allKeys = Object.keys(sampleRow).filter(k => k !== '_rowNumber' && k !== '_originalRowIndex');
    console.log(`   📊 Total columns detected: ${allKeys.length}`);
    console.log(`   📊 Column names:`, allKeys);
  }
  
  rawRows.forEach((row, index) => {
    // Get ALL keys including _col0, _col2, etc. (but not _rowNumber/_originalRowIndex)
    const allKeys = Object.keys(row)
      .filter(k => k !== '_rowNumber' && k !== '_originalRowIndex')
      .sort((a, b) => {
        // Sort to maintain column order: _col0, QUARTER 1, _col2, _col3, etc.
        const getColNum = (key) => {
          if (key.startsWith('_col')) {
            return parseInt(key.replace('_col', '')) || 0;
          }
          return -1; // Named columns come before _col columns
        };
        return getColNum(a) - getColNum(b);
      });
    
    const values = [];
    
    // Process each column in order
    allKeys.forEach((key, colIndex) => {
      const value = row[key];
      if (value !== null && value !== undefined && value !== '') {
        const cleanValue = String(value).trim();
        // Label each column by position (Column A, B, C, D, etc.) for clarity
        const colLabel = String.fromCharCode(65 + colIndex); // A, B, C, D...
        values.push(`Col${colLabel}: "${cleanValue}"`);
      }
    });
    
    if (values.length > 0) {
      formattedText += `Row ${index + 1}: ${values.join(' | ')}\n`;
    }
  });

  console.log(`   📄 First 1200 chars of formatted spreadsheet:\n${formattedText.substring(0, 1200)}`);
  
  return formattedText;
}

/**
 * Create AI prompt for quarter extraction
 */
function createQuarterExtractionPrompt(spreadsheetText, targetQuarter, businessType) {
  const quarterName = targetQuarter.toUpperCase();
  const businessContext = businessType === 'landlord' ? 
    'UK property rental business' : 
    'UK sole trader business';

  const categories = businessType === 'landlord' ? `
  - periodAmount (rental income) - Box 20
  - premiumsOfLeaseGrant (property premiums) - Box 21, 22, 23
  - reversePremiums (reverse premiums) - Box 21, 22, 23
  - financialCosts (mortgage interest, loan costs) - Box 44
  - premisesRunningCosts (rent, rates, insurance) - Box 24
  - repairsAndMaintenance (property repairs, maintenance) - Box 25
  - professionalFees (legal fees, management fees, accountant fees) - Box 27
  - costOfServices (gardening, cleaning, security) - Box 28
  - other (other allowable expenses) - Box 29
  ` : `
  - turnover (business income, sales, fees)
  - costOfGoodsBought (raw materials, stock, goods for resale)
  - cisPaymentsToSubcontractors (CIS payments)
  - staffCosts (wages, salaries, employer NICs)
  - travelCosts (business travel, fuel, parking)
  - maintenanceCosts (repairs and maintenance)
  - adminCosts (phone, stationery, postage)
  - advertisingCosts (advertising, marketing)
  - professionalFees (legal, accountant fees)
  - interestOnBankOtherLoans (loan interest)
  - financialCharges (bank charges)
  - badDebt (irrecoverable debts)
  - other (other allowable expenses)
  `;

  return `Extract financial data from ${quarterName} section of this spreadsheet.

${spreadsheetText}

SPREADSHEET STRUCTURE:
The data is organized in columns labeled ColA, ColB, ColC, ColD, etc.
Typically:
- ColA or ColB contains the Box Number (20, 21, 24, 25, 27, 28, 29, 44)
- ColB or ColC contains the Description
- ColC or ColD contains the MONETARY VALUE (amounts in £)

CRITICAL INSTRUCTIONS:
1. Find the section labeled "${quarterName}" or "QUARTER ${targetQuarter.charAt(1)}"
2. In that section, look for rows with Box numbers 20, 21, 22, 23, 24, 25, 27, 28, 29, or 44
3. For each box row, find the MONETARY VALUE in the rightmost column (usually ColC or ColD)
4. The monetary value looks like: £26,115.00, £11,656.00, £564.00, etc.
5. DO NOT use the box number as the amount - find the £ amount in the same row

EXAMPLE:
Row 25: ColA: "20" | ColB: "Total rents and other income from property" | ColD: "£26,115.00"
→ Extract: periodAmount = 26115.00 (use the £26,115.00 value, NOT the box number 20!)

Row 30: ColA: "44" | ColB: "Residential property finance costs" | ColD: "£11,656.00"
→ Extract: financialCosts = 11656.00 (use £11,656.00, NOT 44!)

BOX TO CATEGORY MAPPING:
${businessType === 'landlord' ? `
- Box 20 → periodAmount (Total rents and other income)
- Box 21, 22, 23 → premiumsOfLeaseGrant (usually n/a)
- Box 44 → financialCosts (Residential property finance costs)
- Box 24 → premisesRunningCosts (Rent, rates, insurance, ground rents)
- Box 25 → repairsAndMaintenance (Property repairs, maintenance and renewals)
- Box 27 → professionalFees (Legal, management and other professional fees)
- Box 28 → costOfServices (Costs of services provided, including wages)
- Box 29 → other (Other allowable property expenses)
` : `
- Use business category mapping based on description
`}

IMPORTANT RULES:
- ONLY extract data from rows between "${quarterName}" label and the next quarter label
- Look for values with £ symbol - these are the monetary amounts
- Extract the NUMBER from the £ value (£26,115.00 becomes 26115.00)
- Ignore rows with "n/a" values
- Ignore rows with "Total Allowances", "Taxable =", "Gross Profit ="
- If a Box has no monetary value, use 0 for that category

RETURN ONLY THIS JSON (use £ amounts from rightmost columns, NOT box numbers):
{
  "categoryTotals": {
    "periodAmount": [£ amount from Box 20 row],
    "premisesRunningCosts": [£ amount from Box 24 row],
    "repairsAndMaintenance": [£ amount from Box 25 row],
    "professionalFees": [£ amount from Box 27 row],
    "costOfServices": [£ amount from Box 28 row],
    "other": [£ amount from Box 29 row],
    "financialCosts": [£ amount from Box 44 row]
  }
}

Return ONLY valid JSON with the £ amounts (not box numbers) from ${quarterName}.`;
}

/**
 * Create frontend summary from category totals
 */
function createFrontendSummary(categoryTotals) {
  const summary = [];
  
  for (const [category, totalAmount] of Object.entries(categoryTotals)) {
    if (totalAmount !== 0) {
      summary.push({
        category: category,
        categoryDescription: CATEGORY_DESCRIPTIONS[category] || 'Other business expense',
        type: INCOME_CATEGORIES.includes(category) ? 'income' : 'expense',
        totalAmount: totalAmount,
        formattedAmount: `£${Math.abs(totalAmount).toLocaleString('en-GB', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`
      });
    }
  }

  summary.sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));
  return summary;
}

/**
 * Check if spreadsheet contains separately defined quarters
 * Quick check to determine if this utility should be used
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @returns {boolean} - True if quarter sections are detected
 */
function hasSeparatelyDefinedQuarters(rawRows) {
  const quarterSections = detectQuarterSections(rawRows);
  const detectedQuarters = Object.values(quarterSections).filter(section => section !== null);
  
  // If we detect ANY quarter labels in the spreadsheet, treat it as multi-quarter format
  // This handles cases where only some quarters are present
  const hasSeparateSections = detectedQuarters.length >= 1;
  
  console.log(`\n🔍 Separately defined quarters check: ${hasSeparateSections ? 'YES' : 'NO'}`);
  console.log(`   Quarters detected: ${detectedQuarters.length}`);
  if (detectedQuarters.length > 0) {
    console.log(`   Detected quarters: ${detectedQuarters.map((_, i) => Object.keys(quarterSections).find(k => quarterSections[k] === detectedQuarters[i])).join(', ').toUpperCase()}`);
  }
  
  return hasSeparateSections;
}

module.exports = {
  detectQuarterSections,
  extractQuarterData,
  validateQuarterData,
  processSeparatelyDefinedQuarters,
  hasSeparatelyDefinedQuarters
};