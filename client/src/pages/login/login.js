// Login API Service
// All login-related API calls

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Login user
 * @param {Object} credentials - User credentials
 * @param {string} credentials.email - User's email
 * @param {string} credentials.password - User's password
 * @returns {Promise<Object>} Login response with token and user data
 */
export const loginUser = async (credentials) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    return data;
  } catch (error) {
    console.error('Login API error:', error);
    throw error;
  }
};

/**
 * Store authentication data in localStorage or sessionStorage
 * @param {string} token - JWT token
 * @param {Object} user - User data
 * @param {boolean} rememberMe - Whether to persist login
 */
export const storeAuthData = (token, user, rememberMe = false) => {
  const storage = rememberMe ? localStorage : sessionStorage;
  
  storage.setItem('authToken', token);
  storage.setItem('user', JSON.stringify(user));
  
  console.log('Auth data stored successfully');
};

/**
 * Clear authentication data
 */
export const clearAuthData = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('user');
  
  console.log('Auth data cleared');
};

/**
 * Get stored auth token
 * @returns {string|null} Auth token
 */
export const getAuthToken = () => {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
};

/**
 * Get stored user data
 * @returns {Object|null} User data
 */
export const getStoredUser = () => {
  const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
export const isAuthenticated = () => {
  return !!getAuthToken();
};

/**
 * Logout user
 * @returns {Promise<Object>} Logout response
 */
export const logoutUser = async () => {
  try {
    const token = getAuthToken();
    
    if (token) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
    }
    
    clearAuthData();
    
    return { success: true };
  } catch (error) {
    console.error('Logout API error:', error);
    // Still clear auth data even if API call fails
    clearAuthData();
    throw error;
  }
};

/**
 * Verify token validity
 * @returns {Promise<Object>} User data if valid
 */
export const verifyToken = async () => {
  try {
    const token = getAuthToken();
    
    if (!token) {
      throw new Error('No token found');
    }
    
    const response = await fetch(`${API_URL}/api/auth/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      clearAuthData();
      throw new Error(data.error || 'Token verification failed');
    }

    return data.user;
  } catch (error) {
    console.error('Token verification error:', error);
    clearAuthData();
    throw error;
  }
};