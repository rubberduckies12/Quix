import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { 
  UserPlusIcon, 
  EyeIcon, 
  EyeSlashIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

const Register = () => {
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  useEffect(() => {
    setIsClient(true);
    
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Disable all animations on mobile
  const noAnimation = shouldReduceMotion || isMobile;

  // Animation variants - disabled on mobile
  const fadeInUp = {
    hidden: { opacity: noAnimation ? 1 : 0, y: noAnimation ? 0 : 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: noAnimation ? 0 : 0.4, 
        ease: [0.4, 0, 0.2, 1] 
      }
    }
  };

  const fadeInLeft = {
    hidden: { opacity: noAnimation ? 1 : 0, x: noAnimation ? 0 : -30 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { 
        duration: noAnimation ? 0 : 0.4, 
        ease: [0.4, 0, 0.2, 1] 
      }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: noAnimation ? 0 : 0.1,
        delayChildren: noAnimation ? 0 : 0.1
      }
    }
  };

  // Password strength calculation
  useEffect(() => {
    const password = formData.password;
    let strength = 0;
    
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 15;
    if (/[@$!%*?&]/.test(password)) strength += 10;
    
    setPasswordStrength(Math.min(strength, 100));
  }, [formData.password]);

  // Email availability check (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.email && isValidEmail(formData.email)) {
        checkEmailAvailability(formData.email);
      } else {
        setEmailAvailable(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.email]);

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkEmailAvailability = async (email) => {
    setEmailChecking(true);
    try {
      const response = await fetch(`http://localhost:3001/api/auth/check-email/${encodeURIComponent(email)}`);
      const data = await response.json();
      setEmailAvailable(data.available);
    } catch (error) {
      console.error('Email check failed:', error);
      setEmailAvailable(null);
    } finally {
      setEmailChecking(false);
    }
  };

  // Step validation functions
  const validateStep1 = () => {
    const newErrors = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    } else if (emailAvailable === false) {
      newErrors.email = 'This email is already registered';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors = {};

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1: return validateStep1();
      case 2: return validateStep2();
      case 3: return validateStep3();
      default: return true;
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Navigation functions
  const nextStep = () => {
    if (validateCurrentStep()) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setErrors({}); // Clear errors when going back
  };

  const goToStep = (step) => {
    if (step <= currentStep || completedSteps.includes(step - 1)) {
      setCurrentStep(step);
      setErrors({});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep3()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.toLowerCase().trim(),
          password: formData.password
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Store token and redirect to dashboard
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect to dashboard or home
        window.location.href = '/dashboard'; // or wherever you want to redirect
      } else {
        setErrors({ submit: data.error || 'Registration failed' });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 30) return 'bg-red-500';
    if (passwordStrength < 60) return 'bg-yellow-500';
    if (passwordStrength < 80) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 30) return 'Weak';
    if (passwordStrength < 60) return 'Fair';
    if (passwordStrength < 80) return 'Good';
    return 'Strong';
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-2xl">Q</span>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 relative">
      {/* Excel Grid Background */}
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, #22c55e 1px, transparent 1px),
              linear-gradient(to bottom, #22c55e 1px, transparent 1px)
            `,
            backgroundSize: '40px 30px'
          }}
        />
      </div>

      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          animate={noAnimation ? {} : { rotate: 360 }}
          transition={noAnimation ? {} : { 
            duration: 20, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute top-1/4 left-1/4 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-green-200/30 rounded-full blur-3xl"
        />
        <motion.div 
          animate={noAnimation ? {} : { rotate: -360 }}
          transition={noAnimation ? {} : { 
            duration: 25, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute bottom-1/4 right-1/4 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 bg-green-300/20 rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="w-full max-w-md"
        >
          {/* Header */}
          <motion.div 
            variants={fadeInUp}
            className="text-center mb-8"
          >
            {/* Back to Home Link */}
            <Link 
              to="/" 
              className="inline-flex items-center text-green-600 hover:text-green-700 mb-6 text-sm font-medium transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Back to Home
            </Link>

            {/* Logo */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-green-600 rounded-3xl flex items-center justify-center shadow-xl">
                <span className="text-white font-bold text-2xl">Q</span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-black mb-2">
              Join Quix
            </h1>
            <p className="text-gray-600 text-lg">
              Start your MTD journey today
            </p>
          </motion.div>

          {/* Registration Wizard */}
          <motion.div 
            variants={fadeInLeft}
            className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-green-100/50"
          >
            {/* Progress Indicator */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <motion.button
                      type="button"
                      onClick={() => goToStep(step)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-200 ${
                        step < currentStep || completedSteps.includes(step)
                          ? 'bg-green-600 text-white cursor-pointer hover:bg-green-700'
                          : step === currentStep
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={step > currentStep && !completedSteps.includes(step - 1)}
                      whileHover={noAnimation ? {} : { scale: step <= currentStep || completedSteps.includes(step) ? 1.05 : 1 }}
                      whileTap={noAnimation ? {} : { scale: step <= currentStep || completedSteps.includes(step) ? 0.95 : 1 }}
                    >
                      {completedSteps.includes(step) && step !== currentStep ? (
                        <CheckCircleIcon className="w-5 h-5" />
                      ) : (
                        step
                      )}
                    </motion.button>
                    {step < 3 && (
                      <div className={`w-16 sm:w-24 h-1 mx-2 rounded-full transition-colors duration-200 ${
                        completedSteps.includes(step) ? 'bg-green-600' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Step Labels */}
              <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                <span className={currentStep === 1 ? 'font-semibold text-green-600' : ''}>
                  Personal Info
                </span>
                <span className={currentStep === 2 ? 'font-semibold text-green-600' : ''}>
                  Email Setup
                </span>
                <span className={currentStep === 3 ? 'font-semibold text-green-600' : ''}>
                  Security
                </span>
              </div>
            </div>

            <form onSubmit={currentStep === 3 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={staggerContainer}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <UserIcon className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Let's get to know you</h3>
                    <p className="text-gray-600">Tell us your name to get started with Quix</p>
                  </div>

                  {/* Name Fields Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* First Name */}
                    <motion.div variants={fadeInUp}>
                      <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                          errors.firstName 
                            ? 'border-red-300 focus:border-red-500' 
                            : formData.firstName 
                            ? 'border-green-300 focus:border-green-500'
                            : 'border-gray-200 focus:border-green-500'
                        }`}
                        placeholder="John"
                        autoFocus
                      />
                      {errors.firstName && (
                        <p className="mt-1 text-sm text-red-600 flex items-center">
                          <XCircleIcon className="w-4 h-4 mr-1" />
                          {errors.firstName}
                        </p>
                      )}
                    </motion.div>

                    {/* Last Name */}
                    <motion.div variants={fadeInUp}>
                      <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                          errors.lastName 
                            ? 'border-red-300 focus:border-red-500' 
                            : formData.lastName 
                            ? 'border-green-300 focus:border-green-500'
                            : 'border-gray-200 focus:border-green-500'
                        }`}
                        placeholder="Doe"
                      />
                      {errors.lastName && (
                        <p className="mt-1 text-sm text-red-600 flex items-center">
                          <XCircleIcon className="w-4 h-4 mr-1" />
                          {errors.lastName}
                        </p>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Email Setup */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={staggerContainer}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <EnvelopeIcon className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Hi {formData.firstName}! What's your email?
                    </h3>
                    <p className="text-gray-600">We'll use this to keep you updated on your MTD journey</p>
                  </div>

                  {/* Email */}
                  <motion.div variants={fadeInUp}>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 pr-12 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                          errors.email 
                            ? 'border-red-300 focus:border-red-500' 
                            : emailAvailable === true
                            ? 'border-green-300 focus:border-green-500'
                            : emailAvailable === false
                            ? 'border-red-300 focus:border-red-500'
                            : 'border-gray-200 focus:border-green-500'
                        }`}
                        placeholder="john@example.com"
                        autoFocus
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {emailChecking && (
                          <div className="animate-spin w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full" />
                        )}
                        {!emailChecking && emailAvailable === true && (
                          <CheckCircleIcon className="w-5 h-5 text-green-500" />
                        )}
                        {!emailChecking && emailAvailable === false && (
                          <XCircleIcon className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <XCircleIcon className="w-4 h-4 mr-1" />
                        {errors.email}
                      </p>
                    )}
                    {!errors.email && emailAvailable === true && formData.email && (
                      <p className="mt-1 text-sm text-green-600 flex items-center">
                        <CheckCircleIcon className="w-4 h-4 mr-1" />
                        Email is available
                      </p>
                    )}
                  </motion.div>

                  <motion.div variants={fadeInUp} className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-sm text-green-700">
                      <SparklesIcon className="w-4 h-4 inline mr-1" />
                      We'll never spam you or share your email with third parties.
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {/* Step 3: Security Setup */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={staggerContainer}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <LockClosedIcon className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Secure your account</h3>
                    <p className="text-gray-600">Choose a strong password to protect your MTD data</p>
                  </div>

                  {/* Password */}
                  <motion.div variants={fadeInUp}>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 pr-12 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                          errors.password 
                            ? 'border-red-300 focus:border-red-500' 
                            : formData.password && passwordStrength >= 80
                            ? 'border-green-300 focus:border-green-500'
                            : 'border-gray-200 focus:border-green-500'
                        }`}
                        placeholder="Create a strong password"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    
                    {/* Password Strength Indicator */}
                    {formData.password && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">Password Strength:</span>
                          <span className={`text-sm font-medium ${
                            passwordStrength < 30 ? 'text-red-600' :
                            passwordStrength < 60 ? 'text-yellow-600' :
                            passwordStrength < 80 ? 'text-blue-600' : 'text-green-600'
                          }`}>
                            {getPasswordStrengthText()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                            style={{ width: `${passwordStrength}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <XCircleIcon className="w-4 h-4 mr-1" />
                        {errors.password}
                      </p>
                    )}
                  </motion.div>

                  {/* Confirm Password */}
                  <motion.div variants={fadeInUp}>
                    <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 pr-12 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                          errors.confirmPassword 
                            ? 'border-red-300 focus:border-red-500' 
                            : formData.confirmPassword && formData.password === formData.confirmPassword
                            ? 'border-green-300 focus:border-green-500'
                            : 'border-gray-200 focus:border-green-500'
                        }`}
                        placeholder="Confirm your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showConfirmPassword ? (
                          <EyeSlashIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <XCircleIcon className="w-4 h-4 mr-1" />
                        {errors.confirmPassword}
                      </p>
                    )}
                    {!errors.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword && (
                      <p className="mt-1 text-sm text-green-600 flex items-center">
                        <CheckCircleIcon className="w-4 h-4 mr-1" />
                        Passwords match
                      </p>
                    )}
                  </motion.div>

                  <motion.div variants={fadeInUp} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start space-x-3">
                      <ShieldCheckIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900 mb-1">Password Requirements:</p>
                        <ul className="text-sm text-blue-700 space-y-1">
                          <li className={formData.password.length >= 8 ? 'line-through' : ''}>• At least 8 characters</li>
                          <li className={/[A-Z]/.test(formData.password) ? 'line-through' : ''}>• One uppercase letter</li>
                          <li className={/[a-z]/.test(formData.password) ? 'line-through' : ''}>• One lowercase letter</li>
                          <li className={/\d/.test(formData.password) ? 'line-through' : ''}>• One number</li>
                          <li className={/[@$!%*?&]/.test(formData.password) ? 'line-through' : ''}>• One special character (@$!%*?&)</li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* Submit Error */}
              {errors.submit && (
                <motion.div 
                  variants={fadeInUp}
                  className="p-4 bg-red-50 border border-red-200 rounded-xl"
                >
                  <p className="text-sm text-red-600 flex items-center">
                    <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
                    {errors.submit}
                  </p>
                </motion.div>
              )}

              {/* Navigation Buttons */}
              <motion.div 
                variants={fadeInUp}
                className="flex items-center justify-between pt-4"
              >
                {/* Back Button */}
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center px-6 py-3 text-gray-600 hover:text-gray-800 font-semibold transition-colors duration-200"
                  >
                    <ArrowLeftIcon className="w-4 h-4 mr-2" />
                    Back
                  </button>
                )}
                
                {currentStep === 1 && <div></div>}

                {/* Next/Submit Button */}
                {currentStep < 3 ? (
                  <button
                    type="submit"
                    disabled={currentStep === 2 && (emailChecking || emailAvailable !== true)}
                    className="flex items-center bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-200"
                  >
                    Next
                    <ArrowRightIcon className="w-4 h-4 ml-2" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-200"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <UserPlusIcon className="w-5 h-5 mr-2" />
                        Create Account
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            </form>

            {/* Login Link */}
            <motion.div 
              variants={fadeInUp}
              className="text-center mt-8 pt-6 border-t border-gray-200"
            >
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link 
                  to="/login" 
                  className="text-green-600 hover:text-green-700 font-semibold transition-colors"
                >
                  Sign in here
                </Link>
              </p>
            </motion.div>
          </motion.div>

          {/* Features Preview */}
          <motion.div 
            variants={fadeInUp}
            className="text-center mt-8"
          >
            <p className="text-gray-600 text-sm mb-4">
              What you'll get with Quix:
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="flex items-center text-green-600">
                <SparklesIcon className="w-4 h-4 mr-1" />
                Keep your Excel workflow
              </div>
              <div className="flex items-center text-green-600">
                <CheckCircleIcon className="w-4 h-4 mr-1" />
                MTD compliance
              </div>
              <div className="flex items-center text-green-600">
                <SparklesIcon className="w-4 h-4 mr-1" />
                One-click HMRC submissions
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
