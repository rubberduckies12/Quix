/**
 * Quarterly Submission Service
 * 
 * Handles all three types of quarterly submissions:
 * 1. different_per_quarter - Separate spreadsheet per quarter (direct categorization)
 * 2. same_cumulative - Running totals spreadsheet (calculate differences)
 * 3. same_separated - Separately defined quarters in same file (extract target quarter)
 */

const categorizationUtil = require('../utils/categorization.util');
const runningTotalsUtil = require('../utils/quarterly-running-totals.util');
const separatedQuartersUtil = require('../utils/quarterly-same-sheet-seperatley-defined.util');
const SubmissionModel = require('../models/submission.models');

/**
 * Process quarterly submission based on spreadsheet type
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @param {Object} options - Processing options
 * @param {string} options.quarter - Target quarter (q1, q2, q3, q4)
 * @param {string} options.businessType - Business type (landlord, sole_trader)
 * @param {string} options.spreadsheetType - Type of spreadsheet (different_per_quarter, same_cumulative, same_separated)
 * @param {number} options.userId - User ID
 * @param {number} options.taxYear - Tax year
 * @param {Function} progressCallback - Progress callback function
 * @returns {Object} - Processing results with categorization data
 */
async function processQuarterlySubmission(rawRows, options, progressCallback) {
  console.log('\n🎯 Processing Quarterly Submission');
  console.log('   Quarter:', options.quarter);
  console.log('   Business Type:', options.businessType);
  console.log('   Spreadsheet Type:', options.spreadsheetType);
  console.log('   Total Rows:', rawRows.length);

  try {
    // Validate inputs
    validateQuarterlyInputs(options);

    // Auto-detect spreadsheet type if not specified or if default
    let spreadsheetType = options.spreadsheetType;
    
    if (!spreadsheetType || spreadsheetType === 'different_per_quarter') {
      console.log('\n🔍 Auto-detecting spreadsheet type...');
      const detectedType = detectSpreadsheetType(rawRows);
      
      if (detectedType !== 'different_per_quarter') {
        console.log(`✅ Auto-detected: ${detectedType} (overriding default)`);
        spreadsheetType = detectedType;
      } else {
        spreadsheetType = options.spreadsheetType || 'different_per_quarter';
      }
    }

    console.log(`📊 Using spreadsheet type: ${spreadsheetType}`);

    // Route to appropriate processing method based on spreadsheet type
    let categorizationResults;

    switch (spreadsheetType) {
      case 'different_per_quarter':
        categorizationResults = await processDifferentPerQuarter(rawRows, options, progressCallback);
        break;

      case 'same_cumulative':
        categorizationResults = await processSameCumulative(rawRows, options, progressCallback);
        break;

      case 'same_separated':
        categorizationResults = await processSameSeparated(rawRows, options, progressCallback);
        break;

      default:
        // Fallback to different_per_quarter
        console.log('⚠️  Unknown spreadsheet type, using different_per_quarter');
        categorizationResults = await processDifferentPerQuarter(rawRows, options, progressCallback);
        break;
    }

    console.log('\n✅ Quarterly submission processing complete');
    console.log('   Processing Method:', categorizationResults.processingMethod || spreadsheetType);
    console.log('   Successfully Categorized:', categorizationResults.summary.successful);
    console.log('   Category Totals:', Object.keys(categorizationResults.categoryTotals).length);

    return categorizationResults;

  } catch (error) {
    console.error('❌ Error processing quarterly submission:', error);
    throw error;
  }
}

/**
 * Process Type 1: Different spreadsheet per quarter
 * Direct categorization - each quarter has its own file
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @param {Object} options - Processing options
 * @param {Function} progressCallback - Progress callback
 * @returns {Object} - Categorization results
 */
async function processDifferentPerQuarter(rawRows, options, progressCallback) {
  console.log('\n📄 Processing: Different Spreadsheet Per Quarter');
  console.log('   Method: Direct categorization');
  console.log('   Quarter:', options.quarter);

  if (progressCallback) {
    progressCallback({
      stage: 'categorization',
      percentage: 10,
      stageDescription: `Categorizing ${options.quarter.toUpperCase()} transactions`
    });
  }

  // Use standard categorization utility - line by line processing
  const categorizationResults = await categorizationUtil.processSpreadsheetLineByLine(
    rawRows,
    options.businessType,
    progressCallback
  );

  // Add processing method metadata
  return {
    ...categorizationResults,
    processingMethod: 'different_per_quarter',
    quarter: options.quarter,
    processingDetails: {
      method: 'Direct categorization',
      description: 'Separate spreadsheet for this quarter only',
      rowsProcessed: rawRows.length,
      quarter: options.quarter,
      processedAt: new Date().toISOString()
    }
  };
}

/**
 * Process Type 2: Same spreadsheet with cumulative/running totals
 * Calculate difference between current cumulative and previous quarters
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @param {Object} options - Processing options
 * @param {Function} progressCallback - Progress callback
 * @returns {Object} - Categorization results with differences
 */
async function processSameCumulative(rawRows, options, progressCallback) {
  console.log('\n📊 Processing: Same Spreadsheet - Cumulative Totals');
  console.log('   Method: Calculate quarter difference');
  console.log('   Quarter:', options.quarter);

  // Step 1: Categorize current cumulative data
  if (progressCallback) {
    progressCallback({
      stage: 'categorization',
      percentage: 20,
      stageDescription: 'Categorizing cumulative totals'
    });
  }

  const cumulativeCategorizationResults = await categorizationUtil.processSpreadsheetLineByLine(
    rawRows,
    options.businessType,
    (progress) => {
      if (progressCallback) {
        // Scale progress from 20-60%
        const scaledPercentage = 20 + (progress.percentage * 0.4);
        progressCallback({
          stage: progress.stage,
          percentage: Math.round(scaledPercentage),
          stageDescription: progress.stageDescription || 'Categorizing cumulative data'
        });
      }
    }
  );

  // Step 2: If Q1, no calculation needed - this IS the baseline
  if (options.quarter === 'q1') {
    console.log('✅ Q1 submission - using cumulative totals as baseline');
    
    if (progressCallback) {
      progressCallback({
        stage: 'categorization',
        percentage: 100,
        stageDescription: 'Q1 baseline established'
      });
    }

    return {
      ...cumulativeCategorizationResults,
      processingMethod: 'same_cumulative',
      quarter: options.quarter,
      processingDetails: {
        method: 'Running totals - Q1 baseline',
        description: 'Q1 cumulative totals used as baseline for future quarters',
        rowsProcessed: rawRows.length,
        quarter: options.quarter,
        isBaseline: true,
        processedAt: new Date().toISOString()
      }
    };
  }

  // Step 3: For Q2, Q3, Q4 - retrieve previous quarters and calculate difference
  if (progressCallback) {
    progressCallback({
      stage: 'calculation',
      percentage: 70,
      stageDescription: 'Retrieving previous quarter data'
    });
  }

  console.log('\n🔍 Retrieving previous quarters for difference calculation...');
  console.log(`   Target quarter: ${options.quarter}`);
  console.log(`   Tax year: ${options.taxYear}`);
  
  // Get all user submissions for this tax year
  const existingSubmissions = await SubmissionModel.getUserSubmissions(options.userId);
  
  console.log(`   Total submissions found: ${existingSubmissions.length}`);
  existingSubmissions.forEach(sub => {
    console.log(`     - Type: ${sub.type}, Quarter: ${sub.quarter}, Year: ${sub.tax_year}, Has results: ${!!sub.categorization_results}`);
  });
  
  // Filter for quarterly submissions in current tax year with categorization results
  const previousQuarters = existingSubmissions.filter(sub => 
    sub.type === 'quarterly' &&
    sub.tax_year === options.taxYear &&
    sub.categorization_results &&
    sub.categorization_results.categoryTotals &&
    getQuarterNumber(sub.quarter) < getQuarterNumber(options.quarter)
  ).map(sub => ({
    quarter: sub.quarter,
    categoryTotals: sub.categorization_results.categoryTotals,
    uploadId: sub.upload_id
  }));

  console.log(`   Found ${previousQuarters.length} previous quarter(s)`);
  previousQuarters.forEach(q => {
    console.log(`   - ${q.quarter}: ${Object.keys(q.categoryTotals).length} categories`);
  });

  // Validate we have all required previous quarters
  const validation = runningTotalsUtil.validatePreviousQuarters(options.quarter, existingSubmissions);
  
  if (!validation.valid) {
    throw new Error(
      `Cannot process ${options.quarter.toUpperCase()} with running totals. ` +
      `Missing previous quarters: ${validation.missingQuarters.join(', ').toUpperCase()}. ` +
      `Please upload these quarters first.`
    );
  }

  if (progressCallback) {
    progressCallback({
      stage: 'calculation',
      percentage: 80,
      stageDescription: 'Calculating quarter difference'
    });
  }

  // Step 4: Calculate the actual quarter values (current - previous cumulative)
  const actualQuarterResults = runningTotalsUtil.processRunningTotals(
    cumulativeCategorizationResults,
    previousQuarters,
    options.quarter
  );

  if (progressCallback) {
    progressCallback({
      stage: 'categorization',
      percentage: 100,
      stageDescription: 'Quarter difference calculated'
    });
  }

  console.log('\n✅ Running totals processing complete');
  console.log(`   ${options.quarter.toUpperCase()} actual values calculated from cumulative totals`);
  console.log('   Cumulative totals:', cumulativeCategorizationResults.categoryTotals);
  console.log('   Actual quarter totals:', actualQuarterResults.categoryTotals);
  console.log('   Frontend summary length:', actualQuarterResults.frontendSummary?.length);

  return {
    ...actualQuarterResults,
    quarter: options.quarter,
    summary: {
      ...actualQuarterResults.summary,
      successful: actualQuarterResults.summary?.successful || Object.keys(actualQuarterResults.categoryTotals).length,
      personal: actualQuarterResults.summary?.personal || 0,
      errors: actualQuarterResults.summary?.errors || 0
    },
    processingDetails: {
      ...actualQuarterResults.processingDetails,
      method: 'Running totals difference calculation',
      description: `Calculated ${options.quarter.toUpperCase()} actual values from cumulative totals`,
      rowsProcessed: rawRows.length,
      previousQuartersUsed: previousQuarters.length,
      processedAt: new Date().toISOString()
    }
  };
}

/**
 * Process Type 3: Same spreadsheet with separately defined quarters
 * Extract target quarter from multi-quarter spreadsheet
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @param {Object} options - Processing options
 * @param {Function} progressCallback - Progress callback
 * @returns {Object} - Categorization results for target quarter
 */
async function processSameSeparated(rawRows, options, progressCallback) {
  console.log('\n📑 Processing: Same Spreadsheet - Separately Defined Quarters');
  console.log('   Method: Extract and categorize target quarter');
  console.log('   Target Quarter:', options.quarter);

  // Use the separately defined quarters utility
  const categorizationResults = await separatedQuartersUtil.processSeparatelyDefinedQuarters(
    rawRows,
    options.quarter,
    options.businessType,
    progressCallback
  );

  console.log('\n✅ Separately defined quarters processing complete');
  console.log(`   Extracted and categorized ${options.quarter.toUpperCase()} data`);

  return {
    ...categorizationResults,
    quarter: options.quarter,
    processingDetails: {
      ...categorizationResults.extractionDetails,
      method: 'Quarter extraction from multi-quarter spreadsheet',
      description: `Extracted ${options.quarter.toUpperCase()} section from spreadsheet with multiple quarters`,
      processedAt: new Date().toISOString()
    }
  };
}

/**
 * Validate quarterly submission inputs
 * 
 * @param {Object} options - Submission options
 * @throws {Error} - If validation fails
 */
function validateQuarterlyInputs(options) {
  console.log('\n✅ Validating quarterly submission inputs...');

  if (!options.quarter) {
    throw new Error('Quarter is required for quarterly submissions');
  }

  const validQuarters = ['q1', 'q2', 'q3', 'q4'];
  if (!validQuarters.includes(options.quarter.toLowerCase())) {
    throw new Error(`Invalid quarter: ${options.quarter}. Must be one of: ${validQuarters.join(', ')}`);
  }

  if (!options.businessType) {
    throw new Error('Business type is required');
  }

  const validBusinessTypes = ['landlord', 'sole_trader'];
  if (!validBusinessTypes.includes(options.businessType)) {
    throw new Error(`Invalid business type: ${options.businessType}. Must be one of: ${validBusinessTypes.join(', ')}`);
  }

  if (!options.userId) {
    throw new Error('User ID is required');
  }

  if (!options.taxYear) {
    throw new Error('Tax year is required');
  }

  console.log('   ✓ All inputs valid');
}

/**
 * Get quarter number from quarter string
 * 
 * @param {string} quarter - Quarter string (q1, q2, q3, q4)
 * @returns {number} - Quarter number (1, 2, 3, 4)
 */
function getQuarterNumber(quarter) {
  if (!quarter) return 0;
  const match = quarter.toLowerCase().match(/q?(\d)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Detect spreadsheet type automatically
 * Useful for future enhancement if user doesn't specify type
 * 
 * @param {Array<Object>} rawRows - Raw spreadsheet rows
 * @returns {string} - Detected spreadsheet type
 */
function detectSpreadsheetType(rawRows) {
  console.log('\n🔍 Auto-detecting spreadsheet type...');

  // Check for separately defined quarters
  if (separatedQuartersUtil.hasSeparatelyDefinedQuarters(rawRows)) {
    console.log('   ✓ Detected: Separately defined quarters');
    return 'same_separated';
  }

  // Check for indicators of running totals
  // (This is a simple heuristic - could be enhanced)
  const hasRunningTotalsIndicators = rawRows.some(row => {
    const rowText = Object.values(row).join(' ').toLowerCase();
    return rowText.includes('cumulative') || 
           rowText.includes('year to date') || 
           rowText.includes('ytd') ||
           rowText.includes('running total');
  });

  if (hasRunningTotalsIndicators) {
    console.log('   ✓ Detected: Running totals/cumulative');
    return 'same_cumulative';
  }

  // Default to different per quarter
  console.log('   ✓ Detected: Different spreadsheet per quarter (default)');
  return 'different_per_quarter';
}

module.exports = {
  processQuarterlySubmission,
  processDifferentPerQuarter,
  processSameCumulative,
  processSameSeparated,
  validateQuarterlyInputs,
  detectSpreadsheetType
};
