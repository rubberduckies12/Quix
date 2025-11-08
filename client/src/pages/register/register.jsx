import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as registerAPI from './register.js';
import './register.css';

const Register = () => {
  const navigate = useNavigate();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const totalSteps = 3;

  // Form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // UI state
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Password strength calculation
  useEffect(() => {
    if (!formData.password) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (formData.password.length >= 8) strength++;
    if (/[a-z]/.test(formData.password)) strength++;
    if (/[A-Z]/.test(formData.password)) strength++;
    if (/[0-9]/.test(formData.password)) strength++;
    if (/[^a-zA-Z0-9]/.test(formData.password)) strength++;

    setPasswordStrength(strength);
  }, [formData.password]);

  // Email availability check
  useEffect(() => {
    const checkEmail = async () => {
      if (formData.email && validateEmail(formData.email)) {
        setEmailChecking(true);
        try {
          const isAvailable = await registerAPI.checkEmailAvailability(formData.email);
          setEmailAvailable(isAvailable);
        } catch (error) {
          console.error('Email check failed:', error);
          setEmailAvailable(null);
        } finally {
          setEmailChecking(false);
        }
      } else {
        setEmailAvailable(null);
      }
    };

    const timeoutId = setTimeout(checkEmail, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.email]);

  // Validation helpers
  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password) => {
    return password.length >= 8 &&
           /[a-z]/.test(password) &&
           /[A-Z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[^a-zA-Z0-9]/.test(password);
  };

  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 1:
        if (!formData.firstName.trim()) {
          newErrors.firstName = 'First name is required';
        } else if (formData.firstName.trim().length < 2) {
          newErrors.firstName = 'First name must be at least 2 characters';
        }
        if (!formData.lastName.trim()) {
          newErrors.lastName = 'Last name is required';
        } else if (formData.lastName.trim().length < 2) {
          newErrors.lastName = 'Last name must be at least 2 characters';
        }
        break;

      case 2:
        if (!formData.email) {
          newErrors.email = 'Email is required';
        } else if (!validateEmail(formData.email)) {
          newErrors.email = 'Please enter a valid email address';
        } else if (emailAvailable === false) {
          newErrors.email = 'This email is already registered';
        }
        break;

      case 3:
        if (!formData.password) {
          newErrors.password = 'Password is required';
        } else if (!validatePassword(formData.password)) {
          newErrors.password = 'Password must meet all requirements';
        }
        if (!formData.confirmPassword) {
          newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
        break;

      default:
        break;
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

  // Navigation handlers
  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      if (currentStep < totalSteps) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const goToStep = (step) => {
    if (step <= currentStep || completedSteps.includes(step - 1)) {
      setCurrentStep(step);
    }
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep(3)) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await registerAPI.registerUser({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password
      });

      console.log('Registration successful:', result);
      
      // Store auth data
      registerAPI.storeAuthData(result.token, result.user);

      // Navigate to dashboard or home
      setTimeout(() => {
        navigate('/');
      }, 1500);

    } catch (error) {
      console.error('Registration failed:', error);
      setErrors({
        submit: error.message || 'Registration failed. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return '#ef4444';
    if (passwordStrength <= 3) return '#f59e0b';
    return '#22c55e';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength === 0) return 'Enter a password';
    if (passwordStrength <= 2) return 'Weak';
    if (passwordStrength <= 3) return 'Good';
    return 'Strong';
  };

  return (
    <div className="register-container">
      {/* Background Elements */}
      <div className="register-background">
        <div className="grid-background"></div>
        <div className="gradient-orb gradient-orb-1"></div>
        <div className="gradient-orb gradient-orb-2"></div>
        <div className="gradient-orb gradient-orb-3"></div>
      </div>

      {/* Registration Card */}
      <div className="register-card">
        {/* Header */}
        <div className="register-header">
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
            <h1>Create Your Account</h1>
            <p>Join Quix and simplify your tax reporting</p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="progress-container">
          <div className="progress-steps">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`progress-step ${currentStep === step ? 'active' : ''} ${completedSteps.includes(step) ? 'completed' : ''}`}
                onClick={() => goToStep(step)}
                style={{ cursor: completedSteps.includes(step - 1) || step <= currentStep ? 'pointer' : 'not-allowed' }}
              >
                <div className="step-circle">
                  {completedSteps.includes(step) ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                <span className="step-label">
                  {step === 1 && 'Personal'}
                  {step === 2 && 'Email'}
                  {step === 3 && 'Security'}
                </span>
              </div>
            ))}
          </div>
          <div className="progress-bar">
            <div 
              className="progress-bar-fill"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="register-form">
          {/* Step 1: Personal Info */}
          {currentStep === 1 && (
            <div className="form-step">
              <div className="step-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="23" stroke="#22c55e" strokeWidth="2"/>
                  <path d="M24 14a6 6 0 100 12 6 6 0 000-12zm-8 18a8 8 0 0116 0" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              
              <h2>Let's start with your name</h2>
              <p className="step-description">
                We'll use this to personalize your experience
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={errors.firstName ? 'error' : ''}
                    placeholder="John"
                    autoFocus
                  />
                  {errors.firstName && (
                    <span className="error-message">{errors.firstName}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={errors.lastName ? 'error' : ''}
                    placeholder="Doe"
                  />
                  {errors.lastName && (
                    <span className="error-message">{errors.lastName}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Email */}
          {currentStep === 2 && (
            <div className="form-step">
              <div className="step-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="23" stroke="#22c55e" strokeWidth="2"/>
                  <path d="M10 16h28v16H10V16z" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 16l14 10 14-10" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              
              <h2>What's your email?</h2>
              <p className="step-description">
                We'll use this for your login and important updates
              </p>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-with-icon">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={errors.email ? 'error' : ''}
                    placeholder="john@example.com"
                    autoFocus
                  />
                  {emailChecking && (
                    <div className="input-icon">
                      <div className="spinner"></div>
                    </div>
                  )}
                  {!emailChecking && emailAvailable === true && (
                    <div className="input-icon success">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  {!emailChecking && emailAvailable === false && (
                    <div className="input-icon error">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
                {errors.email && (
                  <span className="error-message">{errors.email}</span>
                )}
                {!errors.email && emailAvailable === true && formData.email && (
                  <span className="success-message">Email is available!</span>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Password */}
          {currentStep === 3 && (
            <div className="form-step">
              <div className="step-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="23" stroke="#22c55e" strokeWidth="2"/>
                  <rect x="14" y="20" width="20" height="14" rx="2" stroke="#22c55e" strokeWidth="2"/>
                  <path d="M18 20v-4a6 6 0 0112 0v4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="24" cy="27" r="2" fill="#22c55e"/>
                </svg>
              </div>
              
              <h2>Create a secure password</h2>
              <p className="step-description">
                Your password should be strong and unique
              </p>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-with-icon">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={errors.password ? 'error' : ''}
                    placeholder="Enter your password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
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
                
                {/* Password Strength */}
                {formData.password && (
                  <div className="password-strength">
                    <div className="strength-bar">
                      <div 
                        className="strength-fill"
                        style={{ 
                          width: `${(passwordStrength / 5) * 100}%`,
                          backgroundColor: getPasswordStrengthColor()
                        }}
                      ></div>
                    </div>
                    <span style={{ color: getPasswordStrengthColor() }}>
                      {getPasswordStrengthText()}
                    </span>
                  </div>
                )}

                {/* Password Requirements */}
                <div className="password-requirements">
                  <p className="requirements-title">Password must contain:</p>
                  <ul>
                    <li className={formData.password.length >= 8 ? 'met' : ''}>
                      At least 8 characters
                    </li>
                    <li className={/[a-z]/.test(formData.password) ? 'met' : ''}>
                      One lowercase letter
                    </li>
                    <li className={/[A-Z]/.test(formData.password) ? 'met' : ''}>
                      One uppercase letter
                    </li>
                    <li className={/[0-9]/.test(formData.password) ? 'met' : ''}>
                      One number
                    </li>
                    <li className={/[^a-zA-Z0-9]/.test(formData.password) ? 'met' : ''}>
                      One special character
                    </li>
                  </ul>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-with-icon">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={errors.confirmPassword ? 'error' : ''}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
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
                {errors.confirmPassword && (
                  <span className="error-message">{errors.confirmPassword}</span>
                )}
                {!errors.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <span className="success-message">Passwords match!</span>
                )}
              </div>
            </div>
          )}

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

          {/* Navigation Buttons */}
          <div className="form-actions">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="btn-secondary"
                disabled={isLoading}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Previous
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                className="btn-primary"
              >
                Next
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="spinner"></div>
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="register-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="login-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
