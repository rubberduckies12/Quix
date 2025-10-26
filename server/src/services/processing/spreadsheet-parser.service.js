const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const stream = require('stream');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const moment = require('moment');

/**
 * Comprehensive Spreadsheet Parser Service for MTD Tax Bridge Application
 * Handles Excel, CSV, TSV files with AI categorization integration
 */
class SpreadsheetParserService {
  constructor(logger, cacheService, progressTracker) {
    this.logger = logger;
    this.cache = cacheService;
    this.progress = progressTracker;
    
    // Configuration
    this.config = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      batchSize: 1000,
      timeout: 300000, // 5 minutes
      encoding: {
        default: 'utf8',
        fallback: ['utf8', 'utf16le', 'windows1252', 'iso-8859-1']
      },
      delimiters: [',', ';', '\t', '|'],
      dateFormats: [
        'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD',
        'DD-MM-YYYY', 'MM-DD-YYYY', 'DD.MM.YYYY'
      ]
    };

    // UK-specific patterns
    this.ukPatterns = {
      currency: /£?\s*-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/,
      postcode: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
      vatNumber: /^GB\d{9}$|^\d{9}$/,
      dateFormat: 'DD/MM/YYYY'
    };

    // Common business expense categories
    this.expenseCategories = {
      office: ['office', 'supplies', 'stationery', 'equipment'],
      travel: ['travel', 'fuel', 'mileage', 'parking', 'train', 'flight'],
      utilities: ['electric', 'gas', 'water', 'phone', 'internet'],
      professional: ['legal', 'accountant', 'consultant', 'advisor'],
      marketing: ['advertising', 'marketing', 'website', 'promotion']
    };
  }

  // ====== FILE FORMAT SUPPORT ======

  /**
   * Parse file based on extension and content
   */
  async parseFile(filePath, options = {}) {
    try {
      await this.validateFileIntegrity(filePath);
      const fileInfo = await this.extractMetadata(filePath);
      const fileHash = this._generateFileHash(filePath);
      
      // Check cache first
      if (!options.skipCache) {
        const cached = await this.cacheParsingResults(fileHash);
        if (cached) return cached;
      }

      let result;
      const ext = this._getFileExtension(filePath);
      
      switch (ext) {
        case '.xlsx':
        case '.xls':
          result = await this.parseExcelFile(filePath, options);
          break;
        case '.csv':
          result = await this.parseCSVFile(filePath, options);
          break;
        case '.tsv':
          result = await this.parseTSVFile(filePath, options);
          break;
        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }

      result.metadata = fileInfo;
      result.fileHash = fileHash;
      
      // Cache results
      await this.cache.set(`parse:${fileHash}`, result, 3600);
      
      return result;
    } catch (error) {
      return this.handleParsingErrors(error, null, { filePath });
    }
  }

  /**
   * Parse Excel files with password support
   */
  async parseExcelFile(filePath, options = {}) {
    const workbook = new ExcelJS.Workbook();
    
    try {
      if (options.password) {
        await workbook.xlsx.readFile(filePath, { password: options.password });
      } else {
        await workbook.xlsx.readFile(filePath);
      }

      const sheets = this.extractSheetNames(workbook);
      let results = [];

      if (options.sheetName) {
        const sheet = workbook.getWorksheet(options.sheetName);
        results.push(await this.parseSheet(sheet, options));
      } else if (options.parseAllSheets) {
        results = await this.parseMultipleSheets(workbook, options);
      } else {
        // Parse first sheet by default
        const firstSheet = workbook.worksheets[0];
        results.push(await this.parseSheet(firstSheet, options));
      }

      return {
        success: true,
        sheets: results,
        sheetNames: sheets,
        totalRows: results.reduce((sum, sheet) => sum + sheet.totalRows, 0)
      };
    } catch (error) {
      if (error.message.includes('password')) {
        throw new Error('Excel file is password protected. Please provide password.');
      }
      throw error;
    }
  }

  /**
   * Parse CSV files with encoding detection
   */
  async parseCSVFile(filePath, options = {}) {
    const encoding = await this._detectEncoding(filePath);
    const delimiter = options.delimiter || await this._detectDelimiter(filePath);
    
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      
      fs.createReadStream(filePath)
        .pipe(iconv.decodeStream(encoding))
        .pipe(csv({ separator: delimiter, skipEmptyLines: true }))
        .on('data', (row) => results.push(row))
        .on('error', (error) => errors.push(error))
        .on('end', () => {
          resolve(this._processCSVResults(results, errors, { encoding, delimiter }));
        });
    });
  }

  /**
   * Parse TSV files
   */
  async parseTSVFile(filePath, options = {}) {
    return this.parseCSVFile(filePath, { ...options, delimiter: '\t' });
  }

  // ====== EXCEL-SPECIFIC FEATURES ======

  /**
   * Parse multiple sheets in workbook
   */
  async parseMultipleSheets(workbook, options = {}) {
    const results = [];
    
    for (const worksheet of workbook.worksheets) {
      try {
        const sheetResult = await this.parseSheet(worksheet, options);
        results.push({
          sheetName: worksheet.name,
          ...sheetResult
        });
      } catch (error) {
        this.logger.warn(`Failed to parse sheet ${worksheet.name}:`, error);
        results.push({
          sheetName: worksheet.name,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Detect sheet structure and identify components
   */
  detectSheetStructure(sheet) {
    const structure = {
      headerRow: null,
      dataStartRow: null,
      dataEndRow: null,
      emptyRows: [],
      mergedCells: [],
      totalRows: sheet.rowCount,
      totalColumns: sheet.columnCount
    };

    // Find header row
    structure.headerRow = this.detectHeaderRow(sheet);
    
    // Find data boundaries
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const hasData = row.values.some(cell => cell !== null && cell !== undefined && cell !== '');
      
      if (hasData) {
        if (structure.dataStartRow === null) {
          structure.dataStartRow = i;
        }
        structure.dataEndRow = i;
      } else if (structure.dataStartRow !== null) {
        structure.emptyRows.push(i);
      }
    }

    // Identify merged cells
    if (sheet.model && sheet.model.merges) {
      structure.mergedCells = Object.keys(sheet.model.merges);
    }

    return structure;
  }

  /**
   * Extract sheet names from workbook
   */
  extractSheetNames(workbook) {
    return workbook.worksheets.map(sheet => ({
      id: sheet.id,
      name: sheet.name,
      state: sheet.state,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount
    }));
  }

  /**
   * Handle merged cells correctly
   */
  handleMergedCells(sheet) {
    const mergedData = {};
    
    if (sheet.model && sheet.model.merges) {
      Object.keys(sheet.model.merges).forEach(range => {
        const merge = sheet.model.merges[range];
        const masterCell = sheet.getCell(merge.top, merge.left);
        
        // Propagate master cell value to all merged cells
        for (let row = merge.top; row <= merge.bottom; row++) {
          for (let col = merge.left; col <= merge.right; col++) {
            mergedData[`${row}:${col}`] = masterCell.value;
          }
        }
      });
    }
    
    return mergedData;
  }

  /**
   * Read formulas and calculated values
   */
  readFormulas(sheet) {
    const formulas = {};
    
    sheet.eachRow((row, rowIndex) => {
      row.eachCell((cell, colIndex) => {
        if (cell.formula) {
          formulas[`${rowIndex}:${colIndex}`] = {
            formula: cell.formula,
            result: cell.result,
            value: cell.value
          };
        }
      });
    });
    
    return formulas;
  }

  /**
   * Preserve formatting information
   */
  preserveFormatting(sheet) {
    const formatting = {};
    
    sheet.eachRow((row, rowIndex) => {
      row.eachCell((cell, colIndex) => {
        if (cell.numFmt || cell.style) {
          formatting[`${rowIndex}:${colIndex}`] = {
            numFmt: cell.numFmt,
            dataType: cell.type,
            style: cell.style
          };
        }
      });
    });
    
    return formatting;
  }

  // ====== DATA DETECTION & VALIDATION ======

  /**
   * Automatically detect header row
   */
  detectHeaderRow(sheet) {
    for (let i = 1; i <= Math.min(10, sheet.rowCount); i++) {
      const row = sheet.getRow(i);
      const values = row.values.filter(v => v !== null && v !== undefined);
      
      if (values.length >= 3) {
        const textRatio = values.filter(v => typeof v === 'string').length / values.length;
        if (textRatio > 0.7) {
          return i;
        }
      }
    }
    return 1; // Default to first row
  }

  /**
   * Map columns to transaction fields
   */
  mapColumnsToFields(headers) {
    const mapping = {};
    const fieldMappings = {
      date: ['date', 'transaction date', 'posted date', 'value date'],
      amount: ['amount', 'value', 'credit', 'debit', 'transaction amount'],
      description: ['description', 'reference', 'details', 'memo', 'narrative'],
      type: ['type', 'transaction type', 'dr/cr', 'debit credit'],
      category: ['category', 'account', 'account name'],
      vat: ['vat', 'tax', 'vat amount', 'tax amount'],
      netAmount: ['net', 'net amount', 'gross', 'gross amount']
    };

    headers.forEach((header, index) => {
      const normalizedHeader = header.toString().toLowerCase().trim();
      
      for (const [field, patterns] of Object.entries(fieldMappings)) {
        if (patterns.some(pattern => normalizedHeader.includes(pattern))) {
          mapping[field] = index;
          break;
        }
      }
    });

    return mapping;
  }

  /**
   * Validate required columns are present
   */
  validateRequiredColumns(mapping) {
    const required = ['date', 'amount', 'description'];
    const missing = required.filter(field => !(field in mapping));
    
    if (missing.length > 0) {
      throw new Error(`Missing required columns: ${missing.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Detect data types in columns
   */
  detectDataTypes(column) {
    const values = column.filter(v => v !== null && v !== undefined && v !== '');
    if (values.length === 0) return 'unknown';
    
    const types = {
      date: 0,
      number: 0,
      currency: 0,
      text: 0
    };

    values.forEach(value => {
      const str = value.toString();
      
      if (moment(str, this.config.dateFormats, true).isValid()) {
        types.date++;
      } else if (this.ukPatterns.currency.test(str)) {
        types.currency++;
      } else if (!isNaN(parseFloat(str))) {
        types.number++;
      } else {
        types.text++;
      }
    });

    return Object.keys(types).reduce((a, b) => types[a] > types[b] ? a : b);
  }

  /**
   * Validate data consistency across rows
   */
  validateDataConsistency(rows) {
    const issues = [];
    const columnTypes = {};
    
    rows.forEach((row, rowIndex) => {
      Object.keys(row).forEach(column => {
        const value = row[column];
        const detectedType = this._getValueType(value);
        
        if (!columnTypes[column]) {
          columnTypes[column] = detectedType;
        } else if (columnTypes[column] !== detectedType && detectedType !== 'empty') {
          issues.push({
            row: rowIndex + 1,
            column,
            expected: columnTypes[column],
            actual: detectedType,
            value
          });
        }
      });
    });
    
    return issues;
  }

  /**
   * Detect currency format in amounts
   */
  detectCurrencyFormat(amounts) {
    const formats = {
      gbp: 0,
      usd: 0,
      eur: 0,
      plain: 0
    };

    amounts.forEach(amount => {
      const str = amount.toString();
      if (str.includes('£')) formats.gbp++;
      else if (str.includes('$')) formats.usd++;
      else if (str.includes('€')) formats.eur++;
      else formats.plain++;
    });

    return Object.keys(formats).reduce((a, b) => formats[a] > formats[b] ? a : b);
  }

  // ====== TRANSACTION DATA EXTRACTION ======

  /**
   * Extract transaction data from sheet
   */
  async extractTransactionData(sheet, mapping) {
    const structure = this.detectSheetStructure(sheet);
    const transactions = [];
    const errors = [];
    
    const startRow = structure.dataStartRow || structure.headerRow + 1;
    const endRow = structure.dataEndRow || sheet.rowCount;
    
    for (let i = startRow; i <= endRow; i++) {
      try {
        const row = sheet.getRow(i);
        const transaction = await this._extractRowTransaction(row, mapping, i);
        
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        errors.push(this.handleParsingErrors(error, i, { sheet: sheet.name }));
      }
    }

    return { transactions, errors, totalRows: endRow - startRow + 1 };
  }

  /**
   * Parse transaction date with multiple format support
   */
  parseTransactionDate(dateValue, format = null) {
    if (!dateValue) return null;
    
    // Handle Excel date numbers
    if (typeof dateValue === 'number') {
      return moment(new Date((dateValue - 25569) * 86400 * 1000)).format('YYYY-MM-DD');
    }
    
    // Try specific format first
    if (format) {
      const date = moment(dateValue, format, true);
      if (date.isValid()) return date.format('YYYY-MM-DD');
    }
    
    // Try UK format first
    const ukDate = moment(dateValue, 'DD/MM/YYYY', true);
    if (ukDate.isValid()) return ukDate.format('YYYY-MM-DD');
    
    // Try other common formats
    for (const fmt of this.config.dateFormats) {
      const date = moment(dateValue, fmt, true);
      if (date.isValid()) return date.format('YYYY-MM-DD');
    }
    
    throw new Error(`Unable to parse date: ${dateValue}`);
  }

  /**
   * Parse transaction amount
   */
  parseTransactionAmount(amountValue) {
    if (!amountValue) return 0;
    
    let str = amountValue.toString().trim();
    
    // Remove currency symbols and spaces
    str = str.replace(/[£$€\s]/g, '');
    
    // Handle negative amounts in parentheses
    if (str.startsWith('(') && str.endsWith(')')) {
      str = '-' + str.slice(1, -1);
    }
    
    // Remove commas
    str = str.replace(/,/g, '');
    
    const amount = parseFloat(str);
    if (isNaN(amount)) {
      throw new Error(`Unable to parse amount: ${amountValue}`);
    }
    
    return amount;
  }

  /**
   * Clean and standardize transaction descriptions
   */
  cleanTransactionDescription(description) {
    if (!description) return '';
    
    return description.toString()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\-.,()]/g, '') // Remove special characters
      .substring(0, 255); // Limit length
  }

  /**
   * Detect transaction type (income vs expense)
   */
  detectTransactionType(amount, description = '') {
    const desc = description.toLowerCase();
    
    // Amount-based detection
    if (amount > 0) {
      // Check for income keywords
      const incomeKeywords = ['salary', 'payment received', 'invoice', 'refund', 'interest'];
      if (incomeKeywords.some(keyword => desc.includes(keyword))) {
        return 'income';
      }
      return 'expense'; // Positive amounts are usually expenses in accounting
    } else {
      return 'income'; // Negative amounts are usually income
    }
  }

  /**
   * Handle split transactions
   */
  handleSplitTransactions(row) {
    // Look for multiple amount columns or category columns
    const amounts = [];
    const categories = [];
    
    Object.keys(row).forEach(key => {
      if (key.toLowerCase().includes('amount') && row[key]) {
        amounts.push(this.parseTransactionAmount(row[key]));
      }
      if (key.toLowerCase().includes('category') && row[key]) {
        categories.push(row[key]);
      }
    });
    
    if (amounts.length > 1 || categories.length > 1) {
      return {
        isSplit: true,
        amounts,
        categories,
        totalAmount: amounts.reduce((sum, amount) => sum + amount, 0)
      };
    }
    
    return { isSplit: false };
  }

  // ====== UK-SPECIFIC PARSING ======

  /**
   * Parse UK date format (DD/MM/YYYY)
   */
  parseUKDates(dateString) {
    return this.parseTransactionDate(dateString, 'DD/MM/YYYY');
  }

  /**
   * Parse UK currency with £ symbol
   */
  parseUKCurrency(amountString) {
    if (!amountString) return 0;
    
    // Handle UK currency format
    let str = amountString.toString().trim();
    
    // Remove £ symbol and spaces
    str = str.replace(/£\s*/g, '');
    
    return this.parseTransactionAmount(str);
  }

  /**
   * Detect VAT-related columns
   */
  detectVATColumns(headers) {
    const vatColumns = {};
    const vatPatterns = {
      vatAmount: ['vat', 'tax', 'vat amount', 'tax amount'],
      netAmount: ['net', 'net amount', 'excluding vat'],
      grossAmount: ['gross', 'gross amount', 'including vat', 'total'],
      vatRate: ['vat rate', 'tax rate', 'rate']
    };
    
    headers.forEach((header, index) => {
      const normalizedHeader = header.toString().toLowerCase().trim();
      
      for (const [field, patterns] of Object.entries(vatPatterns)) {
        if (patterns.some(pattern => normalizedHeader.includes(pattern))) {
          vatColumns[field] = index;
        }
      }
    });
    
    return vatColumns;
  }

  /**
   * Parse common UK business expense categories
   */
  parseBusinessExpenseCategories(description) {
    const desc = description.toLowerCase();
    
    for (const [category, keywords] of Object.entries(this.expenseCategories)) {
      if (keywords.some(keyword => desc.includes(keyword))) {
        return category;
      }
    }
    
    return 'other';
  }

  /**
   * Validate UK postcodes
   */
  validateUKPostcodes(address) {
    if (!address) return null;
    
    const postcodeMatch = address.match(this.ukPatterns.postcode);
    return postcodeMatch ? postcodeMatch[0] : null;
  }

  // ====== ERROR HANDLING & REPORTING ======

  /**
   * Handle parsing errors with context
   */
  handleParsingErrors(error, row, context) {
    const errorInfo = {
      error: error.message,
      row,
      context,
      timestamp: new Date().toISOString(),
      severity: this._determineErrorSeverity(error)
    };
    
    this.logger.error('Parsing error:', errorInfo);
    
    return errorInfo;
  }

  /**
   * Generate comprehensive parsing report
   */
  generateParsingReport(results) {
    const report = {
      success: results.success || false,
      summary: {
        totalFiles: 1,
        totalSheets: results.sheets?.length || 0,
        totalRows: results.totalRows || 0,
        successfulRows: 0,
        errorRows: 0
      },
      errors: [],
      warnings: [],
      dataQuality: {},
      timestamp: new Date().toISOString()
    };
    
    if (results.sheets) {
      results.sheets.forEach(sheet => {
        if (sheet.transactions) {
          report.summary.successfulRows += sheet.transactions.length;
        }
        if (sheet.errors) {
          report.summary.errorRows += sheet.errors.length;
          report.errors.push(...sheet.errors);
        }
      });
    }
    
    report.dataQuality = this.generateDataQualityReport(results);
    
    return report;
  }

  /**
   * Validate file integrity before parsing
   */
  async validateFileIntegrity(filePath) {
    const stats = await fs.promises.stat(filePath);
    
    if (stats.size === 0) {
      throw new Error('File is empty');
    }
    
    if (stats.size > this.config.maxFileSize) {
      throw new Error(`File too large: ${stats.size} bytes (max: ${this.config.maxFileSize})`);
    }
    
    return true;
  }

  /**
   * Generate data quality report
   */
  generateDataQualityReport(parsing) {
    return {
      completeness: this._calculateCompleteness(parsing),
      consistency: this._calculateConsistency(parsing),
      accuracy: this._calculateAccuracy(parsing),
      duplicates: this._findDuplicates(parsing),
      outliers: this._findOutliers(parsing)
    };
  }

  // ====== HELPER METHODS ======

  async parseSheet(sheet, options) {
    const structure = this.detectSheetStructure(sheet);
    const headerRow = sheet.getRow(structure.headerRow);
    const headers = headerRow.values.slice(1); // Remove first empty element
    
    const mapping = this.mapColumnsToFields(headers);
    this.validateRequiredColumns(mapping);
    
    const result = await this.extractTransactionData(sheet, mapping);
    
    return {
      success: true,
      structure,
      headers,
      mapping,
      ...result
    };
  }

  async _extractRowTransaction(row, mapping, rowIndex) {
    const values = row.values.slice(1); // Remove first empty element
    const transaction = {
      rowIndex,
      originalData: {}
    };
    
    // Map values to fields
    Object.keys(mapping).forEach(field => {
      const colIndex = mapping[field];
      const value = values[colIndex];
      transaction.originalData[field] = value;
      
      switch (field) {
        case 'date':
          transaction.date = this.parseTransactionDate(value);
          break;
        case 'amount':
          transaction.amount = this.parseTransactionAmount(value);
          break;
        case 'description':
          transaction.description = this.cleanTransactionDescription(value);
          break;
        default:
          transaction[field] = value;
      }
    });
    
    // Add computed fields
    transaction.type = this.detectTransactionType(transaction.amount, transaction.description);
    transaction.category = this.parseBusinessExpenseCategories(transaction.description || '');
    
    return transaction;
  }

  _processCSVResults(results, errors, metadata) {
    if (results.length === 0) {
      throw new Error('No data found in CSV file');
    }
    
    const headers = Object.keys(results[0]);
    const mapping = this.mapColumnsToFields(headers);
    
    const transactions = results.map((row, index) => {
      try {
        return this._processCSVRow(row, mapping, index);
      } catch (error) {
        errors.push(this.handleParsingErrors(error, index + 1, { row }));
        return null;
      }
    }).filter(Boolean);
    
    return {
      success: true,
      sheets: [{
        sheetName: 'CSV Data',
        headers,
        mapping,
        transactions,
        errors,
        totalRows: results.length,
        metadata
      }],
      totalRows: results.length
    };
  }

  _processCSVRow(row, mapping, rowIndex) {
    const transaction = {
      rowIndex: rowIndex + 1,
      originalData: row
    };
    
    Object.keys(mapping).forEach(field => {
      const header = Object.keys(row)[mapping[field]];
      const value = row[header];
      
      switch (field) {
        case 'date':
          transaction.date = this.parseTransactionDate(value);
          break;
        case 'amount':
          transaction.amount = this.parseTransactionAmount(value);
          break;
        case 'description':
          transaction.description = this.cleanTransactionDescription(value);
          break;
        default:
          transaction[field] = value;
      }
    });
    
    transaction.type = this.detectTransactionType(transaction.amount, transaction.description);
    transaction.category = this.parseBusinessExpenseCategories(transaction.description || '');
    
    return transaction;
  }

  async extractMetadata(filePath) {
    const stats = await fs.promises.stat(filePath);
    const ext = this._getFileExtension(filePath);
    
    return {
      fileName: filePath.split('/').pop(),
      fileSize: stats.size,
      fileType: ext,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      encoding: await this._detectEncoding(filePath)
    };
  }

  _getFileExtension(filePath) {
    return filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  }

  _generateFileHash(filePath) {
    const stats = fs.statSync(filePath);
    return crypto.createHash('md5').update(`${filePath}-${stats.size}-${stats.mtime}`).digest('hex');
  }

  async _detectEncoding(filePath) {
    const buffer = await fs.promises.readFile(filePath);
    const sample = buffer.slice(0, 1024);
    
    // Try to detect encoding
    for (const encoding of this.config.encoding.fallback) {
      try {
        const decoded = iconv.decode(sample, encoding);
        if (!decoded.includes('�')) { // No replacement characters
          return encoding;
        }
      } catch (error) {
        continue;
      }
    }
    
    return this.config.encoding.default;
  }

  async _detectDelimiter(filePath) {
    const buffer = await fs.promises.readFile(filePath);
    const sample = buffer.toString('utf8', 0, 1024);
    
    const counts = {};
    this.config.delimiters.forEach(delimiter => {
      counts[delimiter] = (sample.match(new RegExp(delimiter, 'g')) || []).length;
    });
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }

  _getValueType(value) {
    if (value === null || value === undefined || value === '') return 'empty';
    if (typeof value === 'number') return 'number';
    if (moment(value, this.config.dateFormats, true).isValid()) return 'date';
    if (this.ukPatterns.currency.test(value.toString())) return 'currency';
    return 'text';
  }

  _determineErrorSeverity(error) {
    if (error.message.includes('required') || error.message.includes('missing')) {
      return 'critical';
    }
    if (error.message.includes('format') || error.message.includes('parse')) {
      return 'warning';
    }
    return 'error';
  }

  _calculateCompleteness(parsing) {
    // Implementation for data completeness calculation
    return 0.95; // Placeholder
  }

  _calculateConsistency(parsing) {
    // Implementation for data consistency calculation
    return 0.90; // Placeholder
  }

  _calculateAccuracy(parsing) {
    // Implementation for data accuracy calculation
    return 0.88; // Placeholder
  }

  _findDuplicates(parsing) {
    // Implementation for duplicate detection
    return []; // Placeholder
  }

  _findOutliers(parsing) {
    // Implementation for outlier detection
    return []; // Placeholder
  }

  async cacheParsingResults(fileHash, results = null) {
    if (results) {
      return await this.cache.set(`parse:${fileHash}`, results, 3600);
    } else {
      return await this.cache.get(`parse:${fileHash}`);
    }
  }
}

module.exports = SpreadsheetParserService;