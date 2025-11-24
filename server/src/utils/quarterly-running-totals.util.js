/**
 * Quarterly Running Totals Utility
 * 
 * Handles "same spreadsheet with cumulative/running totals" type quarterly submissions.
 * 
 * For Q2, Q3, Q4 submissions where the user uploads a spreadsheet containing 
 * cumulative totals (e.g., Q2 shows Jan-Jun totals), this utility calculates 
 * the difference to extract only the current quarter's actual values.
 * 
 * Example:
 * - Q1 total income: £10,000
 * - Q2 cumulative total income: £25,000
 * - Q2 actual (calculated): £25,000 - £10,000 = £15,000
 */

/**
 * Calculate the difference between current cumulative totals and previous quarter totals
 * 
 * @param {Object} currentCumulativeTotals - Category totals from current quarter upload (cumulative)
 * @param {Object} previousQuarterTotals - Category totals from previous quarter(s)
 * @param {string} targetQuarter - The quarter we're calculating for (q2, q3, q4)
 * @returns {Object} - The actual totals for the target quarter only
 */
function calculateQuarterDifference(currentCumulativeTotals, previousQuarterTotals, targetQuarter) {
  console.log(`\n🔢 Calculating difference for ${targetQuarter.toUpperCase()}`);
  console.log(`📊 Current cumulative totals:`, currentCumulativeTotals);
  console.log(`📊 Previous quarter(s) totals:`, previousQuarterTotals);

  if (!currentCumulativeTotals || typeof currentCumulativeTotals !== 'object') {
    throw new Error('Current cumulative totals must be a valid object');
  }

  if (!previousQuarterTotals || typeof previousQuarterTotals !== 'object') {
    throw new Error('Previous quarter totals must be a valid object');
  }

  const quarterDifference = {};
  const allCategories = new Set([
    ...Object.keys(currentCumulativeTotals),
    ...Object.keys(previousQuarterTotals)
  ]);

  let totalIncrease = 0;
  let totalDecrease = 0;
  let categoriesProcessed = 0;

  for (const category of allCategories) {
    const currentValue = currentCumulativeTotals[category] || 0;
    const previousValue = previousQuarterTotals[category] || 0;
    let difference = currentValue - previousValue;

    // If difference is negative, set to 0 (cannot have negative expenses/income for a quarter)
    if (difference < 0) {
      console.log(`   ⚠️  ${category}: Negative difference detected (${difference}), setting to 0`);
      difference = 0;
    }

    quarterDifference[category] = difference;

    if (difference > 0) {
      totalIncrease += difference;
    }

    categoriesProcessed++;

    console.log(`   ${category}: ${previousValue} → ${currentValue} = ${difference > 0 ? '+' : ''}${difference}`);
  }

  console.log(`\n✅ Quarter difference calculated:`);
  console.log(`   Categories processed: ${categoriesProcessed}`);
  console.log(`   Total increases: £${totalIncrease.toFixed(2)}`);
  console.log(`   Net change: £${totalIncrease.toFixed(2)}`);

  return quarterDifference;
}

/**
 * Calculate cumulative totals from multiple quarters
 * Used for Q3 (needs Q1 + Q2) and Q4 (needs Q1 + Q2 + Q3)
 * 
 * @param {Array<Object>} previousQuarters - Array of previous quarter categorization results
 * @returns {Object} - Combined cumulative totals
 */
function calculateCumulativeTotals(previousQuarters) {
  console.log(`\n📈 Calculating cumulative totals from ${previousQuarters.length} previous quarter(s)`);

  if (!Array.isArray(previousQuarters) || previousQuarters.length === 0) {
    console.log(`⚠️  No previous quarters provided - returning empty totals`);
    return {};
  }

  const cumulativeTotals = {};
  const allCategories = new Set();

  // Collect all unique categories across all quarters
  previousQuarters.forEach((quarter, index) => {
    if (quarter && quarter.categoryTotals) {
      Object.keys(quarter.categoryTotals).forEach(cat => allCategories.add(cat));
      console.log(`   Q${index + 1}: ${Object.keys(quarter.categoryTotals).length} categories`);
    }
  });

  // Sum up values for each category
  for (const category of allCategories) {
    cumulativeTotals[category] = 0;
    
    previousQuarters.forEach(quarter => {
      if (quarter && quarter.categoryTotals && quarter.categoryTotals[category]) {
        cumulativeTotals[category] += quarter.categoryTotals[category];
      }
    });

    console.log(`   ${category}: £${cumulativeTotals[category].toFixed(2)}`);
  }

  console.log(`✅ Cumulative totals calculated for ${allCategories.size} categories`);

  return cumulativeTotals;
}

/**
 * Process running totals submission with AI extraction
 * Main entry point for handling "same_cumulative" spreadsheet type
 * Uses OpenAI to read spreadsheet and extract category totals
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows  
 * @param {Array<Object>} previousQuarters - Array of previous quarter submissions
 * @param {string} targetQuarter - Current quarter (q1, q2, q3, q4)
 * @param {string} businessType - Business type (landlord, sole_trader)
 * @returns {Object} - Categorization results with actual quarter values
 */
async function processRunningTotalsWithAI(rawRows, previousQuarters, targetQuarter, businessType) {
  console.log(`\n🔄 Processing running totals with AI for ${targetQuarter.toUpperCase()}`);

  // Step 1: Extract cumulative totals from spreadsheet using AI
  const cumulativeResults = await extractCategoryTotalsWithAI(rawRows, businessType, targetQuarter);

  if (!cumulativeResults || !cumulativeResults.categoryTotals) {
    throw new Error('AI extraction failed - no category totals returned');
  }

  console.log('✅ AI extracted cumulative totals:', cumulativeResults.categoryTotals);

  // Step 2: If Q1, no calculation needed - this IS the baseline
  if (targetQuarter === 'q1') {
    console.log('✅ Q1 submission - using cumulative totals as baseline');
    
    return {
      ...cumulativeResults,
      processingMethod: 'running_totals_ai_extraction',
      quarter: targetQuarter,
      frontendSummary: createFrontendSummary(cumulativeResults.categoryTotals, businessType),
      summary: {
        successful: Object.keys(cumulativeResults.categoryTotals).length,
        personal: 0,
        errors: 0,
        aiCategorized: Object.keys(cumulativeResults.categoryTotals).length
      },
      processingDetails: {
        method: 'AI spreadsheet reading - Q1 baseline',
        description: 'Q1 cumulative totals extracted by AI and used as baseline for future quarters',
        rowsProcessed: rawRows.length,
        quarter: targetQuarter,
        isBaseline: true,
        processedAt: new Date().toISOString()
      }
    };
  }

  // Step 3: For Q2, Q3, Q4 - calculate difference from previous quarters
  if (!previousQuarters || previousQuarters.length === 0) {
    throw new Error(
      `Cannot calculate ${targetQuarter.toUpperCase()} difference - no previous quarter data found. ` +
      `Please ensure previous quarters are uploaded first.`
    );
  }

  // Calculate cumulative totals from previous quarters
  const previousCumulativeTotals = calculateCumulativeTotals(previousQuarters);

  // Calculate the difference (actual quarter values)
  const actualQuarterTotals = calculateQuarterDifference(
    cumulativeResults.categoryTotals,
    previousCumulativeTotals,
    targetQuarter
  );

  console.log('✅ Calculated actual quarter totals:', actualQuarterTotals);

  // Create final results with actual quarter values
  return {
    categoryTotals: actualQuarterTotals,
    totalRows: rawRows.length,
    businessType,
    quarter: targetQuarter,
    processingDate: new Date().toISOString(),
    processingMethod: 'running_totals_ai_extraction',
    extractionMethod: 'openai_with_difference_calculation',
    frontendSummary: createFrontendSummary(actualQuarterTotals, businessType),
    summary: {
      successful: Object.keys(actualQuarterTotals).length,
      personal: 0,
      errors: 0,
      aiCategorized: Object.keys(actualQuarterTotals).length
    },
    calculationDetails: {
      targetQuarter,
      previousQuartersUsed: previousQuarters.length,
      cumulativeTotal: cumulativeResults.categoryTotals,
      previousCumulativeTotal: previousCumulativeTotals,
      actualQuarterTotal: actualQuarterTotals,
      calculatedAt: new Date().toISOString()
    },
    processingDetails: {
      method: 'AI spreadsheet reading with difference calculation',
      description: `AI extracted cumulative totals, then calculated ${targetQuarter.toUpperCase()} actual values`,
      rowsProcessed: rawRows.length,
      previousQuartersUsed: previousQuarters.length,
      processedAt: new Date().toISOString()
    }
  };
}

/**
 * Create frontend summary from category totals
 * 
 * @param {Object} categoryTotals - Category totals object
 * @param {string} businessType - Business type
 * @returns {Array} - Frontend summary array
 */
function createFrontendSummary(categoryTotals, businessType) {
  const summary = [];
  
  for (const [category, totalAmount] of Object.entries(categoryTotals)) {
    if (totalAmount !== 0) { // Include both positive and negative amounts
      summary.push({
        category: category,
        categoryDescription: getCategoryDescription(category),
        type: getCategoryType(category),
        totalAmount: totalAmount,
        formattedAmount: `£${Math.abs(totalAmount).toLocaleString('en-GB', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`
      });
    }
  }

  // Sort by absolute amount (highest first)
  summary.sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));

  return summary;
}

/**
 * Get category description
 */
function getCategoryDescription(category) {
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
 * Get category type (income/expense)
 */
function getCategoryType(category) {
  const incomeCategories = ['periodAmount', 'turnover', 'premiumsOfLeaseGrant', 'reversePremiums'];
  return incomeCategories.includes(category) ? 'income' : 'expense';
}

/**
 * Process running totals submission (legacy - kept for backward compatibility)
 * Main entry point for handling "same_cumulative" spreadsheet type
 * 
 * @param {Object} currentCategorizationResults - Categorization results from current upload
 * @param {Array<Object>} previousQuarters - Array of previous quarter submissions
 * @param {string} targetQuarter - Current quarter (q2, q3, q4)
 * @returns {Object} - Updated categorization results with actual quarter values
 */
function processRunningTotals(currentCategorizationResults, previousQuarters, targetQuarter) {
  console.log(`\n🔄 Processing running totals for ${targetQuarter.toUpperCase()}`);

  if (!currentCategorizationResults || !currentCategorizationResults.categoryTotals) {
    throw new Error('Invalid categorization results - missing categoryTotals');
  }

  if (targetQuarter === 'q1') {
    console.log(`✅ Q1 detected - no calculation needed (baseline quarter)`);
    return currentCategorizationResults;
  }

  if (!previousQuarters || previousQuarters.length === 0) {
    throw new Error(`Cannot calculate ${targetQuarter.toUpperCase()} difference - no previous quarter data found. Please ensure previous quarters are uploaded first.`);
  }

  // Calculate cumulative totals from all previous quarters
  const previousCumulativeTotals = calculateCumulativeTotals(previousQuarters);

  // Calculate the difference (current cumulative - previous cumulative = this quarter only)
  const actualQuarterTotals = calculateQuarterDifference(
    currentCategorizationResults.categoryTotals,
    previousCumulativeTotals,
    targetQuarter
  );

  // Regenerate frontend summary with the actual quarter values
  const businessType = currentCategorizationResults.businessType || 'landlord';
  const updatedFrontendSummary = createFrontendSummary(actualQuarterTotals, businessType);

  console.log(`\n📊 Frontend Summary Generated:`);
  console.log(`   Cumulative totals: ${JSON.stringify(currentCategorizationResults.categoryTotals)}`);
  console.log(`   Actual quarter totals: ${JSON.stringify(actualQuarterTotals)}`);
  console.log(`   Frontend summary items: ${updatedFrontendSummary.length}`);

  // Create updated categorization results with actual quarter values
  const updatedResults = {
    ...currentCategorizationResults,
    categoryTotals: actualQuarterTotals,
    frontendSummary: updatedFrontendSummary,
    processingMethod: 'running_totals_difference',
    calculationDetails: {
      targetQuarter,
      previousQuartersUsed: previousQuarters.length,
      cumulativeTotal: currentCategorizationResults.categoryTotals,
      previousCumulativeTotal: previousCumulativeTotals,
      actualQuarterTotal: actualQuarterTotals,
      calculatedAt: new Date().toISOString()
    }
  };

  console.log(`\n✅ Running totals processing complete`);
  console.log(`   Method: Cumulative difference calculation`);
  console.log(`   Previous quarters: ${previousQuarters.length}`);
  console.log(`   Categories updated: ${Object.keys(actualQuarterTotals).length}`);

  return updatedResults;
}

/**
 * Validate that required previous quarters exist
 * 
 * @param {string} targetQuarter - Quarter being submitted (q2, q3, q4)
 * @param {Array<Object>} availableSubmissions - All user's submissions
 * @returns {Object} - Validation result with required quarters and missing quarters
 */
function validatePreviousQuarters(targetQuarter, availableSubmissions) {
  const quarterNumber = parseInt(targetQuarter.toLowerCase().replace('q', ''));
  const requiredQuarters = [];
  
  for (let i = 1; i < quarterNumber; i++) {
    requiredQuarters.push(`q${i}`);
  }

  const availableQuarters = availableSubmissions
    .filter(sub => sub.type === 'quarterly' && sub.categorization_results)
    .map(sub => sub.quarter ? sub.quarter.toLowerCase() : '');

  console.log('🔍 Validation check:');
  console.log(`   Target quarter: ${targetQuarter}`);
  console.log(`   Required quarters: ${requiredQuarters.join(', ')}`);
  console.log(`   Available quarters: ${availableQuarters.join(', ')}`);

  const missingQuarters = requiredQuarters.filter(q => !availableQuarters.includes(q));
  
  console.log(`   Missing quarters: ${missingQuarters.length > 0 ? missingQuarters.join(', ') : 'none'}`);

  return {
    valid: missingQuarters.length === 0,
    requiredQuarters,
    availableQuarters,
    missingQuarters
  };
}

module.exports = {
  calculateQuarterDifference,
  calculateCumulativeTotals,
  processRunningTotals,
  validatePreviousQuarters
};