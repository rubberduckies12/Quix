import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './displayTransactions.css';

const DisplayTransactions = ({ categorizedData, isOpen, onClose }) => {
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
        </div>
      </div>
    </div>
  );
};

export default DisplayTransactions;