import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import submitApiService from '../submit/submit.js';
import './displayTransactions.css';

const DisplayTransactions = ({ categorizedData, isOpen, onClose, fullSubmissionData }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  
  // Check if we're in standalone page mode (from home page) or modal mode (from submit page)
  const isStandalonePage = location.state?.fromHome;
  const standaloneData = location.state?.submissionData;
  
  // Use either prop data (modal mode) or location state data (standalone page)
  const dataToDisplay = isStandalonePage ? standaloneData?.totals : categorizedData;
  const submissionInfo = isStandalonePage ? standaloneData?.submission : null;
  
  console.log('DisplayTransactions mode:', isStandalonePage ? 'Standalone Page' : 'Modal');
  console.log('DisplayTransactions data:', dataToDisplay);

  // Helper functions defined first
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const renderStandalonePage = (data, submissionInfo) => {
    // Group data by category
    const categoryMap = {};
    data.forEach(item => {
      if (!categoryMap[item.category]) {
        categoryMap[item.category] = {
          category: item.category,
          type: item.type,
          totalAmount: 0
        };
      }
      categoryMap[item.category].totalAmount += item.totalAmount;
    });

    const frontendSummary = Object.values(categoryMap).map(item => ({
      category: item.category,
      categoryDescription: item.category.replace(/([A-Z])/g, ' $1').trim(),
      type: item.type,
      totalAmount: item.totalAmount
    }));

    const totalIncome = frontendSummary
      .filter(item => item.type === 'income')
      .reduce((sum, item) => sum + item.totalAmount, 0);
    
    const totalExpenses = frontendSummary
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + item.totalAmount, 0);

    const isSubmittedToHMRC = submissionInfo?.status === 'submitted_to_hmrc' || 
                              submissionInfo?.status === 'hmrc_submitted';

    return (
      <div className="standalone-modal-overlay">
        <div className="standalone-modal-wrapper">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h3>HMRC Categorization Results</h3>
                {submissionInfo && (
                  <div className="submission-metadata">
                    <span className="metadata-item">
                      {submissionInfo.type === 'quarterly' 
                        ? `${submissionInfo.quarter?.toUpperCase()} ${submissionInfo.tax_year}` 
                        : `Annual ${submissionInfo.tax_year}`}
                    </span>
                    <span className={`metadata-item hmrc-status ${isSubmittedToHMRC ? 'submitted' : 'not-submitted'}`}>
                      {isSubmittedToHMRC 
                        ? '✓ Submitted to HMRC' 
                        : '⚠ Not yet submitted to HMRC'}
                    </span>
                  </div>
                )}
              </div>
              <button className="close-btn" onClick={() => navigate('/home')}>×</button>
            </div>
            
            <div className="modal-body">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Code</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {frontendSummary.map((item, index) => (
                    <tr key={index}>
                      <td>{item.categoryDescription}</td>
                      <td className={`type-${item.type}`}>
                        {item.type === 'income' ? 'Income' : 'Expense'}
                      </td>
                      <td>{item.category}</td>
                      <td className="amount">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Summary Totals */}
              <div className="summary-totals">
                <div className="total-row income">
                  <span>Total Income:</span>
                  <span>{formatCurrency(totalIncome)}</span>
                </div>
                <div className="total-row expense">
                  <span>Total Expenses:</span>
                  <span>{formatCurrency(totalExpenses)}</span>
                </div>
                <div className="total-row profit">
                  <span>Net Profit:</span>
                  <span>{formatCurrency(totalIncome - totalExpenses)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="modal-actions">
                <div className="button-group">
                  <button className="close-button" onClick={() => navigate('/home')}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // For standalone page mode, always show content
  if (isStandalonePage) {
    if (!dataToDisplay || !Array.isArray(dataToDisplay) || dataToDisplay.length === 0) {
      return (
        <div className="standalone-modal-overlay">
          <div className="standalone-modal-wrapper">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Error</h3>
                <button className="close-btn" onClick={() => navigate('/home')}>×</button>
              </div>
              <div className="modal-body">
                <div className="error-text">No submission data available</div>
                <div className="modal-actions">
                  <button className="close-button" onClick={() => navigate('/home')}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Transform backend totals data to match frontend format
    const transformedData = dataToDisplay.reduce((acc, total) => {
      const existing = acc.find(item => item.category === total.hmrc_category);
      if (existing) {
        existing.totalAmount += parseFloat(total.amount);
      } else {
        acc.push({
          category: total.hmrc_category,
          type: total.type,
          totalAmount: parseFloat(total.amount)
        });
      }
      return acc;
    }, []);

    return renderStandalonePage(transformedData, submissionInfo);
  }

  // Original modal mode logic
  if (!isOpen) {
    console.log('Popup not open, returning null');
    return null;
  }

  if (!categorizedData) {
    console.log('No categorized data provided');
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Error</h3>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="error-text">No categorization data provided</div>
        </div>
      </div>
    );
  }

  const { frontendSummary } = categorizedData;
  console.log('Frontend summary:', frontendSummary);

  if (!frontendSummary || !Array.isArray(frontendSummary) || frontendSummary.length === 0) {
    console.log('Invalid or empty frontend summary');
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Error</h3>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="error-text">No categorization results available</div>
        </div>
      </div>
    );
  }

  const handleSaveSubmission = async () => {
    if (!fullSubmissionData) {
      alert('No submission data available to save');
      return;
    }

    setIsSaving(true);
    setSaveStatus('Saving submission...');

    try {
      const result = await submitApiService.saveSubmission(fullSubmissionData);
      
      console.log('✅ Submission saved:', result);
      
      setIsSaved(true);
      setSaveStatus(`Saved successfully! Upload ID: ${result.data.uploadId}`);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSaveStatus('');
      }, 3000);

    } catch (error) {
      console.error('❌ Save failed:', error);
      setSaveStatus('Failed to save submission');
      
      // Auto-hide error message after 5 seconds
      setTimeout(() => {
        setSaveStatus('');
      }, 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>HMRC Categorization Results</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <table className="results-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Type</th>
                <th>Code</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {frontendSummary.map((item, index) => (
                <tr key={index}>
                  <td>{item.categoryDescription}</td>
                  <td className={`type-${item.type}`}>
                    {item.type === 'income' ? 'Income' : 'Expense'}
                  </td>
                  <td>{item.category}</td>
                  <td className="amount">{formatCurrency(item.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Summary Totals */}
          <div className="summary-totals">
            <div className="total-row income">
              <span>Total Income:</span>
              <span>{formatCurrency(
                frontendSummary
                  .filter(item => item.type === 'income')
                  .reduce((sum, item) => sum + item.totalAmount, 0)
              )}</span>
            </div>
            <div className="total-row expense">
              <span>Total Expenses:</span>
              <span>{formatCurrency(
                frontendSummary
                  .filter(item => item.type === 'expense')
                  .reduce((sum, item) => sum + item.totalAmount, 0)
              )}</span>
            </div>
            <div className="total-row profit">
              <span>Net Profit:</span>
              <span>{formatCurrency(
                frontendSummary
                  .filter(item => item.type === 'income')
                  .reduce((sum, item) => sum + item.totalAmount, 0) -
                frontendSummary
                  .filter(item => item.type === 'expense')
                  .reduce((sum, item) => sum + item.totalAmount, 0)
              )}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-actions">
            {saveStatus && (
              <div className={`save-status ${isSaved ? 'success' : 'error'}`}>
                {saveStatus}
              </div>
            )}
            
            <div className="button-group">
              <button 
                className={`save-button ${isSaved ? 'saved' : ''}`}
                onClick={handleSaveSubmission}
                disabled={isSaving || isSaved}
              >
                {isSaving ? (
                  <>
                    <div className="spinner"></div>
                    Saving...
                  </>
                ) : isSaved ? (
                  <>
                    <CheckIcon />
                    Saved
                  </>
                ) : (
                  <>
                    <SaveIcon />
                    Save Submission
                  </>
                )}
              </button>
              
              <button className="close-button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Icon components
const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17,21 17,13 7,13 7,21"/>
    <polyline points="7,3 7,8 15,8"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);

export default DisplayTransactions;