/**
 * DisplayTransactions API Service
 * Handles API calls and data processing for transaction display
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class DisplayTransactionsService {
  /**
   * Fetch categorized transaction data from API
   */
  static async fetchCategorizedData(fileId) {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${fileId}/categorized`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error fetching categorized data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download categorized data as JSON
   */
  static downloadJSON(categorizedData, filename = 'hmrc-categorization.json') {
    try {
      const dataStr = JSON.stringify(categorizedData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      
      URL.revokeObjectURL(url);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error downloading JSON:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Process categorized data for display
   */
  static processCategorizedData(rawData) {
    try {
      // Extract the categorized data from the response
      let categorizedData = rawData;
      
      // Handle different response structures
      if (rawData.categorizedData) {
        categorizedData = rawData.categorizedData;
      } else if (rawData.data && rawData.data.categorizedData) {
        categorizedData = rawData.data.categorizedData;
      }

      // Validate required fields
      if (!categorizedData.frontendSummary) {
        throw new Error('No frontend summary found in categorized data');
      }

      // Process and enrich the data
      const processedData = {
        ...categorizedData,
        frontendSummary: categorizedData.frontendSummary.map(category => ({
          ...category,
          formattedAmount: this.formatCurrency(category.totalAmount),
          transactionCount: category.transactionCount || 0
        })),
        totals: this.calculateTotals(categorizedData.frontendSummary),
        processingStats: this.calculateProcessingStats(categorizedData.summary)
      };

      return {
        success: true,
        data: processedData
      };
    } catch (error) {
      console.error('❌ Error processing categorized data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate financial totals
   */
  static calculateTotals(frontendSummary) {
    const incomeCategories = ['periodAmount', 'turnover', 'premiumsOfLeaseGrant'];
    
    const totalIncome = frontendSummary
      .filter(cat => incomeCategories.includes(cat.category))
      .reduce((sum, cat) => sum + cat.totalAmount, 0);
    
    const totalExpenses = frontendSummary
      .filter(cat => !incomeCategories.includes(cat.category))
      .reduce((sum, cat) => sum + cat.totalAmount, 0);

    return {
      income: totalIncome,
      expenses: totalExpenses,
      netProfit: totalIncome - totalExpenses,
      formattedIncome: this.formatCurrency(totalIncome),
      formattedExpenses: this.formatCurrency(totalExpenses),
      formattedNetProfit: this.formatCurrency(totalIncome - totalExpenses)
    };
  }

  /**
   * Calculate processing statistics
   */
  static calculateProcessingStats(summary) {
    const total = summary.successful + summary.personal + summary.errors;
    
    return {
      total,
      successRate: total > 0 ? Math.round((summary.successful / total) * 100) : 0,
      personalRate: total > 0 ? Math.round((summary.personal / total) * 100) : 0,
      errorRate: total > 0 ? Math.round((summary.errors / total) * 100) : 0,
      hasErrors: summary.errors > 0,
      hasPersonal: summary.personal > 0
    };
  }

  /**
   * Format currency for display
   */
  static formatCurrency(amount) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  }

  /**
   * Validate categorized data structure
   */
  static validateCategorizedData(data) {
    const errors = [];

    if (!data) {
      errors.push('No data provided');
      return { isValid: false, errors };
    }

    if (!data.frontendSummary) {
      errors.push('Missing frontendSummary');
    } else if (!Array.isArray(data.frontendSummary)) {
      errors.push('frontendSummary must be an array');
    }

    if (!data.summary) {
      errors.push('Missing summary');
    }

    if (!data.businessType) {
      errors.push('Missing businessType');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default DisplayTransactionsService;