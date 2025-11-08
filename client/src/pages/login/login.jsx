import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as loginAPI from './login.js';
import './login.css';

const Login = () => {
  const navigate = useNavigate();
  
  // Form data
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // UI state
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Validation helpers
  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await loginAPI.loginUser({
        email: formData.email.trim(),
        password: formData.password
      });

      console.log('Login successful:', result);
      
      // Store auth data
      loginAPI.storeAuthData(result.token, result.user, rememberMe);

      // Navigate to home page
      setTimeout(() => {
        navigate('/home');
      }, 1000);

    } catch (error) {
      console.error('Login failed:', error);
      setErrors({
        submit: error.message || 'Invalid email or password. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background Elements */}
      <div className="login-background">
        <div className="grid-background"></div>
        <div className="gradient-orb gradient-orb-1"></div>
        <div className="gradient-orb gradient-orb-2"></div>
        <div className="gradient-orb gradient-orb-3"></div>
      </div>

      {/* Login Card */}
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <Link to="/" className="back-link">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Home
          </Link>
          
          <div className="logo-section">
            <div className="logo-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="#22c55e"/>
                <path d="M8 12h16M8 16h16M8 20h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h1>Welcome Back</h1>
            <p>Sign in to continue to Quix</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-with-icon">
              <div className="input-icon-left">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 6h14v9H3V6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 6l7 5 7-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
                placeholder="john@example.com"
                autoFocus
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <span className="error-message">{errors.email}</span>
            )}
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-with-icon">
              <div className="input-icon-left">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="5" y="9" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
                  <path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 3l14 14M10 7a3 3 0 013 3m-6 4a7 7 0 0012-4.95" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="checkbox-custom"></span>
              Remember me
            </label>
            <Link to="/forgot-password" className="forgot-link">
              Forgot password?
            </Link>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="error-banner">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 6v4M10 14v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {errors.submit}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="spinner"></div>
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7 3h10v14H7M13 10H3m0 0l3-3m-3 3l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="divider">
          <span>or</span>
        </div>

        {/* Social Login (Future Feature) */}
        <div className="social-login">
          <button type="button" className="social-btn" disabled>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M18 10c0-4.4-3.6-8-8-8s-8 3.6-8 3.6 3.6 8 8 8 8-3.6 8-8z" fill="currentColor"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="register-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;