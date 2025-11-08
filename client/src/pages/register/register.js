// Register API Service
// All registration-related API calls

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Check if email is available for registration
 * @param {string} email - Email address to check
 * @returns {Promise<Object>} Response with availability status
 */
export const checkEmailAvailability = async (email) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/check-email/${encodeURIComponent(email)}`);
    const data = await response.json();
    
    return {
      success: data.success,
      available: data.available,
      message: data.message
    };
  } catch (error) {
    console.error('Email availability check failed:', error);
    return {
      success: false,
      available: null,
      error: 'Failed to check email availability'
    };
  }
};

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.firstName - User's first name
 * @param {string} userData.lastName - User's last name
 * @param {string} userData.email - User's email address
 * @param {string} userData.password - User's password
 * @returns {Promise<Object>} Registration response with token and user data
 */
export const registerUser = async (userData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        email: userData.email.toLowerCase().trim(),
        password: userData.password
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Registration failed',
        code: data.code
      };
    }

    return {
      success: true,
      token: data.token,
      user: data.user,
      message: data.message
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection and try again.'
    };
  }
};

/**
 * Store authentication data in local storage
 * @param {string} token - JWT authentication token
 * @param {Object} user - User data object
 */
export const storeAuthData = (token, user) => {
  try {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    return true;
  } catch (error) {
    console.error('Failed to store auth data:', error);
    return false;
  }
};

/**
 * Clear authentication data from local storage
 */
export const clearAuthData = () => {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return true;
  } catch (error) {
    console.error('Failed to clear auth data:', error);
    return false;
  }
};

/**
 * Get stored authentication token
 * @returns {string|null} JWT token or null if not found
 */
export const getAuthToken = () => {
  try {
    return localStorage.getItem('token');
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
};

/**
 * Get stored user data
 * @returns {Object|null} User object or null if not found
 */
export const getStoredUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if user has valid token
 */
export const isAuthenticated = () => {
  const token = getAuthToken();
  return !!token;
};

export default {
  checkEmailAvailability,
  registerUser,
  storeAuthData,
  clearAuthData,
  getAuthToken,
  getStoredUser,
  isAuthenticated
};
