import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import submitApiService from './submit.js';
import DisplayTransactions from '../displayTransactions/displayTransactions.jsx';
import './submit.css';

const Submit = () => {
  const navigate = useNavigate();
  const [isVatRegistered, setIsVatRegistered] = useState(false);
  const [submissionType, setSubmissionType] = useState('');
  const [quarterPeriod, setQuarterPeriod] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadConfig, setUploadConfig] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [businessType, setBusinessType] = useState('sole_trader');
  
  // Popup state
  const [showResultsPopup, setShowResultsPopup] = useState(false);
  const [categorizedData, setCategorizedData] = useState(null);
  
  // Dynamic loading messages
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [loadingInterval, setLoadingInterval] = useState(null);

  // Load upload configuration on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await submitApiService.getUploadConfig();
        setUploadConfig(config.uploadConfig);
        console.log('Upload config loaded:', config);
      } catch (error) {
        console.error('Failed to load upload config:', error);
      }
    };

    loadConfig();
    
    // Cleanup interval on unmount
    return () => {
      if (loadingInterval) {
        clearInterval(loadingInterval);
      }
    };
  }, [loadingInterval]);

  const handleVatToggle = () => {
    setIsVatRegistered(!isVatRegistered);
    setSubmissionType('');
    setQuarterPeriod('');
  };

  const handleSubmissionTypeChange = (e) => {
    setSubmissionType(e.target.value);
    setQuarterPeriod('');
  };

  const handleQuarterChange = (e) => {
    setQuarterPeriod(e.target.value);
  };

  const handleFileUpload = async (file) => {
    // Validate file type using config or defaults
    const allowedFormats = uploadConfig?.allowedFormats || ['.xlsx', '.xls', '.csv'];
    const isValidType = allowedFormats.some(format => 
      file.name.toLowerCase().endsWith(format.toLowerCase())
    );

    if (!isValidType) {
      alert(`Please upload a valid file. Supported formats: ${allowedFormats.join(', ')}`);
      return;
    }

    // Check file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploadedFile(file);
    setValidationResult(null);
    setUploadStatus('');

    // Validate file with backend
    try {
      setUploadStatus('Validating file...');
      const validation = await submitApiService.validateFile(file);
      setValidationResult(validation.validation);
      setUploadStatus('File validated successfully');
    } catch (error) {
      console.error('File validation failed:', error);
      setUploadStatus('File validation failed - but you can still try to upload');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setValidationResult(null);
    setUploadStatus('');
  };

  // Dynamic loading messages
  const startLoadingMessages = () => {
    const messages = [
      'Reading your spreadsheet...',
      'Analyzing transaction data...',
      'Categorizing transactions...',
      'Processing business expenses...',
      'Formatting for HMRC...',
      'Finalizing results...'
    ];
    
    let currentIndex = 0;
    setLoadingMessage(messages[0]);
    
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % messages.length;
      setLoadingMessage(messages[currentIndex]);
    }, 2000); // Change message every 2 seconds
    
    setLoadingInterval(interval);
  };

  const stopLoadingMessages = () => {
    if (loadingInterval) {
      clearInterval(loadingInterval);
      setLoadingInterval(null);
    }
    setLoadingMessage('Processing...');
  };

  const handleSubmit = async () => {
    // Validation
    if (!isVatRegistered) {
      alert('Please confirm VAT registration status');
      return;
    }

    if (!submissionType) {
      alert('Please select submission type');
      return;
    }

    if (submissionType === 'quarterly' && !quarterPeriod) {
      alert('Please select quarter period');
      return;
    }

    if (!uploadedFile) {
      alert('Please upload a file');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Starting upload...');
    startLoadingMessages(); // Start dynamic loading messages

    try {
      // Prepare submission data for API
      const submissionData = {
        submissionType: submissionType,
        businessType: businessType,
        taxYear: new Date().getFullYear(),
        ...(submissionType === 'quarterly' && { 
          quarter: quarterPeriod 
        })
      };

      console.log('📋 Submission data:', submissionData);

      setUploadStatus('Processing spreadsheet...');

      // Upload and process file
      const response = await submitApiService.processSpreadsheet(uploadedFile, submissionData);
      
      console.log('✅ Full API response:', response);

      setUploadStatus('Processing complete!');

      // Show popup with categorized data
      let categorizedDataToShow = null;
      
      if (response && response.categorizedData) {
        categorizedDataToShow = response.categorizedData;
      } else if (response.data && response.data.categorizedData) {
        categorizedDataToShow = response.data.categorizedData;
      } else if (response.result && response.result.categorizedData) {
        categorizedDataToShow = response.result.categorizedData;
      }
      
      if (categorizedDataToShow) {
        console.log('✅ Showing categorized data in popup:', categorizedDataToShow);
        setCategorizedData(categorizedDataToShow);
        setShowResultsPopup(true);
      } else {
        console.warn('⚠️ No categorized data found in response');
        alert('Upload successful but no categorization data available');
      }
      
    } catch (error) {
      setUploadStatus('Upload failed');
      
      // Handle different error types
      const errorInfo = submitApiService.handleApiError(error);
      
      // Show appropriate error message
      alert(`Upload failed: ${errorInfo.message}`);
      
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      stopLoadingMessages(); // Stop dynamic loading messages
    }
  };

  const handleClosePopup = () => {
    setShowResultsPopup(false);
    setCategorizedData(null);
    // Reset form for next upload
    setUploadedFile(null);
    setValidationResult(null);
    setUploadStatus('');
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  // Icon components (keeping existing ones)
  const UploadIcon = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17,8 12,3 7,8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );

  const FileIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10,9 9,9 8,9"/>
    </svg>
  );

  const RemoveIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );

  const LoadingIcon = () => (
    <div className="spinner-circle"></div>
  );

  const BackIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5"/>
      <path d="M12 19l-7-7 7-7"/>
    </svg>
  );

  const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  );

  return (
    <div className="submit-container">
      <div className="submit-content">
        <div className="submit-header">
          <button onClick={handleBackToHome} className="back-button">
            <BackIcon />
            <span>Back to Dashboard</span>
          </button>
          <h1>New MTD Submission</h1>
          <p>Submit your Making Tax Digital compliance data</p>
        </div>

        <div className="submit-form">
          {/* VAT Registration Toggle */}
          <div className="form-section">
            <label className="form-label">VAT Registration Status</label>
            <div className="toggle-container">
              <span className={`toggle-label ${!isVatRegistered ? 'active' : ''}`}>
                Not VAT Registered
              </span>
              <div className="toggle-switch" onClick={handleVatToggle}>
                <div className={`toggle-slider ${isVatRegistered ? 'active' : ''}`}></div>
              </div>
              <span className={`toggle-label ${isVatRegistered ? 'active' : ''}`}>
                VAT Registered
              </span>
            </div>
          </div>

          {/* Submission Type Dropdown */}
          {isVatRegistered && (
            <div className="form-section">
              <label className="form-label" htmlFor="submission-type">
                Submission Type
              </label>
              <select
                id="submission-type"
                className="form-select"
                value={submissionType}
                onChange={handleSubmissionTypeChange}
              >
                <option value="">Select submission type</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Annual</option>
              </select>
            </div>
          )}

          {/* Quarter Period Dropdown */}
          {isVatRegistered && submissionType === 'quarterly' && (
            <div className="form-section">
              <label className="form-label" htmlFor="quarter-period">
                Quarter Period
              </label>
              <select
                id="quarter-period"
                className="form-select"
                value={quarterPeriod}
                onChange={handleQuarterChange}
              >
                <option value="">Select quarter</option>
                <option value="q1">Q1 (Jan - Mar)</option>
                <option value="q2">Q2 (Apr - Jun)</option>
                <option value="q3">Q3 (Jul - Sep)</option>
                <option value="q4">Q4 (Oct - Dec)</option>
              </select>
            </div>
          )}

          {/* Business Type Selection */}
          {isVatRegistered && (
            <div className="form-section">
              <label className="form-label">Business Type</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="businessType"
                    value="sole_trader"
                    checked={businessType === 'sole_trader'}
                    onChange={(e) => setBusinessType(e.target.value)}
                  />
                  <span>Sole Trader</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="businessType"
                    value="landlord"
                    checked={businessType === 'landlord'}
                    onChange={(e) => setBusinessType(e.target.value)}
                  />
                  <span>Landlord</span>
                </label>
              </div>
            </div>
          )}

          {/* File Upload Section */}
          {isVatRegistered && submissionType && (submissionType === 'yearly' || quarterPeriod) && (
            <div className="form-section">
              <label className="form-label">Upload File</label>
              
              {!uploadedFile ? (
                <div
                  className={`upload-area ${isDragOver ? 'drag-over' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => document.getElementById('file-input').click()}
                >
                  <UploadIcon />
                  <h3>Drag and drop your file here</h3>
                  <p>or click to browse files</p>
                  <span className="file-types">
                    Supports {uploadConfig?.allowedFormats?.join(', ') || '.xlsx, .xls, .csv'} files
                  </span>
                  
                  <input
                    id="file-input"
                    type="file"
                    accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <div className="uploaded-file">
                  <div className="file-info">
                    <FileIcon />
                    <div className="file-details">
                      <span className="file-name">{uploadedFile.name}</span>
                      <span className="file-size">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      {validationResult && (
                        <div className="validation-info">
                          <CheckIcon />
                          <span>
                            {validationResult.estimatedRows} rows detected, 
                            {validationResult.detectedColumns?.length || 0} columns
                          </span>
                        </div>
                      )}
                    </div>
                    <button className="remove-file" onClick={removeFile}>
                      <RemoveIcon />
                    </button>
                  </div>
                  
                  {/* Upload Status */}
                  {uploadStatus && (
                    <div className="upload-status">
                      <p>{uploadStatus}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          {uploadedFile && (
            <div className="form-section">
              <button
                className={`submit-button ${isUploading ? 'uploading' : ''}`}
                onClick={handleSubmit}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <LoadingIcon />
                    <span>{loadingMessage}</span>
                  </>
                ) : (
                  <span>Process Spreadsheet</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results Popup */}
      {showResultsPopup && categorizedData && (
        <DisplayTransactions 
          categorizedData={categorizedData}
          isOpen={showResultsPopup}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
};

export default Submit;