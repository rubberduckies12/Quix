const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { AppError } = require('../utils/errors.util');

/**
 * File Upload Middleware for MTD Tax Bridge
 * Handles spreadsheet uploads with validation and storage
 */

// Ensure upload directory exists
const ensureUploadDir = async (dir) => {
  try {
    await fs.access(dir);
  } catch (error) {
    await fs.mkdir(dir, { recursive: true });
  }
};

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    await ensureUploadDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter for spreadsheet files only
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
    'application/csv'
  ];
  
  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError('Only spreadsheet files (.xlsx, .xls, .csv) are allowed', 400), false);
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1 // Only one file at a time
  }
});

// Upload middleware with error handling
const uploadSpreadsheet = (req, res, next) => {
  const singleUpload = upload.single('spreadsheet');
  
  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File size too large. Maximum 10MB allowed', 400));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new AppError('Too many files. Only one file allowed', 400));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError('Unexpected field name. Use "spreadsheet" field', 400));
      }
      return next(new AppError(`Upload error: ${err.message}`, 400));
    }
    
    if (err) {
      return next(err);
    }
    
    if (!req.file) {
      return next(new AppError('No file uploaded. Please select a spreadsheet file', 400));
    }
    
    next();
  });
};

// Clean up uploaded file (use in error cases)
const cleanupFile = async (filePath) => {
  try {
    if (filePath) {
      await fs.unlink(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', error);
  }
};

module.exports = {
  uploadSpreadsheet,
  cleanupFile
};