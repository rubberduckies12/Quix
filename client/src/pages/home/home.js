const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

/**
 * Get MTD submissions data
 * @returns {Promise<Array>} Array of submission objects
 */
export const getMTDSubmissions = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/submissions/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add authorization header if needed
        // 'Authorization': `Bearer ${getAuthToken()}`
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      return data.submissions;
    } else {
      throw new Error(data.message || 'Failed to fetch submissions');
    }
  } catch (error) {
    console.error('Error fetching MTD submissions:', error);
    
    // Return mock data for development
    return getMockSubmissions();
  }
};

/**
 * Get individual submission status
 * @param {string} period - Period identifier (Q1, Q2, Q3, Q4, Y)
 * @returns {Promise<Object>} Submission status object
 */
export const getSubmissionStatus = async (period) => {
  try {
    const response = await fetch(`${API_BASE_URL}/submissions/${period}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
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
 * Mock data for development/fallback
 * @returns {Array} Mock submissions data
 */
const getMockSubmissions = () => {
  const deadlines = getTaxYearDeadlines();
  
  return [
    {
      id: 'q1-2024',
      period: 'Q1',
      description: deadlines.Q1.period,
      dueDate: deadlines.Q1.deadline.toISOString(),
      status: 'Uploaded',
      submittedDate: '2024-07-15T10:30:00Z',
      businessType: 'sole_trader'
    },
    {
      id: 'q2-2024',
      period: 'Q2', 
      description: deadlines.Q2.period,
      dueDate: deadlines.Q2.deadline.toISOString(),
      status: 'Pending',
      submittedDate: '2024-10-20T14:22:00Z',
      businessType: 'sole_trader'
    },
    {
      id: 'q3-2024',
      period: 'Q3',
      description: deadlines.Q3.period,
      dueDate: deadlines.Q3.deadline.toISOString(),
      status: 'Not Uploaded',
      submittedDate: null,
      businessType: 'sole_trader'
    },
    {
      id: 'q4-2024',
      period: 'Q4',
      description: deadlines.Q4.period,
      dueDate: deadlines.Q4.deadline.toISOString(),
      status: 'Not Uploaded',
      submittedDate: null,
      businessType: 'sole_trader'
    },
    {
      id: 'annual-2024',
      period: 'Y',
      description: deadlines.Annual.period,
      dueDate: deadlines.Annual.deadline.toISOString(),
      status: 'Not Uploaded',
      submittedDate: null,
      businessType: 'sole_trader'
    }
  ];
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
 * Get authentication token (placeholder)
 * @returns {string|null} Auth token
 */
const getAuthToken = () => {
  // This would typically get token from localStorage, sessionStorage, or context
  return localStorage.getItem('authToken') || null;
};