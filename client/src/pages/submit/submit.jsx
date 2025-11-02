import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './submit.css';

const Submit = () => {
  const navigate = useNavigate();
  const [isVatRegistered, setIsVatRegistered] = useState(false);
  const [submissionType, setSubmissionType] = useState('');
  const [quarterPeriod, setQuarterPeriod] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleVatToggle = () => {
    setIsVatRegistered(!isVatRegistered);
    // Reset dependent fields when toggling
    setSubmissionType('');
    setQuarterPeriod('');
  };

  const handleSubmissionTypeChange = (e) => {
    setSubmissionType(e.target.value);
    // Reset quarter period when changing submission type
    setQuarterPeriod('');
  };

  const handleQuarterChange = (e) => {
    setQuarterPeriod(e.target.value);
  };

  const handleFileUpload = (file) => {
    // Validate file type
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.xls') && !file.name.toLowerCase().endsWith('.xlsx')) {
      alert('Please upload an Excel file (.xls or .xlsx)');
      return;
    }

    setUploadedFile(file);
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
  };

  const handleSubmit = async () => {
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
      alert('Please upload an Excel file');
      return;
    }

    setIsUploading(true);

    try {
      // Simulate upload process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Here you would typically upload to your backend
      console.log('Submitting:', {
        vatRegistered: isVatRegistered,
        submissionType,
        quarterPeriod: submissionType === 'quarterly' ? quarterPeriod : null,
        file: uploadedFile
      });

      alert('Submission successful!');
      
      // Navigate back to home after successful submission
      navigate('/');
      
    } catch (error) {
      alert('Upload failed. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  // Icon components
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="loading-spinner">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );

  const BackIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5"/>
      <path d="M12 19l-7-7 7-7"/>
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
                <option value="yearly">Yearly</option>
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

          {/* File Upload Section */}
          {isVatRegistered && submissionType && (submissionType === 'yearly' || quarterPeriod) && (
            <div className="form-section">
              <label className="form-label">Upload Excel File</label>
              
              {!uploadedFile ? (
                <div
                  className={`upload-area ${isDragOver ? 'drag-over' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => document.getElementById('file-input').click()}
                >
                  <UploadIcon />
                  <h3>Drag and drop your Excel file here</h3>
                  <p>or click to browse files</p>
                  <span className="file-types">Supports .xls and .xlsx files</span>
                  
                  <input
                    id="file-input"
                    type="file"
                    accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
                    </div>
                    <button className="remove-file" onClick={removeFile}>
                      <RemoveIcon />
                    </button>
                  </div>
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
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Submit to HMRC</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Submit;