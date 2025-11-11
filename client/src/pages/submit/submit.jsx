import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import submitApiService from './submit.js';
import { getUserSubmissions } from '../home/home.js';
import DisplayTransactions from '../displayTransactions/displayTransactions.jsx';
import './submit.css';

const Submit = () => {
  const navigate = useNavigate();
  const [isDataConfirmed, setIsDataConfirmed] = useState(false);
  const [submissionType, setSubmissionType] = useState('');
  const [quarterPeriod, setQuarterPeriod] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadConfig, setUploadConfig] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [businessType, setBusinessType] = useState('sole_trader');
  
  // Track uploaded periods to prevent duplicates
  const [uploadedPeriods, setUploadedPeriods] = useState({
    q1: false,
    q2: false,
    q3: false,
    q4: false,
    annual: false
  });
  
  // Submission options for Q2+ quarterly submissions
  const [submissionOptions, setSubmissionOptions] = useState({
    spreadsheetType: '', // 'different_per_quarter', 'same_cumulative', 'same_separated'
    previousQuarterData: null
  });
  
  // Popup state
  const [showResultsPopup, setShowResultsPopup] = useState(false);
  const [categorizedData, setCategorizedData] = useState(null);
  const [fullSubmissionData, setFullSubmissionData] = useState(null);
  
  // Dynamic loading messages
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [loadingInterval, setLoadingInterval] = useState(null);

  // Load upload configuration and check for existing uploads on component mount
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

    const loadUploadedPeriods = async () => {
      try {
        const submissions = await getUserSubmissions(1); // userId = 1 for now
        const periods = {
          q1: false,
          q2: false,
          q3: false,
          q4: false,
          annual: false
        };
        
        submissions.forEach(submission => {
          if (submission.type === 'quarterly' && submission.quarter) {
            periods[submission.quarter] = true;
          } else if (submission.type === 'annual') {
            periods.annual = true;
          }
        });
        
        setUploadedPeriods(periods);
        console.log('Uploaded periods:', periods);
      } catch (error) {
        console.error('Failed to load uploaded periods:', error);
      }
    };

    loadConfig();
    loadUploadedPeriods();
    
    // Cleanup interval on unmount
    return () => {
      if (loadingInterval) {
        clearInterval(loadingInterval);
      }
    };
  }, [loadingInterval]);

  const handleDataConfirmToggle = () => {
    setIsDataConfirmed(!isDataConfirmed);
  };

  const handleSubmissionTypeChange = (e) => {
    setSubmissionType(e.target.value);
    setQuarterPeriod('');
    // Reset submission options when changing submission type
    setSubmissionOptions({
      spreadsheetType: '',
      previousQuarterData: null
    });
  };

  const handleQuarterChange = (e) => {
    setQuarterPeriod(e.target.value);
    // Reset submission options when changing quarter
    setSubmissionOptions({
      spreadsheetType: '',
      previousQuarterData: null
    });
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
    if (!isDataConfirmed) {
      alert('Please confirm your spreadsheet data is as clear as possible');
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

    // Check if period has already been uploaded
    if (submissionType === 'quarterly' && uploadedPeriods[quarterPeriod]) {
      alert(`${quarterPeriod.toUpperCase()} has already been uploaded. Please delete the existing submission first if you want to re-upload.`);
      return;
    }

    if (submissionType === 'yearly' && uploadedPeriods.annual) {
      alert('Annual submission has already been uploaded. Please delete the existing submission first if you want to re-upload.');
      return;
    }

    // For Q2+ quarterly submissions, check if submission options are needed
    if (submissionType === 'quarterly' && quarterPeriod !== 'q1' && !submissionOptions.spreadsheetType) {
      alert('Please specify how your spreadsheet is organized for this quarter');
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
        }),
        // Include submission options for quarterly submissions
        ...(submissionType === 'quarterly' && quarterPeriod !== 'q1' && {
          submissionOptions: submissionOptions
        })
      };

      console.log('📋 Submission data:', submissionData);

      setUploadStatus('Processing spreadsheet...');

      // Upload and process file
      const response = await submitApiService.processSpreadsheet(uploadedFile, submissionData);
      
      console.log('✅ Full API response:', response);

      setUploadStatus('Processing complete!');

      // Store full submission data for saving
      setFullSubmissionData(response);

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
    setFullSubmissionData(null);
    // Reset form for next upload
    setUploadedFile(null);
    setValidationResult(null);
    setUploadStatus('');
  };

  const handleBackToHome = () => {
    navigate('/home');
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
      <path d="M15 18l-6-6 6-6"/>
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
            <span>Back</span>
          </button>
          <h1>New MTD Submission</h1>
          <p>Submit your Making Tax Digital compliance data</p>
        </div>

        <div className="submit-form">
          {/* Data Confirmation Toggle */}
          <div className="form-section">
            <label className="form-label">Data Confirmation</label>
            <div className="toggle-container">
              <span className={`toggle-label ${!isDataConfirmed ? 'active' : ''}`}>
                Not Confirmed
              </span>
              <div className="toggle-switch" onClick={handleDataConfirmToggle}>
                <div className={`toggle-slider ${isDataConfirmed ? 'active' : ''}`}></div>
              </div>
              <span className={`toggle-label ${isDataConfirmed ? 'active' : ''}`}>
                I confirm my spreadsheet is as clear as possible and understand the output is only as accurate as the input
              </span>
            </div>
          </div>

          {/* Submission Type Dropdown */}
          {isDataConfirmed && (
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
                <option value="yearly" disabled={uploadedPeriods.annual}>
                  Annual {uploadedPeriods.annual ? '(Already Uploaded)' : ''}
                </option>
              </select>
            </div>
          )}

          {/* Quarter Period Dropdown */}
          {isDataConfirmed && submissionType === 'quarterly' && (
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
                <option value="q1" disabled={uploadedPeriods.q1}>
                  Q1 (Jan - Mar) {uploadedPeriods.q1 ? '(Already Uploaded)' : ''}
                </option>
                <option value="q2" disabled={uploadedPeriods.q2}>
                  Q2 (Apr - Jun) {uploadedPeriods.q2 ? '(Already Uploaded)' : ''}
                </option>
                <option value="q3" disabled={uploadedPeriods.q3}>
                  Q3 (Jul - Sep) {uploadedPeriods.q3 ? '(Already Uploaded)' : ''}
                </option>
                <option value="q4" disabled={uploadedPeriods.q4}>
                  Q4 (Oct - Dec) {uploadedPeriods.q4 ? '(Already Uploaded)' : ''}
                </option>
              </select>
            </div>
          )}

          {/* Submission Options for Q2+ */}
          {isDataConfirmed && submissionType === 'quarterly' && quarterPeriod && quarterPeriod !== 'q1' && (
            <div className="form-section">
              <label className="form-label">Spreadsheet Organization</label>
              <p className="form-description">
                How is your spreadsheet organized for this quarter ({quarterPeriod.toUpperCase()})?
              </p>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="spreadsheetType"
                    value="different_per_quarter"
                    checked={submissionOptions.spreadsheetType === 'different_per_quarter'}
                    onChange={(e) => setSubmissionOptions({
                      ...submissionOptions,
                      spreadsheetType: e.target.value
                    })}
                  />
                  <div className="radio-content">
                    <span>Different spreadsheet for each quarter</span>
                    <small>I have separate files for each quarter (e.g., Q1.xlsx, Q2.xlsx)</small>
                  </div>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="spreadsheetType"
                    value="same_cumulative"
                    checked={submissionOptions.spreadsheetType === 'same_cumulative'}
                    onChange={(e) => setSubmissionOptions({
                      ...submissionOptions,
                      spreadsheetType: e.target.value
                    })}
                  />
                  <div className="radio-content">
                    <span>Same spreadsheet with running totals</span>
                    <small>Running totals that include previous quarters (we'll calculate the difference)</small>
                  </div>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="spreadsheetType"
                    value="same_separated"
                    checked={submissionOptions.spreadsheetType === 'same_separated'}
                    onChange={(e) => setSubmissionOptions({
                      ...submissionOptions,
                      spreadsheetType: e.target.value
                    })}
                  />
                  <div className="radio-content">
                    <span>Same spreadsheet with separated quarters</span>
                    <small>Quarters are clearly labeled in sections (e.g., "Q1", "Q2" headers)</small>
                  </div>
                </label>
              </div>
              {submissionOptions.spreadsheetType && (
                <div className="submission-tip">
                  <p>
                    {submissionOptions.spreadsheetType === 'different_per_quarter' && (
                      "✅ Upload just your " + quarterPeriod.toUpperCase() + " spreadsheet - we'll process only that quarter's data."
                    )}
                    {submissionOptions.spreadsheetType === 'same_cumulative' && (
                      "🔍 We'll automatically calculate the difference between your current totals and previous quarters."
                    )}
                    {submissionOptions.spreadsheetType === 'same_separated' && (
                      "📊 We'll automatically find and extract only the " + quarterPeriod.toUpperCase() + " section from your spreadsheet."
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Business Type Selection */}
          {isDataConfirmed && (
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
          {isDataConfirmed && submissionType && (submissionType === 'yearly' || quarterPeriod) && (
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
          fullSubmissionData={fullSubmissionData}
          isOpen={showResultsPopup}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
};

export default Submit;