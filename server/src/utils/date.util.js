const { zonedTimeToUtc, utcToZonedTime, format } = require('date-fns-tz');
const { 
  parseISO, 
  isValid, 
  differenceInDays, 
  addDays, 
  addMonths,
  startOfDay,
  endOfDay,
  isWeekend,
  isBefore,
  isAfter,
  isSameDay
} = require('date-fns');

/**
 * Comprehensive date utility for UK MTD (Making Tax Digital) tax application
 * Handles UK tax years, quarterly periods, HMRC deadlines, and VAT periods
 */
class DateUtil {
  static UK_TIMEZONE = 'Europe/London';
  
  // UK Bank Holidays (basic set - in production, fetch from gov.uk API)
  static UK_BANK_HOLIDAYS_2024 = [
    '2024-01-01', // New Year's Day
    '2024-03-29', // Good Friday
    '2024-04-01', // Easter Monday
    '2024-05-06', // Early May Bank Holiday
    '2024-05-27', // Spring Bank Holiday
    '2024-08-26', // Summer Bank Holiday
    '2024-12-25', // Christmas Day
    '2024-12-26'  // Boxing Day
  ];

  static UK_BANK_HOLIDAYS_2025 = [
    '2025-01-01', // New Year's Day
    '2025-04-18', // Good Friday
    '2025-04-21', // Easter Monday
    '2025-05-05', // Early May Bank Holiday
    '2025-05-26', // Spring Bank Holiday
    '2025-08-25', // Summer Bank Holiday
    '2025-12-25', // Christmas Day
    '2025-12-26'  // Boxing Day
  ];

  static UK_BANK_HOLIDAYS_2026 = [
    '2026-01-01', // New Year's Day
    '2026-04-03', // Good Friday
    '2026-04-06', // Easter Monday
    '2026-05-04', // Early May Bank Holiday
    '2026-05-25', // Spring Bank Holiday
    '2026-08-31', // Summer Bank Holiday
    '2026-12-25', // Christmas Day
    '2026-12-28'  // Boxing Day (substitute - 26th is Saturday)
  ];

  static UK_BANK_HOLIDAYS_2027 = [
    '2027-01-01', // New Year's Day
    '2027-03-26', // Good Friday
    '2027-03-29', // Easter Monday
    '2027-05-03', // Early May Bank Holiday
    '2027-05-31', // Spring Bank Holiday
    '2027-08-30', // Summer Bank Holiday
    '2027-12-27', // Christmas Day (substitute - 25th is Saturday)
    '2027-12-28'  // Boxing Day (substitute - 26th is Sunday)
  ];

  static UK_BANK_HOLIDAYS_2028 = [
    '2028-01-03', // New Year's Day (substitute - 1st is Saturday)
    '2028-04-14', // Good Friday
    '2028-04-17', // Easter Monday
    '2028-05-01', // Early May Bank Holiday
    '2028-05-29', // Spring Bank Holiday
    '2028-08-28', // Summer Bank Holiday
    '2028-12-25', // Christmas Day
    '2028-12-26'  // Boxing Day
  ];

  // All bank holidays combined for easy lookup
  static ALL_UK_BANK_HOLIDAYS = {
    2024: this.UK_BANK_HOLIDAYS_2024,
    2025: this.UK_BANK_HOLIDAYS_2025,
    2026: this.UK_BANK_HOLIDAYS_2026,
    2027: this.UK_BANK_HOLIDAYS_2027,
    2028: this.UK_BANK_HOLIDAYS_2028
  };

  // =====================================================
  // TAX YEAR CALCULATIONS
  // =====================================================

  /**
   * Get current UK tax year in format "YYYY-YY"
   * @returns {string} Current tax year (e.g., "2024-25")
   */
  static getCurrentTaxYear() {
    const now = this.nowInUK();
    return this.getTaxYearForDate(now);
  }

  /**
   * Get tax year for any given date
   * @param {Date|string} date - Date to check
   * @returns {string} Tax year in format "YYYY-YY"
   */
  static getTaxYearForDate(date) {
    const ukDate = this.toUKDate(date);
    const year = ukDate.getFullYear();
    const month = ukDate.getMonth();
    const day = ukDate.getDate();

    // Tax year starts April 6th
    if (month < 3 || (month === 3 && day < 6)) {
      // Before April 6th - previous tax year
      return `${year - 1}-${String(year).slice(-2)}`;
    } else {
      // April 6th onwards - current tax year
      return `${year}-${String(year + 1).slice(-2)}`;
    }
  }

  /**
   * Get start and end dates for a tax year
   * @param {string} taxYear - Tax year in format "YYYY-YY"
   * @returns {Object} {start: Date, end: Date} in UK timezone
   */
  static getTaxYearDates(taxYear) {
    const [startYearStr] = taxYear.split('-');
    const startYear = parseInt(startYearStr);
    
    const start = new Date(startYear, 3, 6); // April 6th (month is 0-indexed)
    const end = new Date(startYear + 1, 3, 5, 23, 59, 59); // April 5th next year

    return {
      start: this.toUKDate(start),
      end: this.toUKDate(end)
    };
  }

  /**
   * Check if date falls within specified tax year
   * @param {Date|string} date - Date to check
   * @param {string} taxYear - Tax year in format "YYYY-YY"
   * @returns {boolean} True if date is in tax year
   */
  static isDateInTaxYear(date, taxYear) {
    const checkDate = this.toUKDate(date);
    const { start, end } = this.getTaxYearDates(taxYear);
    
    return checkDate >= start && checkDate <= end;
  }

  /**
   * Get all tax years between two dates
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {string[]} Array of tax years
   */
  static getTaxYearsBetween(startDate, endDate) {
    const start = this.toUKDate(startDate);
    const end = this.toUKDate(endDate);
    const taxYears = new Set();

    let current = new Date(start);
    while (current <= end) {
      taxYears.add(this.getTaxYearForDate(current));
      current = addDays(current, 1);
    }

    return Array.from(taxYears).sort();
  }

  /**
   * Get available tax years for selection (current and previous years)
   * @param {number} yearsBack - Number of years back to include (default: 7)
   * @param {number} yearsForward - Number of years forward to include (default: 2)
   * @returns {Object[]} Array of tax year options
   */
  static getAvailableTaxYears(yearsBack = 7, yearsForward = 2) {
    const currentTaxYear = this.getCurrentTaxYear();
    const currentStartYear = parseInt(currentTaxYear.split('-')[0]);
    const taxYears = [];

    // Add past years
    for (let i = yearsBack; i >= 0; i--) {
      const year = currentStartYear - i;
      const taxYear = `${year}-${String(year + 1).slice(-2)}`;
      const { start, end } = this.getTaxYearDates(taxYear);
      
      taxYears.push({
        value: taxYear,
        label: `${taxYear} Tax Year`,
        description: `${this.formatForDisplay(start)} - ${this.formatForDisplay(end)}`,
        isCurrent: taxYear === currentTaxYear,
        isPast: year < currentStartYear,
        isFuture: year > currentStartYear
      });
    }

    // Add future years
    for (let i = 1; i <= yearsForward; i++) {
      const year = currentStartYear + i;
      const taxYear = `${year}-${String(year + 1).slice(-2)}`;
      const { start, end } = this.getTaxYearDates(taxYear);
      
      taxYears.push({
        value: taxYear,
        label: `${taxYear} Tax Year`,
        description: `${this.formatForDisplay(start)} - ${this.formatForDisplay(end)}`,
        isCurrent: false,
        isPast: false,
        isFuture: true
      });
    }

    return taxYears;
  }

  // =====================================================
  // MTD QUARTERLY PERIODS
  // =====================================================

  /**
   * Get quarter (Q1-Q4) for any date
   * @param {Date|string} date - Date to check
   * @returns {string} Quarter (Q1, Q2, Q3, Q4)
   */
  static getQuarterForDate(date) {
    const ukDate = this.toUKDate(date);
    const taxYear = this.getTaxYearForDate(date);
    const { start: taxYearStart } = this.getTaxYearDates(taxYear);
    
    const daysSinceStart = differenceInDays(ukDate, taxYearStart);
    
    if (daysSinceStart < 91) return 'Q1'; // Apr 6 - Jul 5 (91 days)
    if (daysSinceStart < 183) return 'Q2'; // Jul 6 - Oct 5 (92 days)
    if (daysSinceStart < 274) return 'Q3'; // Oct 6 - Jan 5 (91 days)
    return 'Q4'; // Jan 6 - Apr 5 (91/92 days)
  }

  /**
   * Get start and end dates for a specific quarter
   * @param {string} taxYear - Tax year in format "YYYY-YY"
   * @param {string} quarter - Quarter (Q1, Q2, Q3, Q4)
   * @returns {Object} {start: Date, end: Date, description: string}
   */
  static getQuarterDates(taxYear, quarter) {
    const { start: taxYearStart } = this.getTaxYearDates(taxYear);
    let start, end, description;

    switch (quarter) {
      case 'Q1':
        start = taxYearStart; // April 6
        end = new Date(taxYearStart.getFullYear(), 6, 5, 23, 59, 59); // July 5
        description = 'April 6 - July 5';
        break;
      case 'Q2':
        start = new Date(taxYearStart.getFullYear(), 6, 6); // July 6
        end = new Date(taxYearStart.getFullYear(), 9, 5, 23, 59, 59); // October 5
        description = 'July 6 - October 5';
        break;
      case 'Q3':
        start = new Date(taxYearStart.getFullYear(), 9, 6); // October 6
        end = new Date(taxYearStart.getFullYear() + 1, 0, 5, 23, 59, 59); // January 5
        description = 'October 6 - January 5';
        break;
      case 'Q4':
        start = new Date(taxYearStart.getFullYear() + 1, 0, 6); // January 6
        end = new Date(taxYearStart.getFullYear() + 1, 3, 5, 23, 59, 59); // April 5
        description = 'January 6 - April 5';
        break;
      default:
        throw new Error(`Invalid quarter: ${quarter}`);
    }

    return {
      start: this.toUKDate(start),
      end: this.toUKDate(end),
      description,
      quarter
    };
  }

  /**
   * Get all quarters for a tax year
   * @param {string} taxYear - Tax year in format "YYYY-YY"
   * @returns {Object[]} Array of quarter objects
   */
  static getAllQuartersForTaxYear(taxYear) {
    return ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter => 
      this.getQuarterDates(taxYear, quarter)
    );
  }

  /**
   * Get current quarter information
   * @returns {Object} Current quarter with dates and tax year
   */
  static getCurrentQuarter() {
    const now = this.nowInUK();
    const taxYear = this.getCurrentTaxYear();
    const quarter = this.getQuarterForDate(now);
    
    return {
      ...this.getQuarterDates(taxYear, quarter),
      taxYear,
      isCurrentQuarter: true
    };
  }

  /**
   * Get quarter status (completed, current, future)
   * @param {string} taxYear - Tax year in format "YYYY-YY"
   * @param {string} quarter - Quarter (Q1, Q2, Q3, Q4)
   * @returns {Object} Quarter status information
   */
  static getQuarterStatus(taxYear, quarter) {
    const now = this.nowInUK();
    const quarterInfo = this.getQuarterDates(taxYear, quarter);
    const deadline = this.getQuarterlyDeadline(taxYear, quarter);
    
    const isCompleted = now > quarterInfo.end;
    const isCurrent = now >= quarterInfo.start && now <= quarterInfo.end;
    const isFuture = now < quarterInfo.start;
    const isOverdue = now > deadline.deadline;
    
    return {
      ...quarterInfo,
      isCompleted,
      isCurrent,
      isFuture,
      isOverdue,
      deadline: deadline.deadline,
      status: isOverdue ? 'overdue' : 
              isCompleted ? 'completed' : 
              isCurrent ? 'current' : 'future'
    };
  }

  // =====================================================
  // HMRC SUBMISSION DEADLINES
  // =====================================================

  /**
   * Calculate quarterly submission deadline (1 month after quarter end)
   * @param {string} taxYear - Tax year in format "YYYY-YY"
   * @param {string} quarter - Quarter (Q1, Q2, Q3, Q4)
   * @returns {Object} Deadline information
   */
  static getQuarterlyDeadline(taxYear, quarter) {
    const quarterInfo = this.getQuarterDates(taxYear, quarter);
    const deadline = addMonths(quarterInfo.end, 1);
    
    return {
      quarter,
      taxYear,
      periodEnd: quarterInfo.end,
      deadline: this.toUKDate(deadline),
      description: `${quarter} ${taxYear} quarterly return`,
      type: 'quarterly'
    };
  }

  /**
   * Calculate annual self assessment deadline (January 31st)
   * @param {string} taxYear - Tax year in format "YYYY-YY"
   * @returns {Object} Annual deadline information
   */
  static getAnnualDeadline(taxYear) {
    const [startYearStr] = taxYear.split('-');
    const startYear = parseInt(startYearStr);
    
    // Annual deadline is January 31st following the tax year end
    const deadline = new Date(startYear + 2, 0, 31, 23, 59, 59); // January 31st
    
    return {
      taxYear,
      deadline: this.toUKDate(deadline),
      description: `${taxYear} annual self assessment`,
      type: 'annual'
    };
  }

  /**
   * Get all upcoming deadlines for a tax year
   * @param {string} taxYear - Tax year in format "YYYY-YY"
   * @param {boolean} includeAnnual - Include annual deadline
   * @returns {Object[]} Sorted array of future deadlines
   */
  static getUpcomingDeadlines(taxYear, includeAnnual = true) {
    const now = this.nowInUK();
    const deadlines = [];

    // Add quarterly deadlines
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(quarter => {
      const deadline = this.getQuarterlyDeadline(taxYear, quarter);
      if (deadline.deadline > now) {
        deadlines.push(deadline);
      }
    });

    // Add annual deadline
    if (includeAnnual) {
      const annualDeadline = this.getAnnualDeadline(taxYear);
      if (annualDeadline.deadline > now) {
        deadlines.push(annualDeadline);
      }
    }

    return deadlines.sort((a, b) => a.deadline - b.deadline);
  }

  /**
   * Get all deadlines across multiple tax years
   * @param {string[]} taxYears - Array of tax years
   * @param {boolean} includeAnnual - Include annual deadlines
   * @returns {Object[]} Sorted array of all deadlines
   */
  static getAllDeadlines(taxYears = null, includeAnnual = true) {
    if (!taxYears) {
      // Default to current and next 2 tax years
      const currentTaxYear = this.getCurrentTaxYear();
      const currentYear = parseInt(currentTaxYear.split('-')[0]);
      taxYears = [
        currentTaxYear,
        `${currentYear + 1}-${String(currentYear + 2).slice(-2)}`,
        `${currentYear + 2}-${String(currentYear + 3).slice(-2)}`
      ];
    }

    const allDeadlines = [];
    
    taxYears.forEach(taxYear => {
      const deadlines = this.getUpcomingDeadlines(taxYear, includeAnnual);
      allDeadlines.push(...deadlines);
    });

    return allDeadlines.sort((a, b) => a.deadline - b.deadline);
  }

  /**
   * Check if deadline is approaching
   * @param {Date} deadline - Deadline date
   * @param {number} daysBeforeWarning - Days before deadline to warn
   * @returns {Object} Warning status
   */
  static isDeadlineApproaching(deadline, daysBeforeWarning = 7) {
    const now = this.nowInUK();
    const daysUntilDeadline = differenceInDays(deadline, now);
    
    return {
      isApproaching: daysUntilDeadline <= daysBeforeWarning && daysUntilDeadline >= 0,
      isOverdue: daysUntilDeadline < 0,
      daysUntilDeadline,
      urgency: daysUntilDeadline <= 1 ? 'critical' : 
               daysUntilDeadline <= 3 ? 'high' : 
               daysUntilDeadline <= 7 ? 'medium' : 'low'
    };
  }

  // =====================================================
  // VAT PERIOD SUPPORT
  // =====================================================

  /**
   * Get VAT quarter dates (calendar quarters)
   * @param {number} year - Calendar year
   * @param {number} quarter - VAT quarter (1, 2, 3, 4)
   * @returns {Object} VAT quarter dates
   */
  static getVATQuarterDates(year, quarter) {
    let start, end, description;

    switch (quarter) {
      case 1:
        start = new Date(year, 0, 1); // January 1
        end = new Date(year, 2, 31, 23, 59, 59); // March 31
        description = 'January - March';
        break;
      case 2:
        start = new Date(year, 3, 1); // April 1
        end = new Date(year, 5, 30, 23, 59, 59); // June 30
        description = 'April - June';
        break;
      case 3:
        start = new Date(year, 6, 1); // July 1
        end = new Date(year, 8, 30, 23, 59, 59); // September 30
        description = 'July - September';
        break;
      case 4:
        start = new Date(year, 9, 1); // October 1
        end = new Date(year, 11, 31, 23, 59, 59); // December 31
        description = 'October - December';
        break;
      default:
        throw new Error(`Invalid VAT quarter: ${quarter}`);
    }

    return {
      start: this.toUKDate(start),
      end: this.toUKDate(end),
      description,
      quarter,
      year
    };
  }

  /**
   * Calculate VAT submission deadline (1 month 7 days after period end)
   * @param {number} year - Calendar year
   * @param {number} quarter - VAT quarter (1, 2, 3, 4)
   * @returns {Object} VAT deadline information
   */
  static getVATDeadline(year, quarter) {
    const quarterInfo = this.getVATQuarterDates(year, quarter);
    const deadline = addDays(addMonths(quarterInfo.end, 1), 7);
    
    return {
      quarter,
      year,
      periodEnd: quarterInfo.end,
      deadline: this.toUKDate(deadline),
      description: `VAT Q${quarter} ${year}`,
      type: 'vat'
    };
  }

  /**
   * Get all VAT deadlines for a calendar year
   * @param {number} year - Calendar year
   * @returns {Object[]} Array of VAT deadlines
   */
  static getVATDeadlinesForYear(year) {
    return [1, 2, 3, 4].map(quarter => this.getVATDeadline(year, quarter));
  }

  /**
   * Get upcoming VAT deadlines across multiple years
   * @param {number} yearsAhead - Number of years ahead to include (default: 2)
   * @returns {Object[]} Sorted array of upcoming VAT deadlines
   */
  static getUpcomingVATDeadlines(yearsAhead = 2) {
    const now = this.nowInUK();
    const currentYear = now.getFullYear();
    const deadlines = [];

    for (let year = currentYear; year <= currentYear + yearsAhead; year++) {
      const yearDeadlines = this.getVATDeadlinesForYear(year);
      deadlines.push(...yearDeadlines.filter(d => d.deadline > now));
    }

    return deadlines.sort((a, b) => a.deadline - b.deadline);
  }

  // =====================================================
  // DATE FORMATTING & PARSING
  // =====================================================

  /**
   * Format date for HMRC API calls (YYYY-MM-DD)
   * @param {Date|string} date - Date to format
   * @returns {string} Date in YYYY-MM-DD format
   */
  static formatForHMRC(date) {
    const ukDate = this.toUKDate(date);
    return format(ukDate, 'yyyy-MM-dd', { timeZone: this.UK_TIMEZONE });
  }

  /**
   * Format date for UK users (DD/MM/YYYY)
   * @param {Date|string} date - Date to format
   * @returns {string} Date in DD/MM/YYYY format
   */
  static formatForDisplay(date) {
    const ukDate = this.toUKDate(date);
    return format(ukDate, 'dd/MM/yyyy', { timeZone: this.UK_TIMEZONE });
  }

  /**
   * Parse UK date string (DD/MM/YYYY or DD-MM-YYYY)
   * @param {string} dateString - Date string to parse
   * @returns {Date|null} Parsed date or null if invalid
   */
  static parseUKDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;

    // Handle different separators
    const normalized = dateString.replace(/[-\.]/g, '/');
    const parts = normalized.split('/');
    
    if (parts.length !== 3) return null;

    const [day, month, year] = parts.map(Number);
    
    // Basic validation
    if (!day || !month || !year || 
        day < 1 || day > 31 || 
        month < 1 || month > 12 || 
        year < 1900 || year > 2100) {
      return null;
    }

    const date = new Date(year, month - 1, day);
    
    // Check if date is valid (handles invalid dates like 31/02/2024)
    if (date.getFullYear() !== year || 
        date.getMonth() !== month - 1 || 
        date.getDate() !== day) {
      return null;
    }

    return this.toUKDate(date);
  }

  /**
   * Validate date is not in the future
   * @param {Date|string} date - Date to validate
   * @returns {boolean} True if date is not in future
   */
  static validateNotFuture(date) {
    const checkDate = this.toUKDate(date);
    const now = this.nowInUK();
    return !isAfter(checkDate, now);
  }

  /**
   * Validate reasonable business date range
   * @param {Date|string} date - Date to validate
   * @returns {Object} Validation result
   */
  static validateBusinessDate(date) {
    const checkDate = this.toUKDate(date);
    const now = this.nowInUK();
    const minDate = new Date(1900, 0, 1);
    const maxDate = addDays(now, 365); // Allow 1 year in future for planning

    return {
      isValid: checkDate >= minDate && checkDate <= maxDate,
      isFuture: isAfter(checkDate, now),
      isTooOld: isBefore(checkDate, minDate),
      isTooFar: isAfter(checkDate, maxDate),
      date: checkDate
    };
  }

  // =====================================================
  // BUSINESS DAY CALCULATIONS
  // =====================================================

  /**
   * Check if date is a business day (weekday, not bank holiday)
   * @param {Date|string} date - Date to check
   * @param {boolean} excludeBankHolidays - Whether to exclude UK bank holidays
   * @returns {boolean} True if business day
   */
  static isBusinessDay(date, excludeBankHolidays = true) {
    const checkDate = this.toUKDate(date);
    
    // Check if weekend
    if (isWeekend(checkDate)) return false;

    // Check if bank holiday
    if (excludeBankHolidays && this.isBankHoliday(checkDate)) return false;

    return true;
  }

  /**
   * Add business days to a date
   * @param {Date|string} date - Starting date
   * @param {number} days - Number of business days to add
   * @returns {Date} New date after adding business days
   */
  static addBusinessDays(date, days) {
    let current = this.toUKDate(date);
    let remaining = days;

    while (remaining > 0) {
      current = addDays(current, 1);
      if (this.isBusinessDay(current)) {
        remaining--;
      }
    }

    return current;
  }

  /**
   * Check if date is a UK bank holiday
   * @param {Date} date - Date to check
   * @returns {boolean} True if bank holiday
   */
  static isBankHoliday(date) {
    const dateStr = this.formatForHMRC(date);
    const year = date.getFullYear();
    
    const holidays = this.ALL_UK_BANK_HOLIDAYS[year] || [];
    return holidays.includes(dateStr);
  }

  /**
   * Get all bank holidays for a specific year
   * @param {number} year - Year to get bank holidays for
   * @returns {string[]} Array of bank holiday dates in YYYY-MM-DD format
   */
  static getBankHolidaysForYear(year) {
    return this.ALL_UK_BANK_HOLIDAYS[year] || [];
  }

  /**
   * Get all bank holidays between two dates
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {Object[]} Array of bank holiday objects
   */
  static getBankHolidaysBetween(startDate, endDate) {
    const start = this.toUKDate(startDate);
    const end = this.toUKDate(endDate);
    const holidays = [];

    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    for (let year = startYear; year <= endYear; year++) {
      const yearHolidays = this.getBankHolidaysForYear(year);
      yearHolidays.forEach(holidayStr => {
        const holiday = parseISO(holidayStr);
        if (holiday >= start && holiday <= end) {
          holidays.push({
            date: this.toUKDate(holiday),
            dateString: holidayStr,
            formatted: this.formatForDisplay(holiday),
            year
          });
        }
      });
    }

    return holidays.sort((a, b) => a.date - b.date);
  }

  // =====================================================
  // UK TIMEZONE HANDLING
  // =====================================================

  /**
   * Get current date/time in UK timezone
   * @returns {Date} Current UK date/time
   */
  static nowInUK() {
    return utcToZonedTime(new Date(), this.UK_TIMEZONE);
  }

  /**
   * Convert any date to UK timezone
   * @param {Date|string} date - Date to convert
   * @returns {Date} Date in UK timezone
   */
  static toUKDate(date) {
    if (!date) return null;
    
    const inputDate = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(inputDate)) return null;
    
    return utcToZonedTime(inputDate, this.UK_TIMEZONE);
  }

  /**
   * Convert UK date to UTC
   * @param {Date} ukDate - Date in UK timezone
   * @returns {Date} Date in UTC
   */
  static toUTC(ukDate) {
    return zonedTimeToUtc(ukDate, this.UK_TIMEZONE);
  }

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================

  /**
   * Calculate age from date of birth
   * @param {Date|string} dateOfBirth - Date of birth
   * @returns {number} Age in years
   */
  static calculateAge(dateOfBirth) {
    const birthDate = this.toUKDate(dateOfBirth);
    const today = this.nowInUK();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Get duration between two dates in business context
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {Object} Duration information
   */
  static getDuration(startDate, endDate) {
    const start = this.toUKDate(startDate);
    const end = this.toUKDate(endDate);
    
    const totalDays = differenceInDays(end, start);
    const businessDays = this.countBusinessDays(start, end);
    
    return {
      totalDays,
      businessDays,
      weeks: Math.floor(totalDays / 7),
      months: Math.floor(totalDays / 30.44), // Average month length
      start,
      end
    };
  }

  /**
   * Count business days between two dates
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {number} Number of business days
   */
  static countBusinessDays(startDate, endDate) {
    let count = 0;
    let current = new Date(startDate);
    
    while (current <= endDate) {
      if (this.isBusinessDay(current)) {
        count++;
      }
      current = addDays(current, 1);
    }
    
    return count;
  }

  /**
   * Compare two dates (for sorting)
   * @param {Date|string} date1 - First date
   * @param {Date|string} date2 - Second date
   * @returns {number} -1, 0, or 1 for sorting
   */
  static compareDates(date1, date2) {
    const d1 = this.toUKDate(date1);
    const d2 = this.toUKDate(date2);
    
    if (d1 < d2) return -1;
    if (d1 > d2) return 1;
    return 0;
  }

  /**
   * Get fiscal year from calendar year (for non-UK systems)
   * @param {number} calendarYear - Calendar year
   * @returns {string} UK tax year format
   */
  static fiscalYearFromCalendar(calendarYear) {
    // Assuming fiscal year starts in April of calendar year
    return `${calendarYear}-${String(calendarYear + 1).slice(-2)}`;
  }

  /**
   * Validate spreadsheet date cell value
   * @param {any} cellValue - Value from spreadsheet cell
   * @returns {Object} Validation result with parsed date
   */
  static validateSpreadsheetDate(cellValue) {
    if (!cellValue) {
      return { isValid: false, error: 'Date is required' };
    }

    let date = null;

    // Handle Excel date numbers
    if (typeof cellValue === 'number') {
      // Excel date serial number (days since 1900-01-01)
      const excelEpoch = new Date(1900, 0, 1);
      date = addDays(excelEpoch, cellValue - 2); // Excel has a leap year bug
    } 
    // Handle date objects
    else if (cellValue instanceof Date) {
      date = cellValue;
    }
    // Handle strings
    else if (typeof cellValue === 'string') {
      // Try parsing as UK date first
      date = this.parseUKDate(cellValue);
      
      // If that fails, try ISO format
      if (!date) {
        date = parseISO(cellValue);
      }
    }

    if (!date || !isValid(date)) {
      return { 
        isValid: false, 
        error: 'Invalid date format. Use DD/MM/YYYY or DD-MM-YYYY' 
      };
    }

    const validation = this.validateBusinessDate(date);
    if (!validation.isValid) {
      return {
        isValid: false,
        error: validation.isTooOld ? 'Date is too far in the past' :
               validation.isTooFar ? 'Date is too far in the future' :
               'Invalid date'
      };
    }

    return {
      isValid: true,
      date: this.toUKDate(date),
      formatted: this.formatForDisplay(date),
      hmrcFormat: this.formatForHMRC(date)
    };
  }

  /**
   * Get next business day from a given date
   * @param {Date|string} date - Starting date
   * @returns {Date} Next business day
   */
  static getNextBusinessDay(date) {
    return this.addBusinessDays(date, 1);
  }

  /**
   * Get previous business day from a given date
   * @param {Date|string} date - Starting date
   * @returns {Date} Previous business day
   */
  static getPreviousBusinessDay(date) {
    let current = this.toUKDate(date);
    
    do {
      current = addDays(current, -1);
    } while (!this.isBusinessDay(current));
    
    return current;
  }

  /**
   * Check if current year is a leap year
   * @param {number} year - Year to check (default: current year)
   * @returns {boolean} True if leap year
   */
  static isLeapYear(year = null) {
    const checkYear = year || this.nowInUK().getFullYear();
    return (checkYear % 4 === 0 && checkYear % 100 !== 0) || (checkYear % 400 === 0);
  }

  /**
   * Get summary of current date context for MTD
   * @returns {Object} Current date context summary
   */
  static getCurrentMTDContext() {
    const now = this.nowInUK();
    const currentTaxYear = this.getCurrentTaxYear();
    const currentQuarter = this.getCurrentQuarter();
    const upcomingDeadlines = this.getAllDeadlines([currentTaxYear]);
    
    return {
      currentDate: now,
      currentDateFormatted: this.formatForDisplay(now),
      currentTaxYear,
      currentQuarter: currentQuarter.quarter,
      quarterInfo: currentQuarter,
      upcomingDeadlines: upcomingDeadlines.slice(0, 3), // Next 3 deadlines
      isLeapYear: this.isLeapYear(),
      dayOfYear: differenceInDays(now, new Date(now.getFullYear(), 0, 1)) + 1
    };
  }
}

module.exports = DateUtil;