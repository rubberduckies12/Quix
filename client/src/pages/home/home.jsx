import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMTDSubmissions, getUserSubmissions, deleteSubmission, getSubmissionDetails } from './home.js';
import './home.css';

const Home = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [openDropdowns, setOpenDropdowns] = useState({});

  useEffect(() => {
    // Load real data from backend
    const loadSubmissions = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMTDSubmissions();
        setSubmissions(data);
      } catch (err) {
        console.error('Failed to load submissions:', err);
        setError(`Failed to load submissions: ${err.message}`);
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };

    loadSubmissions();

    // Update current date every minute to keep status colors accurate
    const dateInterval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);

    return () => clearInterval(dateInterval);
  }, []);

  const getDueDateStatus = (dueDate) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'upcoming';
    return 'ontime';
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'uploaded':
      case 'submitted':
        return 'status-uploaded';
      case 'pending':
      case 'processing':
        return 'status-pending';
      case 'not uploaded':
      case 'not started':
      default:
        return 'status-not-uploaded';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleDropdownToggle = (submissionId) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [submissionId]: !prev[submissionId]
    }));
  };

  const handleDropdownAction = async (action, submission) => {
    console.log(`${action} clicked for ${submission.period}`);
    
    // Handle view action
    if (action === 'view') {
      if (!submission.uploadId) {
        setError('No submission data available to view');
        return;
      }
      
      try {
        setLoading(true);
        const details = await getSubmissionDetails(submission.uploadId);
        
        // Navigate to display transactions page with the submission data
        navigate('/display-transactions', { 
          state: { 
            submissionData: details,
            fromHome: true 
          } 
        });
      } catch (err) {
        console.error('Failed to fetch submission details:', err);
        setError(`Failed to load submission details: ${err.message}`);
        setLoading(false);
      }
      return;
    }
    
    // Handle delete action
    if (action === 'delete') {
      if (window.confirm(`Are you sure you want to delete the ${submission.period} submission? This cannot be undone.`)) {
        try {
          setLoading(true);
          await deleteSubmission(submission.uploadId, 1);
          
          // Refresh the submissions list
          const data = await getMTDSubmissions();
          setSubmissions(data);
          
          console.log('✅ Submission deleted successfully');
        } catch (err) {
          console.error('Failed to delete submission:', err);
          setError(`Failed to delete submission: ${err.message}`);
        } finally {
          setLoading(false);
        }
      }
    }
    
    // Close dropdown after action
    setOpenDropdowns(prev => ({
      ...prev,
      [submission.id]: false
    }));
  };

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMTDSubmissions();
      setSubmissions(data);
    } catch (err) {
      console.error('Failed to refresh submissions:', err);
      setError('Failed to refresh submissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleSettings = () => {
    console.log('Settings clicked');
    // This would typically navigate to settings page
  };

  const handleUpload = (period) => {
    // Navigate to submit page
    navigate('/submit');
  };

  // Icon components
  const RefreshIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M3 21v-5h5"/>
    </svg>
  );

  const WarningIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <path d="M12 9v4"/>
      <circle cx="12" cy="17" r="1"/>
    </svg>
  );

  const PlusIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14"/>
      <path d="M5 12h14"/>
    </svg>
  );

  const SettingsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );

  const ChevronIcon = ({ isOpen }) => (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      className={`chevron-icon ${isOpen ? 'rotated' : ''}`}
    >
      <polyline points="6,9 12,15 18,9"/>
    </svg>
  );

  const ResubmitIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M3 12a9 9 0 0 1 9 9 9.75 9.75 0 0 1 6.74-2.74L21 16"/>
      <path d="M21 21v-5h-5"/>
    </svg>
  );

  const ViewIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

  const DownloadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7,10 12,15 17,10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );

  const DeleteIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  );

  if (loading) {
    return (
      <div className="home-container">
        <div className="home-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#1f2937', fontWeight: 700 }}>
              Loading your MTD dashboard
            </h3>
            <p style={{ margin: 0, color: '#6b7280' }}>
              Preparing your submission status...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-container">
        <div className="home-content">
          <div className="error-container">
            <div className="error-message">
              <div className="error-icon">
                <WarningIcon />
              </div>
              <h3>Unable to load dashboard</h3>
              <p>{error}</p>
              <button onClick={refreshData} className="retry-button">
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-header">
          <button onClick={refreshData} className="refresh-button">
            <RefreshIcon />
            <span>Refresh</span>
          </button>
          
          <div className="header-content">
            <img 
              src="/Quix/Quix-text-(logo).png" 
              alt="Quix Logo" 
              className="quix-logo"
            />
            <p className="dashboard-subtitle">
              Making Tax Digital Compliance Dashboard
            </p>
          </div>

          <div className="header-actions">
            <button 
              onClick={() => handleUpload('new')}
              className="new-submission-button"
            >
              <PlusIcon />
              <span>New Submission</span>
            </button>
            <button onClick={handleSettings} className="settings-icon-button">
              <SettingsIcon />
            </button>
          </div>
        </div>

        <div className="submissions-table-container">
          <table className="submissions-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.period} className="submission-row">
                  <td className="period-cell">
                    <div className="period-info">
                      <span className="period-label">{submission.period}</span>
                      <span className="period-description">
                        {submission.description}
                      </span>
                    </div>
                  </td>
                  
                  <td className="due-date-cell">
                    <div className="due-date">
                      {formatDate(submission.dueDate)}
                    </div>
                  </td>

                  <td className="status-cell">
                    <div className={`status-badge ${getStatusColor(submission.status)}`}>
                      <span className="status-text">{submission.status}</span>
                    </div>
                  </td>

                  <td className="actions-cell">
                    <div className="action-dropdown">
                      <button 
                        className="dropdown-button"
                        onClick={() => handleDropdownToggle(submission.id)}
                      >
                        <span>Actions</span>
                        <ChevronIcon isOpen={openDropdowns[submission.id]} />
                      </button>
                      
                      <div className={`dropdown-content ${openDropdowns[submission.id] ? '' : 'hidden'}`}>
                        <button 
                          className="dropdown-item"
                          onClick={() => handleDropdownAction('resubmit', submission)}
                        >
                          <ResubmitIcon />
                          <span>Resubmit</span>
                        </button>
                        <button 
                          className="dropdown-item"
                          onClick={() => handleDropdownAction('view', submission)}
                        >
                          <ViewIcon />
                          <span>View</span>
                        </button>
                        <button 
                          className="dropdown-item"
                          onClick={() => handleDropdownAction('download', submission)}
                        >
                          <DownloadIcon />
                          <span>Download</span>
                        </button>
                        {(submission.status === 'Uploaded' || submission.status === 'Not Uploaded') && submission.uploadId && (
                          <button 
                            className="dropdown-item delete-item"
                            onClick={() => handleDropdownAction('delete', submission)}
                          >
                            <DeleteIcon />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dashboard-summary">
          <div className="summary-cards">
            <div className="summary-card">
              <h3>Completed</h3>
              <div className="summary-number completed">
                {submissions.filter(s => s.status.toLowerCase() === 'uploaded').length}
              </div>
              <p>Submissions uploaded</p>
            </div>
            
            <div className="summary-card">
              <h3>Pending</h3>
              <div className="summary-number pending">
                {submissions.filter(s => s.status.toLowerCase() === 'pending').length}
              </div>
              <p>Being processed</p>
            </div>
            
            <div className="summary-card">
              <h3>Overdue</h3>
              <div className="summary-number overdue">
                {submissions.filter(s => getDueDateStatus(s.dueDate) === 'overdue').length}
              </div>
              <p>Past deadline</p>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <div className="footer-link">
          <p>
            Love QuixMTD? Check out{' '}
            <a 
              href="https://www.mypropertypal.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="property-pal-link"
            >
              MyPropertyPal
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;