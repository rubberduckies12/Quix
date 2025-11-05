const moment = require('moment');
const validator = require('validator');
const { 
  validateBusinessDate, 
  parseUKDate, 
  formatForDisplay,
  isDateInTaxYear,
  getCurrentTaxYear 
} = require('./date.util');
const { 
  ValidationError, 
  createFieldError 
} = require('./errors.util');

/**
 * Comprehensive Validation Utility for MTD Tax Bridge Application
 * Handles UK tax-specific validation, transaction data, business rules, and file validation
 */
class ValidationUtil {
  constructor() {
    // Configuration
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileTypes: ['.xlsx', '.xls', '.csv'],
      maxDescriptionLength: 255,
      minPasswordLength: 8,
      maxTransactionAmount: 999999999.99,
      
      // UK-specific patterns
      patterns: {
        utr: /^[0-9]{10}$/,
        niNumber: /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D]{1}$/,
        vatNumber: /^(GB)?([0-9]{9}([0-9]{3})?|[A-Z]{2}[0-9]{3})$/,
        ukPostcode: /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i,
        taxYear: /^\d{4}-\d{2}$/,
        ukMobile: /^(\+44|0)(7\d{9})$/,
        ukLandline: /^(\+44|0)(1\d{8,9}|2\d{8})$/
      },
      
      // Required spreadsheet columns
      requiredColumns: {
        basic: ['date', 'amount', 'description'],
        vat: ['date', 'amount', 'description', 'vat'],
        detailed: ['date', 'amount', 'description', 'type', 'category']
      },

      // Error codes for programmatic handling
      errorCodes: {
        // UTR validation
        UTR_REQUIRED: 'UTR_REQUIRED',
        UTR_INVALID_FORMAT: 'UTR_INVALID_FORMAT',
        UTR_INVALID_CHECK_DIGIT: 'UTR_INVALID_CHECK_DIGIT',
        
        // NI Number validation
        NI_REQUIRED: 'NI_REQUIRED',
        NI_INVALID_FORMAT: 'NI_INVALID_FORMAT',
        NI_INVALID_PREFIX: 'NI_INVALID_PREFIX',
        NI_TEMPORARY_NOT_ACCEPTED: 'NI_TEMPORARY_NOT_ACCEPTED',
        
        // VAT Number validation
        VAT_INVALID_TYPE: 'VAT_INVALID_TYPE',
        VAT_INVALID_FORMAT: 'VAT_INVALID_FORMAT',
        VAT_INVALID_CHECK_DIGITS: 'VAT_INVALID_CHECK_DIGITS',
        
        // Postcode validation
        POSTCODE_REQUIRED: 'POSTCODE_REQUIRED',
        POSTCODE_INVALID_FORMAT: 'POSTCODE_INVALID_FORMAT',
        
        // Tax year validation
        TAX_YEAR_REQUIRED: 'TAX_YEAR_REQUIRED',
        TAX_YEAR_INVALID_FORMAT: 'TAX_YEAR_INVALID_FORMAT',
        TAX_YEAR_INVALID_SEQUENCE: 'TAX_YEAR_INVALID_SEQUENCE',
        TAX_YEAR_OUT_OF_RANGE: 'TAX_YEAR_OUT_OF_RANGE',
        
        // Transaction amount validation
        AMOUNT_REQUIRED: 'AMOUNT_REQUIRED',
        AMOUNT_INVALID_NUMBER: 'AMOUNT_INVALID_NUMBER',
        AMOUNT_ZERO_NOT_ALLOWED: 'AMOUNT_ZERO_NOT_ALLOWED',
        AMOUNT_EXCEEDS_MAXIMUM: 'AMOUNT_EXCEEDS_MAXIMUM',
        AMOUNT_TOO_MANY_DECIMALS: 'AMOUNT_TOO_MANY_DECIMALS',
        
        // Transaction date validation
        DATE_REQUIRED: 'DATE_REQUIRED',
        DATE_INVALID_FORMAT: 'DATE_INVALID_FORMAT',
        DATE_INVALID_TYPE: 'DATE_INVALID_TYPE',
        DATE_IN_FUTURE: 'DATE_IN_FUTURE',
        DATE_TOO_OLD: 'DATE_TOO_OLD',
        DATE_NOT_BUSINESS_DATE: 'DATE_NOT_BUSINESS_DATE',
        
        // Description validation
        DESCRIPTION_REQUIRED: 'DESCRIPTION_REQUIRED',
        DESCRIPTION_EMPTY: 'DESCRIPTION_EMPTY',
        DESCRIPTION_TOO_LONG: 'DESCRIPTION_TOO_LONG',
        DESCRIPTION_INVALID_CHARACTERS: 'DESCRIPTION_INVALID_CHARACTERS',
        
        // Transaction type validation
        TYPE_REQUIRED: 'TYPE_REQUIRED',
        TYPE_INVALID: 'TYPE_INVALID',
        
        // Business type validation
        BUSINESS_TYPE_REQUIRED: 'BUSINESS_TYPE_REQUIRED',
        BUSINESS_TYPE_INVALID: 'BUSINESS_TYPE_INVALID',
        
        // Email validation
        EMAIL_REQUIRED: 'EMAIL_REQUIRED',
        EMAIL_INVALID_FORMAT: 'EMAIL_INVALID_FORMAT',
        EMAIL_TOO_LONG: 'EMAIL_TOO_LONG',
        
        // Password validation
        PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',
        PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
        PASSWORD_WEAK: 'PASSWORD_WEAK',
        
        // Phone validation
        PHONE_INVALID_TYPE: 'PHONE_INVALID_TYPE',
        PHONE_INVALID_FORMAT: 'PHONE_INVALID_FORMAT',
        
        // File validation
        FILE_REQUIRED: 'FILE_REQUIRED',
        FILE_INVALID_TYPE: 'FILE_INVALID_TYPE',
        FILE_SIZE_REQUIRED: 'FILE_SIZE_REQUIRED',
        FILE_EMPTY: 'FILE_EMPTY',
        FILE_TOO_LARGE: 'FILE_TOO_LARGE',
        
        // Spreadsheet validation
        SPREADSHEET_DATA_REQUIRED: 'SPREADSHEET_DATA_REQUIRED',
        SPREADSHEET_INVALID_TYPE: 'SPREADSHEET_INVALID_TYPE',
        SPREADSHEET_INVALID_STRUCTURE: 'SPREADSHEET_INVALID_STRUCTURE',
        SPREADSHEET_MISSING_COLUMNS: 'SPREADSHEET_MISSING_COLUMNS',
        
        // General validation
        FIELD_REQUIRED: 'FIELD_REQUIRED',
        INVALID_INPUT: 'INVALID_INPUT'
      }
    };
  }

  // ====== TAX-SPECIFIC VALIDATION ======

  /**
   * Validate UK Unique Taxpayer Reference with check digit
   * @param {string} utr - UTR to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string}
   */
  validateUTR(utr) {
    if (!utr || typeof utr !== 'string') {
      return { 
        isValid: false, 
        error: 'UTR is required', 
        code: this.config.errorCodes.UTR_REQUIRED 
      };
    }

    const cleanUTR = utr.replace(/\s/g, '');
    
    // Check format
    if (!this.config.patterns.utr.test(cleanUTR)) {
      return { 
        isValid: false, 
        error: 'UTR must be 10 digits', 
        code: this.config.errorCodes.UTR_INVALID_FORMAT 
      };
    }

    // Check digit validation using modulus 23 algorithm
    const digits = cleanUTR.split('').map(Number);
    const weights = [6, 7, 8, 9, 10, 5, 4, 3, 2];
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * weights[i];
    }
    
    const remainder = sum % 23;
    const checkDigit = remainder === 0 ? 0 : 23 - remainder;
    
    if (digits[9] !== checkDigit) {
      return { 
        isValid: false, 
        error: 'Invalid UTR check digit', 
        code: this.config.errorCodes.UTR_INVALID_CHECK_DIGIT 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate UK National Insurance number
   * @param {string} niNumber - NI number to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string}
   */
  validateNINumber(niNumber) {
    if (!niNumber || typeof niNumber !== 'string') {
      return { 
        isValid: false, 
        error: 'National Insurance number is required', 
        code: this.config.errorCodes.NI_REQUIRED 
      };
    }

    const cleanNI = niNumber.replace(/\s/g, '').toUpperCase();
    
    // Check format
    if (!this.config.patterns.niNumber.test(cleanNI)) {
      return { 
        isValid: false, 
        error: 'Invalid National Insurance number format', 
        code: this.config.errorCodes.NI_INVALID_FORMAT 
      };
    }

    // Check for invalid prefixes
    const invalidPrefixes = ['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ'];
    const prefix = cleanNI.substring(0, 2);
    
    if (invalidPrefixes.includes(prefix)) {
      return { 
        isValid: false, 
        error: 'Invalid National Insurance number prefix', 
        code: this.config.errorCodes.NI_INVALID_PREFIX 
      };
    }

    // Check for temporary numbers starting with TN
    if (prefix === 'TN') {
      return { 
        isValid: false, 
        error: 'Temporary National Insurance numbers not accepted', 
        code: this.config.errorCodes.NI_TEMPORARY_NOT_ACCEPTED 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate UK VAT number (optional for some businesses)
   * @param {string} vatNumber - VAT number to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string}
   */
  validateVATNumber(vatNumber) {
    if (!vatNumber) {
      return { isValid: true }; // VAT number is optional
    }

    if (typeof vatNumber !== 'string') {
      return { 
        isValid: false, 
        error: 'VAT number must be a string', 
        code: this.config.errorCodes.VAT_INVALID_TYPE 
      };
    }

    const cleanVAT = vatNumber.replace(/\s/g, '').toUpperCase();
    
    // Check format
    if (!this.config.patterns.vatNumber.test(cleanVAT)) {
      return { 
        isValid: false, 
        error: 'Invalid VAT number format', 
        code: this.config.errorCodes.VAT_INVALID_FORMAT 
      };
    }

    // For standard 9-digit VAT numbers, validate check digit
    if (/^(GB)?[0-9]{9}$/.test(cleanVAT)) {
      const digits = cleanVAT.replace('GB', '');
      const checkDigits = this._calculateVATCheckDigits(digits.substring(0, 7));
      
      if (digits.substring(7, 9) !== checkDigits) {
        return { 
          isValid: false, 
          error: 'Invalid VAT number check digits', 
          code: this.config.errorCodes.VAT_INVALID_CHECK_DIGITS 
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate UK postcode format
   * @param {string} postcode - Postcode to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string}
   */
  validateUKPostcode(postcode) {
    if (!postcode || typeof postcode !== 'string') {
      return { 
        isValid: false, 
        error: 'Postcode is required', 
        code: this.config.errorCodes.POSTCODE_REQUIRED 
      };
    }

    const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase();
    
    if (!this.config.patterns.ukPostcode.test(cleanPostcode)) {
      return { 
        isValid: false, 
        error: 'Invalid UK postcode format', 
        code: this.config.errorCodes.POSTCODE_INVALID_FORMAT 
      };
    }

    // Additional validation for specific invalid patterns
    const invalidPatterns = [
      /^[QVX]/,  // Cannot start with Q, V, or X
      /^[A-Z]{2}[0-9][QVX]/, // Third character cannot be Q, V, or X in some formats
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(cleanPostcode)) {
        return { 
          isValid: false, 
          error: 'Invalid UK postcode format', 
          code: this.config.errorCodes.POSTCODE_INVALID_FORMAT 
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate tax year format using date utility
   * @param {string} taxYear - Tax year to validate (e.g., "2024-25")
   * @returns {Object} {isValid: boolean, error?: string, code?: string}
   */
  validateTaxYear(taxYear) {
    if (!taxYear || typeof taxYear !== 'string') {
      return { 
        isValid: false, 
        error: 'Tax year is required', 
        code: this.config.errorCodes.TAX_YEAR_REQUIRED 
      };
    }

    if (!this.config.patterns.taxYear.test(taxYear)) {
      return { 
        isValid: false, 
        error: 'Tax year must be in format YYYY-YY (e.g., 2024-25)', 
        code: this.config.errorCodes.TAX_YEAR_INVALID_FORMAT 
      };
    }

    const [startYear, endYearShort] = taxYear.split('-');
    const startYearNum = parseInt(startYear, 10);
    const endYearShortNum = parseInt(endYearShort, 10);
    const expectedEndYear = (startYearNum + 1) % 100;

    if (endYearShortNum !== expectedEndYear) {
      return { 
        isValid: false, 
        error: 'End year must be start year + 1', 
        code: this.config.errorCodes.TAX_YEAR_INVALID_SEQUENCE 
      };
    }

    // Use current tax year from date utility for range checking
    const currentTaxYear = getCurrentTaxYear();
    const currentStartYear = parseInt(currentTaxYear.split('-')[0], 10);
    
    if (startYearNum < currentStartYear - 10 || startYearNum > currentStartYear + 5) {
      return { 
        isValid: false, 
        error: 'Tax year is outside reasonable range', 
        code: this.config.errorCodes.TAX_YEAR_OUT_OF_RANGE 
      };
    }

    return { isValid: true };
  }

  // ====== TRANSACTION VALIDATION ======

  /**
   * Validate transaction amount
   * @param {number|string} amount - Amount to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string, value?: number}
   */
  validateTransactionAmount(amount) {
    if (amount === null || amount === undefined || amount === '') {
      return { 
        isValid: false, 
        error: 'Amount is required', 
        code: this.config.errorCodes.AMOUNT_REQUIRED 
      };
    }

    let numericAmount;
    
    if (typeof amount === 'string') {
      // Remove currency symbols and whitespace
      const cleanAmount = amount.replace(/[£$€,\s]/g, '');
      numericAmount = parseFloat(cleanAmount);
    } else {
      numericAmount = Number(amount);
    }

    if (isNaN(numericAmount)) {
      return { 
        isValid: false, 
        error: 'Amount must be a valid number', 
        code: this.config.errorCodes.AMOUNT_INVALID_NUMBER 
      };
    }

    if (numericAmount === 0) {
      return { 
        isValid: false, 
        error: 'Amount cannot be zero', 
        code: this.config.errorCodes.AMOUNT_ZERO_NOT_ALLOWED 
      };
    }

    if (Math.abs(numericAmount) > this.config.maxTransactionAmount) {
      return { 
        isValid: false, 
        error: `Amount cannot exceed £${this.config.maxTransactionAmount.toLocaleString()}`, 
        code: this.config.errorCodes.AMOUNT_EXCEEDS_MAXIMUM 
      };
    }

    // Check for maximum 2 decimal places
    const decimalPlaces = (numericAmount.toString().split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      return { 
        isValid: false, 
        error: 'Amount cannot have more than 2 decimal places', 
        code: this.config.errorCodes.AMOUNT_TOO_MANY_DECIMALS 
      };
    }

    return { isValid: true, value: numericAmount };
  }

  /**
   * Validate transaction date using date utility
   * @param {Date|string} date - Date to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string, value?: Date}
   */
  validateTransactionDate(date) {
    if (!date) {
      return { 
        isValid: false, 
        error: 'Date is required', 
        code: this.config.errorCodes.DATE_REQUIRED 
      };
    }

    let dateObj;
    
    try {
      if (typeof date === 'string') {
        // Use date utility for UK date parsing
        dateObj = parseUKDate(date);
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        return { 
          isValid: false, 
          error: 'Invalid date type', 
          code: this.config.errorCodes.DATE_INVALID_TYPE 
        };
      }
    } catch (error) {
      return { 
        isValid: false, 
        error: 'Invalid date format. Use DD/MM/YYYY', 
        code: this.config.errorCodes.DATE_INVALID_FORMAT 
      };
    }

    // Check if date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateObj.setHours(0, 0, 0, 0);
    
    if (dateObj > today) {
      return { 
        isValid: false, 
        error: 'Transaction date cannot be in the future', 
        code: this.config.errorCodes.DATE_IN_FUTURE 
      };
    }

    // Use date utility for business date validation
    if (!validateBusinessDate(dateObj)) {
      return { 
        isValid: false, 
        error: 'Date is not within reasonable business range', 
        code: this.config.errorCodes.DATE_NOT_BUSINESS_DATE 
      };
    }

    return { isValid: true, value: dateObj };
  }

  /**
   * Validate transaction description
   * @param {string} description - Description to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string, value?: string}
   */
  validateTransactionDescription(description) {
    if (!description || typeof description !== 'string') {
      return { 
        isValid: false, 
        error: 'Description is required', 
        code: this.config.errorCodes.DESCRIPTION_REQUIRED 
      };
    }

    const cleanDescription = description.trim();
    
    if (cleanDescription.length === 0) {
      return { 
        isValid: false, 
        error: 'Description cannot be empty', 
        code: this.config.errorCodes.DESCRIPTION_EMPTY 
      };
    }

    if (cleanDescription.length > this.config.maxDescriptionLength) {
      return { 
        isValid: false, 
        error: `Description cannot exceed ${this.config.maxDescriptionLength} characters`, 
        code: this.config.errorCodes.DESCRIPTION_TOO_LONG 
      };
    }

    // Check for suspicious patterns (basic SQL injection prevention)
    const suspiciousPatterns = [
      /script/i,
      /javascript/i,
      /onload/i,
      /onclick/i,
      /<.*>/,
      /SELECT.*FROM/i,
      /INSERT.*INTO/i,
      /UPDATE.*SET/i,
      /DELETE.*FROM/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(cleanDescription)) {
        return { 
          isValid: false, 
          error: 'Description contains invalid characters', 
          code: this.config.errorCodes.DESCRIPTION_INVALID_CHARACTERS 
        };
      }
    }

    return { isValid: true, value: cleanDescription };
  }

  /**
   * Validate transaction type
   * @param {string} type - Type to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string}
   */
  validateTransactionType(type) {
    if (!type || typeof type !== 'string') {
      return { 
        isValid: false, 
        error: 'Transaction type is required', 
        code: this.config.errorCodes.TYPE_REQUIRED 
      };
    }

    const validTypes = ['income', 'expense'];
    const cleanType = type.toLowerCase().trim();

    if (!validTypes.includes(cleanType)) {
      return { 
        isValid: false, 
        error: 'Transaction type must be "income" or "expense"', 
        code: this.config.errorCodes.TYPE_INVALID 
      };
    }

    return { isValid: true, value: cleanType };
  }

  // ====== BUSINESS DATA VALIDATION ======

  /**
   * Validate business type
   * @param {string} type - Business type to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string}
   */
  validateBusinessType(type) {
    if (!type || typeof type !== 'string') {
      return { 
        isValid: false, 
        error: 'Business type is required', 
        code: this.config.errorCodes.BUSINESS_TYPE_REQUIRED 
      };
    }

    const validTypes = ['sole_trader', 'landlord'];
    const cleanType = type.toLowerCase().trim();

    if (!validTypes.includes(cleanType)) {
      return { 
        isValid: false, 
        error: 'Business type must be "sole_trader" or "landlord"', 
        code: this.config.errorCodes.BUSINESS_TYPE_INVALID 
      };
    }

    return { isValid: true, value: cleanType };
  }

  /**
   * Validate email address
   * @param {string} email - Email to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string}
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { 
        isValid: false, 
        error: 'Email is required', 
        code: this.config.errorCodes.EMAIL_REQUIRED 
      };
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!validator.isEmail(cleanEmail)) {
      return { 
        isValid: false, 
        error: 'Invalid email format', 
        code: this.config.errorCodes.EMAIL_INVALID_FORMAT 
      };
    }

    // Additional checks for business use
    if (cleanEmail.length > 254) {
      return { 
        isValid: false, 
        error: 'Email address too long', 
        code: this.config.errorCodes.EMAIL_TOO_LONG 
      };
    }

    return { isValid: true, value: cleanEmail };
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string, strength?: string}
   */
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return { 
        isValid: false, 
        error: 'Password is required', 
        code: this.config.errorCodes.PASSWORD_REQUIRED 
      };
    }

    if (password.length < this.config.minPasswordLength) {
      return { 
        isValid: false, 
        error: `Password must be at least ${this.config.minPasswordLength} characters long`, 
        code: this.config.errorCodes.PASSWORD_TOO_SHORT 
      };
    }

    const requirements = {
      minLength: password.length >= this.config.minPasswordLength,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    const metRequirements = Object.values(requirements).filter(Boolean).length;

    if (metRequirements < 3) {
      return { 
        isValid: false, 
        error: 'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters',
        code: this.config.errorCodes.PASSWORD_WEAK 
      };
    }

    // Determine strength
    let strength = 'weak';
    if (metRequirements >= 4 && password.length >= 12) {
      strength = 'strong';
    } else if (metRequirements >= 3 && password.length >= 10) {
      strength = 'medium';
    }

    return { isValid: true, strength };
  }

  /**
   * Validate UK phone number (optional)
   * @param {string} phone - Phone number to validate
   * @returns {Object} {isValid: boolean, error?: string, code?: string}
   */
  validatePhoneNumber(phone) {
    if (!phone) {
      return { isValid: true }; // Phone number is optional
    }

    if (typeof phone !== 'string') {
      return { 
        isValid: false, 
        error: 'Phone number must be a string', 
        code: this.config.errorCodes.PHONE_INVALID_TYPE 
      };
    }

    const cleanPhone = phone.replace(/\s/g, '');

    // Check UK mobile or landline format
    if (!this.config.patterns.ukMobile.test(cleanPhone) && 
        !this.config.patterns.ukLandline.test(cleanPhone)) {
      return { 
        isValid: false, 
        error: 'Invalid UK phone number format', 
        code: this.config.errorCodes.PHONE_INVALID_FORMAT 
      };
    }

    return { isValid: true };
  }

  // ====== FILE VALIDATION ======

  /**
   * Validate file type
   * @param {Object} file - File object with name property
   * @returns {Object} {isValid: boolean, error?: string, code?: string}
   */
  validateFileType(file) {
    if (!file || !file.name) {
      return { 
        isValid: false, 
        error: 'File is required', 
        code: this.config.errorCodes.FILE_REQUIRED 
      };
    }

    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

    if (!this.config.allowedFileTypes.includes(fileExtension)) {
      return { 
        isValid: false, 
        error: `Invalid file type. Allowed types: ${this.config.allowedFileTypes.join(', ')}`,
        code: this.config.errorCodes.FILE_INVALID_TYPE 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate file size
   * @param {Object} file - File object with size property
   * @returns {Object} {isValid: boolean, error?: string, code?: string}
   */
  validateFileSize(file) {
    if (!file || typeof file.size !== 'number') {
      return { 
        isValid: false, 
        error: 'File size information is required', 
        code: this.config.errorCodes.FILE_SIZE_REQUIRED 
      };
    }

    if (file.size === 0) {
      return { 
        isValid: false, 
        error: 'File cannot be empty', 
        code: this.config.errorCodes.FILE_EMPTY 
      };
    }

    if (file.size > this.config.maxFileSize) {
      const maxSizeMB = Math.round(this.config.maxFileSize / (1024 * 1024));
      return { 
        isValid: false, 
        error: `File size cannot exceed ${maxSizeMB}MB`,
        code: this.config.errorCodes.FILE_TOO_LARGE 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate spreadsheet structure
   * @param {Array} data - Parsed spreadsheet data
   * @param {string} validationType - Type of validation ('basic', 'vat', 'detailed')
   * @returns {Object} {isValid: boolean, error?: string, code?: string, missingColumns?: Array}
   */
  validateSpreadsheetStructure(data, validationType = 'basic') {
    if (!Array.isArray(data) || data.length === 0) {
      return { 
        isValid: false, 
        error: 'Spreadsheet data is required', 
        code: this.config.errorCodes.SPREADSHEET_DATA_REQUIRED 
      };
    }

    const requiredColumns = this.config.requiredColumns[validationType];
    if (!requiredColumns) {
      return { 
        isValid: false, 
        error: 'Invalid validation type', 
        code: this.config.errorCodes.SPREADSHEET_INVALID_TYPE 
      };
    }

    // Check if first row has headers
    const firstRow = data[0];
    if (!firstRow || typeof firstRow !== 'object') {
      return { 
        isValid: false, 
        error: 'Invalid spreadsheet structure', 
        code: this.config.errorCodes.SPREADSHEET_INVALID_STRUCTURE 
      };
    }

    const availableColumns = Object.keys(firstRow).map(col => col.toLowerCase().trim());
    const missingColumns = [];

    for (const requiredCol of requiredColumns) {
      const found = availableColumns.some(col => 
        col.includes(requiredCol) || 
        requiredCol.includes(col.replace(/\s+/g, ''))
      );
      
      if (!found) {
        missingColumns.push(requiredCol);
      }
    }

    if (missingColumns.length > 0) {
      return { 
        isValid: false, 
        error: `Missing required columns: ${missingColumns.join(', ')}`,
        code: this.config.errorCodes.SPREADSHEET_MISSING_COLUMNS,
        missingColumns 
      };
    }

    return { isValid: true };
  }

  // ====== UTILITY FUNCTIONS ======

  /**
   * Sanitize string input
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized string
   */
  sanitizeString(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .replace(/\\/g, '') // Remove backslashes
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate required fields
   * @param {Array} fields - Array of required field names
   * @param {Object} data - Data object to validate
   * @returns {Object} {isValid: boolean, errors: Array}
   */
  validateRequired(fields, data) {
    const errors = [];

    for (const field of fields) {
      if (!data || data[field] === null || data[field] === undefined || data[field] === '') {
        errors.push(createFieldError(
          field,
          `${field} is required`,
          this.config.errorCodes.FIELD_REQUIRED
        ));
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Format validation errors for user display
   * @param {Array} errors - Array of error objects
   * @returns {Object} Formatted error response
   */
  formatValidationErrors(errors) {
    if (!Array.isArray(errors)) {
      return {
        hasErrors: false,
        errors: [],
        summary: 'No errors'
      };
    }

    const formattedErrors = errors.map(error => ({
      field: error.field || 'unknown',
      message: error.error || error.message || 'Unknown error',
      code: error.code || this.config.errorCodes.INVALID_INPUT
    }));

    return {
      hasErrors: formattedErrors.length > 0,
      errors: formattedErrors,
      summary: `${formattedErrors.length} validation error${formattedErrors.length !== 1 ? 's' : ''} found`,
      count: formattedErrors.length
    };
  }

  /**
   * Validate complete transaction object
   * @param {Object} transaction - Transaction to validate
   * @returns {Object} Complete validation result
   */
  validateTransaction(transaction) {
    console.log('🔎 validateTransaction called with:', JSON.stringify(transaction, null, 2));
    
    const errors = [];
    
    // Check for required fields
    if (!transaction) {
      console.log('❌ Transaction is null/undefined');
      return { isValid: false, errors: ['Transaction data is required'] };
    }
    
    // Check amount
    if (!transaction.amount && transaction.amount !== 0) {
      console.log('❌ Amount missing:', transaction.amount);
      errors.push('Amount is required');
    } else {
      const amount = parseFloat(transaction.amount);
      if (isNaN(amount)) {
        console.log('❌ Amount not a number:', transaction.amount);
        errors.push('Amount must be a valid number');
      }
    }
    
    // Check description
    if (!transaction.description || transaction.description.trim() === '') {
      console.log('❌ Description missing:', transaction.description);
      errors.push('Description is required');
    }
    
    // Date is optional for basic validation
    
    const isValid = errors.length === 0;
    console.log(`✅ Validation result: ${isValid ? 'VALID' : 'INVALID'}`, errors);
    
    return { isValid, errors };
  }

  /**
   * Get all available error codes for programmatic handling
   * @returns {Object} All error codes
   */
  getErrorCodes() {
    return { ...this.config.errorCodes };
  }

  // ====== PRIVATE HELPER METHODS ======

  /**
   * Calculate VAT check digits using modulus 97 algorithm
   * @private
   */
  _calculateVATCheckDigits(sevenDigits) {
    const weights = [8, 7, 6, 5, 4, 3, 2];
    let sum = 0;

    for (let i = 0; i < 7; i++) {
      sum += parseInt(sevenDigits[i]) * weights[i];
    }

    const remainder = sum % 97;
    const checkDigits = 97 - remainder;

    return checkDigits.toString().padStart(2, '0');
  }
}

// Create singleton instance
const validationUtil = new ValidationUtil();

// Export both the class and instance
module.exports = {
  ValidationUtil,
  default: validationUtil,
  
  // Export commonly used functions directly
  validateUTR: (utr) => validationUtil.validateUTR(utr),
  validateNINumber: (niNumber) => validationUtil.validateNINumber(niNumber),
  validateVATNumber: (vatNumber) => validationUtil.validateVATNumber(vatNumber),
  validateUKPostcode: (postcode) => validationUtil.validateUKPostcode(postcode),
  validateTaxYear: (taxYear) => validationUtil.validateTaxYear(taxYear),
  validateTransactionAmount: (amount) => validationUtil.validateTransactionAmount(amount),
  validateTransactionDate: (date) => validationUtil.validateTransactionDate(date),
  validateTransactionDescription: (description) => validationUtil.validateTransactionDescription(description),
  validateTransactionType: (type) => validationUtil.validateTransactionType(type),
  validateBusinessType: (type) => validationUtil.validateBusinessType(type),
  validateEmail: (email) => validationUtil.validateEmail(email),
  validatePassword: (password) => validationUtil.validatePassword(password),
  validatePhoneNumber: (phone) => validationUtil.validatePhoneNumber(phone),
  validateFileType: (file) => validationUtil.validateFileType(file),
  validateFileSize: (file) => validationUtil.validateFileSize(file),
  validateSpreadsheetStructure: (data, type) => validationUtil.validateSpreadsheetStructure(data, type),
  sanitizeString: (input) => validationUtil.sanitizeString(input),
  validateRequired: (fields, data) => validationUtil.validateRequired(fields, data),
  formatValidationErrors: (errors) => validationUtil.formatValidationErrors(errors),
  validateTransaction: (transaction) => validationUtil.validateTransaction(transaction),
  getErrorCodes: () => validationUtil.getErrorCodes()
};