const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Get MTD submissions data from backend
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of submission objects
 */
export const getMTDSubmissions = async (userId = 1) => {
  const response = await fetch(`${API_BASE_URL}/api/submissions/list?userId=${userId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch submissions: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.success) {
    // Transform backend data to match frontend format
    return transformSubmissionsData(data.data);
  } else {
    throw new Error(data.message || 'Failed to fetch submissions');
  }
};

/**
 * Transform backend submission data to frontend format
 * @param {Array} backendData - Raw data from backend
 * @returns {Array} Formatted submission objects
 */
const transformSubmissionsData = (backendData) => {
  const deadlines = getTaxYearDeadlines();
  const currentYear = new Date().getFullYear();
  
  // Create a map of uploaded submissions
  const uploadedMap = {};
  backendData.forEach(submission => {
    const period = submission.type === 'quarterly' ? submission.quarter : 'annual';
    uploadedMap[period] = {
      id: `${period}-${submission.tax_year}`,
      period: period === 'annual' ? 'Y' : period.toUpperCase(),
      status: mapStatus(submission.status),
      uploadedAt: submission.created_at,
      uploadId: submission.upload_id,
      income: submission.income_total,
      expenses: submission.expense_total,
      profit: submission.profit_loss
    };
  });
  
  // Create full list with all periods
  const allPeriods = ['q1', 'q2', 'q3', 'q4', 'annual'];
  
  return allPeriods.map(period => {
    const uploaded = uploadedMap[period];
    const periodKey = period === 'annual' ? 'Annual' : period.toUpperCase();
    const deadlineInfo = deadlines[periodKey];
    
    if (uploaded) {
      return {
        id: uploaded.id,
        period: uploaded.period,
        description: deadlineInfo.period,
        dueDate: deadlineInfo.deadline.toISOString(),
        status: uploaded.status,
        submittedDate: uploaded.uploadedAt,
        uploadId: uploaded.uploadId,
        businessType: 'sole_trader'
      };
    } else {
      return {
        id: `${period}-${currentYear}`,
        period: period === 'annual' ? 'Y' : period.toUpperCase(),
        description: deadlineInfo.period,
        dueDate: deadlineInfo.deadline.toISOString(),
        status: 'Not Uploaded',
        submittedDate: null,
        uploadId: null,
        businessType: 'sole_trader'
      };
    }
  });
};

/**
 * Map backend status to frontend status
 * @param {string} backendStatus - Status from backend
 * @returns {string} Frontend status
 */
const mapStatus = (backendStatus) => {
  const statusMap = {
    'uploaded': 'Uploaded',
    'submitted_to_hmrc': 'Pending',
    'hmrc_accepted': 'Uploaded',
    'hmrc_rejected': 'Not Uploaded'
  };
  
  return statusMap[backendStatus] || 'Not Uploaded';
};

/**
 * Get all user submissions
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of submissions
 */
export const getUserSubmissions = async (userId = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/submissions/list?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.data : [];
  } catch (error) {
    console.error('Error fetching user submissions:', error);
    throw error;
  }
};

/**
 * Get submission logs (upload and HMRC submission history)
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of submission logs
 */
export const getSubmissionLogs = async (userId = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/submissions/logs/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.data : [];
  } catch (error) {
    console.error('Error fetching submission logs:', error);
    throw error;
  }
};

/**
 * Delete a submission (only if not submitted to HMRC)
 * @param {number} uploadId - Upload ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteSubmission = async (uploadId, userId = 1) => {
  const response = await fetch(`${API_BASE_URL}/api/submissions/${uploadId}?userId=${userId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete submission');
  }

  const data = await response.json();
  return data;
};

/**
 * Get individual submission status
 * @param {string} period - Period identifier (Q1, Q2, Q3, Q4, Y)
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Submission status object
 */
export const getSubmissionStatus = async (period, userId = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/submissions/list?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      // Find the specific period
      const periodLower = period.toLowerCase();
      const submission = data.data.find(s => {
        const submissionPeriod = s.type === 'quarterly' ? s.quarter : 'annual';
        return submissionPeriod === periodLower || 
               (periodLower === 'y' && submissionPeriod === 'annual');
      });
      
      return submission || { status: 'Not Uploaded' };
    }
    
    return { status: 'Not Uploaded' };
  } catch (error) {
    console.error(`Error fetching status for ${period}:`, error);
    throw error;
  }
};

/**
 * Refresh submission data
 * @returns {Promise<Array>} Updated submissions array
 */
export const refreshSubmissions = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/submissions/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.submissions;
  } catch (error) {
    console.error('Error refreshing submissions:', error);
    throw error;
  }
};

/**
 * Get current tax year deadlines
 * @returns {Object} Tax year deadline information
 */
export const getTaxYearDeadlines = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  
  // UK tax year runs April 6th to April 5th
  const taxYearStart = new Date(currentYear, 3, 6); // April 6th
  const taxYearEnd = new Date(currentYear + 1, 3, 5); // April 5th next year
  
  // If we're before April 6th, we're in the previous tax year
  const isBeforeTaxYearStart = currentDate < taxYearStart;
  const effectiveYear = isBeforeTaxYearStart ? currentYear - 1 : currentYear;
  
  return {
    taxYear: `${effectiveYear}/${(effectiveYear + 1).toString().slice(2)}`,
    Q1: {
      period: 'Apr - Jul',
      deadline: new Date(effectiveYear, 7, 5), // August 5th
    },
    Q2: {
      period: 'Jul - Oct', 
      deadline: new Date(effectiveYear, 10, 5), // November 5th
    },
    Q3: {
      period: 'Oct - Jan',
      deadline: new Date(effectiveYear + 1, 1, 5), // February 5th next year
    },
    Q4: {
      period: 'Jan - Apr',
      deadline: new Date(effectiveYear + 1, 4, 5), // May 5th next year
    },
    Annual: {
      period: 'Full Year',
      deadline: new Date(effectiveYear + 2, 0, 31), // January 31st (year after tax year end)
    }
  };
};

/**
 * Calculate days until deadline
 * @param {string} dueDateString - ISO date string
 * @returns {number} Days until deadline (negative if overdue)
 */
export const getDaysUntilDeadline = (dueDateString) => {
  const dueDate = new Date(dueDateString);
  const today = new Date();
  const diffTime = dueDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Get authentication token
 * @returns {string|null} Auth token
 */
const getAuthToken = () => {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || null;
};