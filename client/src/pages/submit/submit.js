const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

class SubmitApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Helper method for making requests
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Don't set Content-Type for FormData (file uploads)
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Get upload configuration from /api/files/config
  async getUploadConfig() {
    return this.request('/api/files/config');
  }

  // Process spreadsheet file via /api/files/process
  async processSpreadsheet(file, submissionData) {
    console.log('📤 processSpreadsheet called with:', submissionData);
    
    const formData = new FormData();
    
    // Add the file
    formData.append('spreadsheet', file);
    
    // Add submission details with proper formatting
    formData.append('submissionType', this.formatSubmissionType(submissionData.submissionType));
    formData.append('businessType', submissionData.businessType || 'sole_trader');
    
    // Add quarter if it's a quarterly submission
    if (submissionData.submissionType === 'quarterly' && submissionData.quarter) {
      const formattedQuarter = this.formatQuarter(submissionData.quarter);
      formData.append('quarter', formattedQuarter);
      console.log('📋 Quarter being sent:', formattedQuarter);
    }

    // Add tax year
    formData.append('taxYear', submissionData.taxYear || new Date().getFullYear());

    // Add submission options if provided (for quarterly submissions)
    if (submissionData.submissionOptions) {
      formData.append('submissionOptions', JSON.stringify(submissionData.submissionOptions));
      console.log('📋 Submission options being sent:', submissionData.submissionOptions);
    }

    console.log('📤 Final form data being sent:');
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    return this.request('/api/files/process', {
      method: 'POST',
      body: formData,
    });
  }

  // Validate file before processing via /api/files/validate
  async validateFile(file) {
    const formData = new FormData();
    formData.append('spreadsheet', file);

    return this.request('/api/files/validate', {
      method: 'POST',
      body: formData,
    });
  }

  // Format quarter value for API (convert 'q1' to match backend expectations)
  formatQuarter(quarter) {
    if (!quarter) return null;
    
    console.log('🔍 formatQuarter input:', quarter);
    
    // Keep it as-is if it's already in the right format
    if (quarter.startsWith('q')) {
      console.log('✅ Quarter already formatted:', quarter);
      return quarter.toLowerCase(); // Just ensure lowercase
    }
    
    // If it's just a number, add 'q' prefix
    const quarterMap = {
      '1': 'q1',
      '2': 'q2',
      '3': 'q3',
      '4': 'q4'
    };
    
    const result = quarterMap[quarter] || quarter;
    console.log('✅ Quarter formatted:', result);
    return result;
  }

  // Format submission type for API
  formatSubmissionType(type) {
    if (type === 'yearly') return 'annual';
    return type; // quarterly stays the same
  }

  // Parse API response for frontend display
  parseSubmissionResponse(response) {
    if (!response.success) {
      throw new Error(response.message || 'Submission failed');
    }

    return {
      success: true,
      submissionId: response.submission?.submissionId,
      fileProcessing: {
        fileName: response.fileProcessing?.fileName,
        rowsProcessed: response.fileProcessing?.totalRowsProcessed,
        fileSize: response.fileProcessing?.fileSize
      },
      categorization: {
        totalTransactions: response.categorization?.totalTransactions,
        successful: response.categorization?.successfullyProcessed,
        personal: response.categorization?.personalTransactionsExcluded,
        errors: response.categorization?.errorsEncountered
      },
      dataQuality: {
        successRate: response.dataQuality?.successRate,
        needsReview: response.dataQuality?.needsReview,
        recommendations: response.dataQuality?.recommendedActions || []
      },
      submission: response.submission,
      processingTime: response.processingDetails?.processingTime,
      message: this.generateSuccessMessage(response)
    };
  }

  // Generate user-friendly success message
  generateSuccessMessage(response) {
    const { categorization, dataQuality } = response;
    
    let message = `Successfully processed ${categorization?.totalTransactions || 0} transactions.\n`;
    message += `${categorization?.successful || 0} transactions categorized successfully.\n`;
    
    if (categorization?.personal > 0) {
      message += `${categorization.personal} personal transactions excluded.\n`;
    }
    
    if (dataQuality?.successRate) {
      message += `Success rate: ${dataQuality.successRate}%\n`;
    }
    
    message += '\nSubmission prepared for HMRC!';
    
    return message;
  }

  // Save submission to database
  async saveSubmission(submissionData, userId = 1) {
    console.log('💾 Saving submission to database:', {
      submissionType: submissionData.submissionType,
      quarter: submissionData.quarter,
      userId
    });

    return this.request('/api/submissions/save', {
      method: 'POST',
      body: JSON.stringify({
        submissionData,
        userId
      }),
    });
  }

  // Get user submissions
  async getUserSubmissions(userId = 1) {
    return this.request(`/api/submissions/list?userId=${userId}`);
  }

  // Get submission details
  async getSubmissionDetails(uploadId) {
    return this.request(`/api/submissions/${uploadId}`);
  }

  // Update submission status
  async updateSubmissionStatus(uploadId, status) {
    return this.request(`/api/submissions/${uploadId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Handle API errors with user-friendly messages
  handleApiError(error) {
    console.error('Submit API Error:', error);

    // Check for specific error types
    if (error.message.includes('Validation failed')) {
      return {
        type: 'validation',
        message: 'Please check your form inputs and try again.',
        details: error.details || []
      };
    }

    if (error.message.includes('No valid data found')) {
      return {
        type: 'data',
        message: 'No valid transaction data found in your file. Please check your spreadsheet format.',
        details: []
      };
    }

    if (error.message.includes('File too large')) {
      return {
        type: 'file_size',
        message: 'File is too large. Please use a file smaller than 10MB.',
        details: []
      };
    }

    if (error.message.includes('categorized successfully')) {
      return {
        type: 'categorization',
        message: 'Unable to categorize transactions. Please check your data format.',
        details: []
      };
    }

    if (error.message.toLowerCase().includes('network') || error.message.includes('fetch')) {
      return {
        type: 'network',
        message: 'Connection error. Please check your internet connection and try again.',
        details: []
      };
    }

    // Generic error
    return {
      type: 'generic',
      message: error.message || 'An unexpected error occurred. Please try again.',
      details: []
    };
  }
}

// Create and export singleton instance
const submitApiService = new SubmitApiService();
export default submitApiService;

// Export class for testing
export { SubmitApiService };