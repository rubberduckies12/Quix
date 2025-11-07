import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import submitApiService from '../submit/submit.js';
import './displayTransactions.css';

const DisplayTransactions = ({ categorizedData, isOpen, onClose, fullSubmissionData }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  console.log('DisplayTransactions received props:', { categorizedData, isOpen });

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

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