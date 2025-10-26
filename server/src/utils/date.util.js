const moment = require('moment-timezone');

/**
 * UK Tax-Specific Date Utility for MTD (Making Tax Digital)
 * Handles UK tax years, quarterly periods, submission deadlines, and date formatting
 * 
 * UK Tax Year: April 6th to April 5th (e.g., 2024-25 = 6 Apr 2024 to 5 Apr 2025)
 * MTD Quarters: Q1 (6 Apr-5 Jul), Q2 (6 Jul-5 Oct), Q3 (6 Oct-5 Jan), Q4 (6 Jan-5 Apr)
 */
class UKTaxDateUtil {
  constructor() {
    this.timezone = 'Europe/London';
    this.taxYearStartMonth = 3; // April (0-indexed)
    this.taxYearStartDay = 6;
    
    // Quarter definitions (month/day pairs, 0-indexed months)
    this.quarters = {
      Q1: { start: { month: 3, day: 6 }, end: { month: 6, day: 5 } },   // Apr 6 - Jul 5
      Q2: { start: { month: 6, day: 6 }, end: { month: 9, day: 5 } },   // Jul 6 - Oct 5
      Q3: { start: { month: 9, day: 6 }, end: { month: 0, day: 5 } },   // Oct 6 - Jan 5 (next year)
      Q4: { start: { month: 0, day: 6 }, end: { month: 3, day: 5 } }    // Jan 6 - Apr 5
    };
  }

  // ====== UK TAX YEAR CALCULATIONS ======

  /**
   * Get current UK tax year string
   * @returns {string} Current tax year (e.g., "2024-25")
   */
  getCurrentTaxYear() {
    const currentDate = this.getCurrentUKDate();
    return this.getTaxYearForDate(currentDate);
  }

  /**
   * Get tax year for any given date
   * @param {Date|string} date - Date to check
   * @returns {string} Tax year string (e.g., "2024-25")
   */
  getTaxYearForDate(date) {
    const ukDate = this._ensureUKMoment(date);
    
    // Tax year starts April 6th
    const taxYearStart = moment.tz([ukDate.year(), this.taxYearStartMonth, this.taxYearStartDay], this.timezone);
    
    let startYear;
    if (ukDate.isBefore(taxYearStart)) {
      // Date is before April 6th, so it's in the previous tax year
      startYear = ukDate.year() - 1;
    } else {
      // Date is April 6th or later, so it's in the current tax year
      startYear = ukDate.year();
    }
    
    const endYear = startYear + 1;
    return `${startYear}-${endYear.toString().slice(-2)}`;
  }

  /**
   * Get start and end dates for a tax year
   * @param {string} taxYear - Tax year string (e.g., "2024-25")
   * @returns {Object} {start: Date, end: Date}
   */
  getTaxYearDates(taxYear) {
    const { startYear, endYear } = this._parseTaxYear(taxYear);
    
    const start = moment.tz([startYear, this.taxYearStartMonth, this.taxYearStartDay], this.timezone);
    const end = moment.tz([endYear, this.taxYearStartMonth, this.taxYearStartDay - 1], this.timezone); // April 5th
    
    return {
      start: start.toDate(),
      end: end.toDate()
    };
  }

  // ====== MTD QUARTERLY PERIODS ======

  /**
   * Get quarter for any given date
   * @param {Date|string} date - Date to check
   * @returns {string} Quarter ("Q1", "Q2", "Q3", "Q4")
   */
  getQuarterForDate(date) {
    const ukDate = this._ensureUKMoment(date);
    const taxYear = this.getTaxYearForDate(date);
    
    for (const [quarter, periods] of Object.entries(this.quarters)) {
      const { start, end } = this.getQuarterDates(taxYear, quarter);
      const startMoment = moment.tz(start, this.timezone);
      const endMoment = moment.tz(end, this.timezone);
      
      if (ukDate.isBetween(startMoment, endMoment, null, '[]')) {
        return quarter;
      }
    }
    
    throw new Error(`Unable to determine quarter for date: ${ukDate.format('YYYY-MM-DD')}`);
  }

  /**
   * Get start and end dates for a specific quarter
   * @param {string} taxYear - Tax year string (e.g., "2024-25")
   * @param {string} quarter - Quarter ("Q1", "Q2", "Q3", "Q4")
   * @returns {Object} {start: Date, end: Date}
   */
  getQuarterDates(taxYear, quarter) {
    if (!this.quarters[quarter]) {
      throw new Error(`Invalid quarter: ${quarter}. Must be Q1, Q2, Q3, or Q4`);
    }
    
    const { startYear, endYear } = this._parseTaxYear(taxYear);
    const quarterDef = this.quarters[quarter];
    
    let startDate, endDate;
    
    if (quarter === 'Q3') {
      // Q3 spans across calendar years (Oct to Jan)
      startDate = moment.tz([startYear, quarterDef.start.month, quarterDef.start.day], this.timezone);
      endDate = moment.tz([endYear, quarterDef.end.month, quarterDef.end.day], this.timezone);
    } else if (quarter === 'Q4') {
      // Q4 is in the second calendar year (Jan to Apr)
      startDate = moment.tz([endYear, quarterDef.start.month, quarterDef.start.day], this.timezone);
      endDate = moment.tz([endYear, quarterDef.end.month, quarterDef.end.day], this.timezone);
    } else {
      // Q1 and Q2 are in the first calendar year
      startDate = moment.tz([startYear, quarterDef.start.month, quarterDef.start.day], this.timezone);
      endDate = moment.tz([startYear, quarterDef.end.month, quarterDef.end.day], this.timezone);
    }
    
    return {
      start: startDate.toDate(),
      end: endDate.toDate()
    };
  }

  /**
   * Get current quarter information with dates
   * @returns {Object} {quarter: string, taxYear: string, start: Date, end: Date}
   */
  getCurrentQuarter() {
    const currentDate = this.getCurrentUKDate();
    const taxYear = this.getTaxYearForDate(currentDate);
    const quarter = this.getQuarterForDate(currentDate);
    const { start, end } = this.getQuarterDates(taxYear, quarter);
    
    return {
      quarter,
      taxYear,
      start,
      end,
      currentDate
    };
  }

  // ====== SUBMISSION DEADLINES ======

  /**
   * Get quarterly submission deadline (1 month after quarter end)
   * @param {string} taxYear - Tax year string
   * @param {string} quarter - Quarter string
   * @returns {Date} Deadline date
   */
  getQuarterlyDeadline(taxYear, quarter) {
    const { end } = this.getQuarterDates(taxYear, quarter);
    const endMoment = moment.tz(end, this.timezone);
    
    // Quarterly deadline is 1 month after quarter end
    const deadline = endMoment.clone().add(1, 'month');
    
    // Adjust if deadline falls on weekend or bank holiday
    return this._adjustForBusinessDay(deadline).toDate();
  }

  /**
   * Get annual submission deadline (31 January following tax year)
   * @param {string} taxYear - Tax year string
   * @returns {Date} Annual deadline date
   */
  getAnnualDeadline(taxYear) {
    const { endYear } = this._parseTaxYear(taxYear);
    
    // Annual deadline is 31 January following the tax year end
    const deadline = moment.tz([endYear + 1, 0, 31], this.timezone); // January 31st
    
    return this._adjustForBusinessDay(deadline).toDate();
  }

  /**
   * Get next upcoming deadline with type and date
   * @returns {Object} {type: string, date: Date, quarter?: string, taxYear: string, daysUntil: number}
   */
  getNextDeadline() {
    const currentDate = this.getCurrentUKDate();
    const currentTaxYear = this.getCurrentTaxYear();
    const currentMoment = moment.tz(currentDate, this.timezone);
    
    const deadlines = [];
    
    // Add quarterly deadlines for current and next tax year
    const taxYears = [currentTaxYear, this._getNextTaxYear(currentTaxYear)];
    
    for (const taxYear of taxYears) {
      for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
        const deadline = this.getQuarterlyDeadline(taxYear, quarter);
        const deadlineMoment = moment.tz(deadline, this.timezone);
        
        if (deadlineMoment.isAfter(currentMoment)) {
          deadlines.push({
            type: 'quarterly',
            date: deadline,
            quarter,
            taxYear,
            daysUntil: deadlineMoment.diff(currentMoment, 'days')
          });
        }
      }
      
      // Add annual deadline
      const annualDeadline = this.getAnnualDeadline(taxYear);
      const annualMoment = moment.tz(annualDeadline, this.timezone);
      
      if (annualMoment.isAfter(currentMoment)) {
        deadlines.push({
          type: 'annual',
          date: annualDeadline,
          taxYear,
          daysUntil: annualMoment.diff(currentMoment, 'days')
        });
      }
    }
    
    // Sort by date and return the next one
    deadlines.sort((a, b) => a.daysUntil - b.daysUntil);
    
    return deadlines[0] || null;
  }

  /**
   * Check if deadline is approaching within specified days
   * @param {Date} deadline - Deadline date
   * @param {number} daysWarning - Days before deadline to warn (default: 30)
   * @returns {boolean} True if deadline is approaching
   */
  isDeadlineApproaching(deadline, daysWarning = 30) {
    const currentDate = this.getCurrentUKDate();
    const currentMoment = moment.tz(currentDate, this.timezone);
    const deadlineMoment = moment.tz(deadline, this.timezone);
    
    const daysUntilDeadline = deadlineMoment.diff(currentMoment, 'days');
    
    return daysUntilDeadline >= 0 && daysUntilDeadline <= daysWarning;
  }

  // ====== DATE FORMATTING ======

  /**
   * Format date for display in UK format
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date (DD/MM/YYYY)
   */
  formatForDisplay(date) {
    const ukDate = this._ensureUKMoment(date);
    return ukDate.format('DD/MM/YYYY');
  }

  /**
   * Format date for HMRC API
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date (YYYY-MM-DD)
   */
  formatForHMRC(date) {
    const ukDate = this._ensureUKMoment(date);
    return ukDate.format('YYYY-MM-DD');
  }

  /**
   * Parse UK date string (DD/MM/YYYY)
   * @param {string} dateString - Date string to parse
   * @returns {Date} Parsed date
   */
  parseUKDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
      throw new Error('Date string is required');
    }
    
    // Try DD/MM/YYYY format first
    let parsed = moment.tz(dateString, 'DD/MM/YYYY', this.timezone, true);
    
    // Try D/M/YYYY format (single digits)
    if (!parsed.isValid()) {
      parsed = moment.tz(dateString, 'D/M/YYYY', this.timezone, true);
    }
    
    // Try DD/MM/YY format
    if (!parsed.isValid()) {
      parsed = moment.tz(dateString, 'DD/MM/YY', this.timezone, true);
    }
    
    if (!parsed.isValid()) {
      throw new Error(`Invalid UK date format: ${dateString}. Expected DD/MM/YYYY`);
    }
    
    return parsed.toDate();
  }

  /**
   * Validate if date is reasonable for business purposes
   * @param {Date|string} date - Date to validate
   * @returns {boolean} True if valid business date
   */
  validateBusinessDate(date) {
    try {
      const ukDate = this._ensureUKMoment(date);
      const currentDate = this.getCurrentUKDate();
      const currentMoment = moment.tz(currentDate, this.timezone);
      
      // Check if date is not too far in the past (100 years)
      const minDate = currentMoment.clone().subtract(100, 'years');
      if (ukDate.isBefore(minDate)) {
        return false;
      }
      
      // Check if date is not too far in the future (10 years)
      const maxDate = currentMoment.clone().add(10, 'years');
      if (ukDate.isAfter(maxDate)) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // ====== UTILITY FUNCTIONS ======

  /**
   * Check if date falls within specified tax year
   * @param {Date|string} date - Date to check
   * @param {string} taxYear - Tax year string
   * @returns {boolean} True if date is in tax year
   */
  isDateInTaxYear(date, taxYear) {
    const ukDate = this._ensureUKMoment(date);
    const { start, end } = this.getTaxYearDates(taxYear);
    const startMoment = moment.tz(start, this.timezone);
    const endMoment = moment.tz(end, this.timezone);
    
    return ukDate.isBetween(startMoment, endMoment, null, '[]');
  }

  /**
   * Add business days to date (skip weekends)
   * @param {Date|string} date - Starting date
   * @param {number} days - Number of business days to add
   * @returns {Date} Date with business days added
   */
  addBusinessDays(date, days) {
    const startDate = this._ensureUKMoment(date);
    let currentDate = startDate.clone();
    let addedDays = 0;
    
    while (addedDays < days) {
      currentDate.add(1, 'day');
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (currentDate.day() !== 0 && currentDate.day() !== 6) {
        addedDays++;
      }
    }
    
    return currentDate.toDate();
  }

  /**
   * Get current date in UK timezone
   * @returns {Date} Current UK date
   */
  getCurrentUKDate() {
    return moment.tz(this.timezone).toDate();
  }

  /**
   * Get all quarters for a tax year with their dates
   * @param {string} taxYear - Tax year string
   * @returns {Array} Array of quarter objects
   */
  getAllQuartersForTaxYear(taxYear) {
    return ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter => {
      const { start, end } = this.getQuarterDates(taxYear, quarter);
      const deadline = this.getQuarterlyDeadline(taxYear, quarter);
      
      return {
        quarter,
        taxYear,
        start,
        end,
        deadline,
        isComplete: moment.tz(end, this.timezone).isBefore(moment.tz(this.timezone))
      };
    });
  }

  /**
   * Get tax year boundaries for a range of years
   * @param {number} yearsBack - Years to go back from current
   * @param {number} yearsForward - Years to go forward from current
   * @returns {Array} Array of tax year objects
   */
  getTaxYearRange(yearsBack = 5, yearsForward = 2) {
    const currentTaxYear = this.getCurrentTaxYear();
    const { startYear } = this._parseTaxYear(currentTaxYear);
    
    const taxYears = [];
    
    for (let i = -yearsBack; i <= yearsForward; i++) {
      const year = startYear + i;
      const taxYear = `${year}-${(year + 1).toString().slice(-2)}`;
      const { start, end } = this.getTaxYearDates(taxYear);
      const annualDeadline = this.getAnnualDeadline(taxYear);
      
      taxYears.push({
        taxYear,
        start,
        end,
        annualDeadline,
        isCurrent: taxYear === currentTaxYear,
        isComplete: moment.tz(end, this.timezone).isBefore(moment.tz(this.timezone))
      });
    }
    
    return taxYears;
  }

  // ====== PRIVATE HELPER METHODS ======

  /**
   * Ensure input is a moment object in UK timezone
   * @private
   */
  _ensureUKMoment(date) {
    if (moment.isMoment(date)) {
      return date.tz(this.timezone);
    }
    
    if (date instanceof Date) {
      return moment.tz(date, this.timezone);
    }
    
    if (typeof date === 'string') {
      return moment.tz(date, this.timezone);
    }
    
    throw new Error('Invalid date input');
  }

  /**
   * Parse tax year string into start and end years
   * @private
   */
  _parseTaxYear(taxYear) {
    if (!taxYear || typeof taxYear !== 'string') {
      throw new Error('Tax year string is required');
    }
    
    const match = taxYear.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      throw new Error(`Invalid tax year format: ${taxYear}. Expected format: YYYY-YY`);
    }
    
    const startYear = parseInt(match[1], 10);
    const endYearShort = parseInt(match[2], 10);
    const endYear = startYear + 1;
    
    // Validate that the short year matches
    if (endYear % 100 !== endYearShort) {
      throw new Error(`Invalid tax year: ${taxYear}. End year doesn't match start year + 1`);
    }
    
    return { startYear, endYear };
  }

  /**
   * Get next tax year string
   * @private
   */
  _getNextTaxYear(currentTaxYear) {
    const { startYear } = this._parseTaxYear(currentTaxYear);
    const nextStartYear = startYear + 1;
    return `${nextStartYear}-${(nextStartYear + 1).toString().slice(-2)}`;
  }

  /**
   * Adjust date to next business day if it falls on weekend
   * @private
   */
  _adjustForBusinessDay(dateMoment) {
    const adjusted = dateMoment.clone();
    
    // If it's Saturday (6), move to Monday
    if (adjusted.day() === 6) {
      adjusted.add(2, 'days');
    }
    // If it's Sunday (0), move to Monday
    else if (adjusted.day() === 0) {
      adjusted.add(1, 'day');
    }
    
    return adjusted;
  }

  /**
   * Check if date is a UK bank holiday (basic implementation)
   * @private
   */
  _isUKBankHoliday(dateMoment) {
    // This is a simplified implementation
    // In production, you'd want to use a proper bank holiday API or library
    const month = dateMoment.month();
    const date = dateMoment.date();
    
    // Fixed bank holidays
    const fixedHolidays = [
      { month: 0, date: 1 },   // New Year's Day
      { month: 11, date: 25 }, // Christmas Day
      { month: 11, date: 26 }  // Boxing Day
    ];
    
    return fixedHolidays.some(holiday => 
      holiday.month === month && holiday.date === date
    );
  }
}

// Create singleton instance
const ukTaxDateUtil = new UKTaxDateUtil();

// Export both the class and instance
module.exports = {
  UKTaxDateUtil,
  default: ukTaxDateUtil,
  
  // Export commonly used functions directly
  getCurrentTaxYear: () => ukTaxDateUtil.getCurrentTaxYear(),
  getTaxYearForDate: (date) => ukTaxDateUtil.getTaxYearForDate(date),
  getTaxYearDates: (taxYear) => ukTaxDateUtil.getTaxYearDates(taxYear),
  getQuarterForDate: (date) => ukTaxDateUtil.getQuarterForDate(date),
  getQuarterDates: (taxYear, quarter) => ukTaxDateUtil.getQuarterDates(taxYear, quarter),
  getCurrentQuarter: () => ukTaxDateUtil.getCurrentQuarter(),
  getQuarterlyDeadline: (taxYear, quarter) => ukTaxDateUtil.getQuarterlyDeadline(taxYear, quarter),
  getAnnualDeadline: (taxYear) => ukTaxDateUtil.getAnnualDeadline(taxYear),
  getNextDeadline: () => ukTaxDateUtil.getNextDeadline(),
  isDeadlineApproaching: (deadline, days) => ukTaxDateUtil.isDeadlineApproaching(deadline, days),
  formatForDisplay: (date) => ukTaxDateUtil.formatForDisplay(date),
  formatForHMRC: (date) => ukTaxDateUtil.formatForHMRC(date),
  parseUKDate: (dateString) => ukTaxDateUtil.parseUKDate(dateString),
  validateBusinessDate: (date) => ukTaxDateUtil.validateBusinessDate(date),
  isDateInTaxYear: (date, taxYear) => ukTaxDateUtil.isDateInTaxYear(date, taxYear),
  addBusinessDays: (date, days) => ukTaxDateUtil.addBusinessDays(date, days),
  getCurrentUKDate: () => ukTaxDateUtil.getCurrentUKDate()
};