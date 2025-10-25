const Joi = require('joi');

class ValidationUtil {
  // =====================================================
  // HMRC SPECIFIC VALIDATIONS
  // =====================================================
  
  /**
   * Validate UTR (Unique Taxpayer Reference)
   * Format: 10 digits, specific check digit algorithm
   */
  static validateUTR(utr) {
    if (!utr || typeof utr !== 'string') return false;
    
    // Remove spaces and ensure 10 digits
    const cleanUTR = utr.replace(/\s/g, '');
    if (!/^\d{10}$/.test(cleanUTR)) return false;
    
    // UTR check digit validation (HMRC algorithm)
    const weights = [6, 7, 8, 9, 10, 5, 4, 3, 2];
    const digits = cleanUTR.split('').map(Number);
    const checkDigit = digits[9];
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * weights[i];
    }
    
    const remainder = sum % 11;
    const expectedCheck = remainder < 2 ? remainder : 11 - remainder;
    
    return checkDigit === expectedCheck;
  }

  /**
   * Validate VAT Number
   * UK Format: 9 digits or 12 digits (with branch identifier)
   */
  static validateVATNumber(vatNumber) {
    if (!vatNumber) return false;
    
    const cleanVAT = vatNumber.replace(/\s/g, '').toUpperCase();
    
    // UK VAT format: GB123456789 or GB123456789000
    const ukVATPattern = /^GB(\d{9}|\d{12})$/;
    return ukVATPattern.test(cleanVAT);
  }

  /**
   * Validate National Insurance Number
   * Format: 2 letters, 6 digits, 1 letter (e.g., AB123456C)
   */
  static validateNINumber(niNumber) {
    if (!niNumber) return false;
    
    const cleanNI = niNumber.replace(/\s/g, '').toUpperCase();
    const niPattern = /^[ABCEGHJKLMNOPRSTWXYZ][ABCEGHJKLMNPRSTWXYZ]\d{6}[A-D]$/;
    
    // Exclude invalid prefixes
    const invalidPrefixes = ['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ'];
    const prefix = cleanNI.substring(0, 2);
    
    return niPattern.test(cleanNI) && !invalidPrefixes.includes(prefix);
  }

  // =====================================================
  // BUSINESS VALIDATIONS
  // =====================================================
  
  /**
   * Validate UK Postcode
   */
  static validateUKPostcode(postcode) {
    if (!postcode) return false;
    
    const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase();
    const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/;
    
    return postcodePattern.test(cleanPostcode);
  }

  /**
   * Validate Tax Year Format
   * Expected: YYYY-YY (e.g., 2024-25)
   */
  static validateTaxYear(taxYear) {
    if (!taxYear) return false;
    
    const taxYearPattern = /^\d{4}-\d{2}$/;
    if (!taxYearPattern.test(taxYear)) return false;
    
    const [startYear, endYear] = taxYear.split('-').map(Number);
    const fullEndYear = 2000 + endYear;
    
    return fullEndYear === startYear + 1;
  }

  /**
   * Validate Quarter Format
   * Expected: Q1, Q2, Q3, Q4
   */
  static validateQuarter(quarter) {
    return ['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter);
  }

  // =====================================================
  // FINANCIAL VALIDATIONS
  // =====================================================
  
  /**
   * Validate Currency Amount
   * Must be positive, max 2 decimal places, reasonable bounds
   */
  static validateAmount(amount, maxAmount = 1000000) {
    if (typeof amount !== 'number') return false;
    if (amount < 0 || amount > maxAmount) return false;
    
    // Check max 2 decimal places
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    return decimalPlaces <= 2;
  }

  /**
   * Validate VAT Rate
   * UK VAT rates: 0%, 5%, 20%
   */
  static validateVATRate(rate) {
    const validRates = [0, 5, 20];
    return validRates.includes(rate);
  }

  // =====================================================
  // FILE VALIDATIONS
  // =====================================================
  
  /**
   * Validate File Upload
   */
  static validateFileUpload(file) {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    return {
      isValid: allowedTypes.includes(file.mimetype) && file.size <= maxSize,
      type: file.mimetype,
      size: file.size,
      maxSize
    };
  }

  // =====================================================
  // JOI SCHEMAS FOR REQUEST VALIDATION
  // =====================================================
  
  /**
   * User Registration Schema
   */
  static get userRegistrationSchema() {
    return Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
        .messages({
          'string.pattern.base': 'Password must contain at least 1 lowercase, 1 uppercase, 1 number, and 1 special character'
        }),
      firstName: Joi.string().min(2).max(50).required(),
      lastName: Joi.string().min(2).max(50).required(),
      utr: Joi.string().custom((value, helpers) => {
        if (!ValidationUtil.validateUTR(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }).required().messages({
        'any.invalid': 'Invalid UTR format'
      }),
      niNumber: Joi.string().custom((value, helpers) => {
        if (value && !ValidationUtil.validateNINumber(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }).optional().messages({
        'any.invalid': 'Invalid National Insurance number format'
      }),
      tradingName: Joi.string().max(255).optional(),
      tradeDescription: Joi.string().max(500).optional(),
      businessStartDate: Joi.date().max('now').optional(),
      isLandlord: Joi.boolean().default(false),
      propertyCount: Joi.when('isLandlord', {
        is: true,
        then: Joi.number().integer().min(1).max(100).required(),
        otherwise: Joi.optional()
      }),
      isVatRegistered: Joi.boolean().default(false),
      vatNumber: Joi.when('isVatRegistered', {
        is: true,
        then: Joi.string().custom((value, helpers) => {
          if (!ValidationUtil.validateVATNumber(value)) {
            return helpers.error('any.invalid');
          }
          return value;
        }).required(),
        otherwise: Joi.optional()
      }).messages({
        'any.invalid': 'Invalid VAT number format'
      }),
      vatScheme: Joi.when('isVatRegistered', {
        is: true,
        then: Joi.string().valid('standard', 'flat_rate', 'cash_accounting').required(),
        otherwise: Joi.optional()
      }),
      flatRatePercentage: Joi.when('vatScheme', {
        is: 'flat_rate',
        then: Joi.number().min(0).max(100).required(),
        otherwise: Joi.optional()
      })
    });
  }

  /**
   * User Login Schema
   */
  static get userLoginSchema() {
    return Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    });
  }

  /**
   * Password Reset Schema
   */
  static get passwordResetSchema() {
    return Joi.object({
      token: Joi.string().required(),
      password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
        .messages({
          'string.pattern.base': 'Password must contain at least 1 lowercase, 1 uppercase, 1 number, and 1 special character'
        })
    });
  }

  /**
   * Email Verification Schema
   */
  static get emailVerificationSchema() {
    return Joi.object({
      token: Joi.string().required()
    });
  }

  /**
   * Forgot Password Schema
   */
  static get forgotPasswordSchema() {
    return Joi.object({
      email: Joi.string().email().required()
    });
  }

  /**
   * Refresh Token Schema
   */
  static get refreshTokenSchema() {
    return Joi.object({
      refreshToken: Joi.string().required()
    });
  }

  /**
   * Transaction Schema
   */
  static get transactionSchema() {
    return Joi.object({
      transactionDate: Joi.date().required(),
      description: Joi.string().min(1).max(500).required(),
      grossAmount: Joi.number().custom((value, helpers) => {
        if (!ValidationUtil.validateAmount(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }).required().messages({
        'any.invalid': 'Invalid amount format'
      }),
      netAmount: Joi.number().custom((value, helpers) => {
        if (value !== undefined && !ValidationUtil.validateAmount(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }).optional(),
      vatAmount: Joi.number().custom((value, helpers) => {
        if (value !== undefined && !ValidationUtil.validateAmount(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }).optional(),
      transactionType: Joi.string().valid('income', 'expense').required(),
      incomeCategory: Joi.when('transactionType', {
        is: 'income',
        then: Joi.string().valid(
          'self_employment_income',
          'property_rental_income',
          'other_business_income',
          'dividend_income',
          'interest_income'
        ).optional(),
        otherwise: Joi.forbidden()
      }),
      expenseCategory: Joi.when('transactionType', {
        is: 'expense',
        then: Joi.string().valid(
          'office_costs',
          'car_van_travel',
          'clothing',
          'staff_costs',
          'things_to_resell',
          'legal_financial_costs',
          'marketing_hospitality',
          'training_courses',
          'insurance',
          'repairs_maintenance',
          'rent_rates',
          'phone_internet',
          'professional_fees',
          'bank_charges',
          'other_business_expenses'
        ).optional(),
        otherwise: Joi.forbidden()
      }),
      propertyExpenseCategory: Joi.when('transactionType', {
        is: 'expense',
        then: Joi.string().valid(
          'letting_agent_fees',
          'legal_management_costs',
          'maintenance_repairs',
          'insurance',
          'mortgage_interest',
          'rent_ground_rent',
          'council_tax',
          'utilities',
          'safety_certificates',
          'other_property_expenses'
        ).optional(),
        otherwise: Joi.forbidden()
      }),
      vatRate: Joi.number().custom((value, helpers) => {
        if (value !== undefined && !ValidationUtil.validateVATRate(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }).optional().messages({
        'any.invalid': 'Invalid VAT rate'
      }),
      reference: Joi.string().max(100).optional(),
      supplierName: Joi.string().max(255).optional(),
      taxYear: Joi.string().custom((value, helpers) => {
        if (!ValidationUtil.validateTaxYear(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }).required().messages({
        'any.invalid': 'Invalid tax year format'
      }),
      quarter: Joi.string().custom((value, helpers) => {
        if (value && !ValidationUtil.validateQuarter(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }).optional().messages({
        'any.invalid': 'Invalid quarter format'
      }),
      userNotes: Joi.string().max(1000).optional()
    });
  }

  /**
   * Spreadsheet Upload Schema
   */
  static get spreadsheetUploadSchema() {
    return Joi.object({
      taxYear: Joi.string().custom((value, helpers) => {
        if (!ValidationUtil.validateTaxYear(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }).required(),
      periodStart: Joi.date().required(),
      periodEnd: Joi.date().min(Joi.ref('periodStart')).required(),
      vatEnabled: Joi.boolean().default(false),
      vatScheme: Joi.when('vatEnabled', {
        is: true,
        then: Joi.string().valid('standard', 'flat_rate', 'cash_accounting').required(),
        otherwise: Joi.optional()
      })
    });
  }

  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================
  
  /**
   * Sanitize input string
   */
  static sanitizeString(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate and format phone number
   */
  static validateUKPhone(phone) {
    if (!phone) return null;
    
    const cleanPhone = phone.replace(/\s|-/g, '');
    const ukPhonePattern = /^(\+44|0044|0)[1-9]\d{8,9}$/;
    
    if (!ukPhonePattern.test(cleanPhone)) return null;
    
    // Normalize to +44 format
    if (cleanPhone.startsWith('0')) {
      return '+44' + cleanPhone.substring(1);
    }
    if (cleanPhone.startsWith('0044')) {
      return '+44' + cleanPhone.substring(4);
    }
    return cleanPhone.startsWith('+44') ? cleanPhone : null;
  }

  /**
   * Check if date is within tax year
   */
  static isDateInTaxYear(date, taxYear) {
    const [startYear] = taxYear.split('-').map(Number);
    const taxYearStart = new Date(startYear, 3, 6); // April 6th
    const taxYearEnd = new Date(startYear + 1, 3, 5); // April 5th next year
    
    const checkDate = new Date(date);
    return checkDate >= taxYearStart && checkDate <= taxYearEnd;
  }

  /**
   * Get current tax year
   */
  static getCurrentTaxYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Tax year starts April 6th
    if (month < 3 || (month === 3 && now.getDate() < 6)) {
      return `${year - 1}-${String(year).slice(-2)}`;
    } else {
      return `${year}-${String(year + 1).slice(-2)}`;
    }
  }

  /**
   * Get tax year dates
   */
  static getTaxYearDates(taxYear) {
    const [startYear] = taxYear.split('-').map(Number);
    return {
      start: new Date(startYear, 3, 6), // April 6th
      end: new Date(startYear + 1, 3, 5) // April 5th next year
    };
  }

  /**
   * Validate email domain (optional whitelist)
   */
  static validateEmailDomain(email, allowedDomains = null) {
    if (!email) return false;
    
    const domain = email.split('@')[1];
    if (!domain) return false;
    
    if (allowedDomains && Array.isArray(allowedDomains)) {
      return allowedDomains.includes(domain.toLowerCase());
    }
    
    // Basic domain validation
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainPattern.test(domain);
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password) {
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      noCommon: !['password', '123456', 'qwerty', 'admin'].includes(password.toLowerCase())
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    
    return {
      isValid: score >= 5,
      score,
      checks,
      strength: score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong'
    };
  }

  /**
   * Clean and format UTR
   */
  static formatUTR(utr) {
    if (!utr) return null;
    return utr.replace(/\s/g, '');
  }

  /**
   * Clean and format VAT number
   */
  static formatVATNumber(vatNumber) {
    if (!vatNumber) return null;
    return vatNumber.replace(/\s/g, '').toUpperCase();
  }

  /**
   * Clean and format NI number
   */
  static formatNINumber(niNumber) {
    if (!niNumber) return null;
    return niNumber.replace(/\s/g, '').toUpperCase();
  }

  /**
   * Clean and format postcode
   */
  static formatPostcode(postcode) {
    if (!postcode) return null;
    
    const clean = postcode.replace(/\s/g, '').toUpperCase();
    if (clean.length <= 4) return clean;
    
    // Add space before last 3 characters
    return clean.slice(0, -3) + ' ' + clean.slice(-3);
  }
}

module.exports = ValidationUtil;