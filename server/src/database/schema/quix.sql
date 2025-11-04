-- Database: Making Tax Digital (MTD) Compliance System
-- Created: November 2025

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Accounts table - user registration and business info
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    business_type VARCHAR(20) CHECK (business_type IN ('sole_trader', 'landlord')) NOT NULL,
    utr VARCHAR(10), -- Unique Taxpayer Reference
    ni_number VARCHAR(9), -- National Insurance Number
    vat_registered BOOLEAN DEFAULT FALSE,
    vat_number VARCHAR(12), -- VAT registration number
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File uploads table - track all uploaded Excel files
CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL, -- file size in bytes
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')) DEFAULT 'uploaded',
    submission_type VARCHAR(20) CHECK (submission_type IN ('quarterly', 'annual')) NOT NULL,
    tax_year INTEGER NOT NULL,
    quarter INTEGER CHECK (quarter BETWEEN 1 AND 4), -- NULL for annual submissions
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    transaction_data JSONB, -- stores all parsed & categorized transactions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Upload processing status tracking
CREATE TABLE upload_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    step VARCHAR(30) CHECK (step IN ('parsing', 'categorizing', 'validating', 'complete')) NOT NULL,
    progress_percentage INTEGER CHECK (progress_percentage BETWEEN 0 AND 100) DEFAULT 0,
    error_details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HMRC submissions table
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    submission_type VARCHAR(20) CHECK (submission_type IN ('quarterly', 'annual')) NOT NULL,
    tax_year INTEGER NOT NULL,
    quarter INTEGER CHECK (quarter BETWEEN 1 AND 4), -- NULL for annual submissions
    status VARCHAR(20) CHECK (status IN ('draft', 'ready', 'submitted', 'accepted', 'rejected')) DEFAULT 'draft',
    submission_data JSONB, -- HMRC-formatted submission data
    categorized_totals JSONB, -- income/expense totals by category
    hmrc_reference VARCHAR(50), -- HMRC acknowledgment reference
    submission_date TIMESTAMP WITH TIME ZONE,
    acknowledgment_date TIMESTAMP WITH TIME ZONE,
    total_income DECIMAL(12,2) DEFAULT 0.00,
    total_expenses DECIMAL(12,2) DEFAULT 0.00,
    net_profit DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Submission status history
CREATE TABLE submission_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    status_change VARCHAR(20) NOT NULL,
    hmrc_response JSONB,
    error_message TEXT,
    user_action TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tax period tracking and deadlines
CREATE TABLE tax_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tax_year INTEGER NOT NULL,
    quarter INTEGER CHECK (quarter BETWEEN 1 AND 4), -- NULL for annual periods
    deadline_date DATE NOT NULL,
    is_complete BOOLEAN DEFAULT FALSE,
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    period_summary JSONB, -- income/expense summary for period
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id, tax_year, quarter)
);

-- User corrections and overrides
CREATE TABLE manual_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    transaction_index INTEGER NOT NULL, -- row index in the original file
    original_category VARCHAR(100),
    corrected_category VARCHAR(100) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log for compliance and tracking
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_uploads_account_id ON uploads(account_id);
CREATE INDEX idx_uploads_status ON uploads(status);
CREATE INDEX idx_uploads_tax_year_quarter ON uploads(tax_year, quarter);

CREATE INDEX idx_upload_status_upload_id ON upload_status(upload_id);
CREATE INDEX idx_upload_status_timestamp ON upload_status(timestamp);

CREATE INDEX idx_submissions_account_id ON submissions(account_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_tax_year_quarter ON submissions(tax_year, quarter);
CREATE INDEX idx_submissions_submission_date ON submissions(submission_date);

CREATE INDEX idx_submission_history_submission_id ON submission_history(submission_id);
CREATE INDEX idx_submission_history_timestamp ON submission_history(timestamp);

CREATE INDEX idx_tax_periods_account_id ON tax_periods(account_id);
CREATE INDEX idx_tax_periods_deadline ON tax_periods(deadline_date);
CREATE INDEX idx_tax_periods_tax_year ON tax_periods(tax_year);

CREATE INDEX idx_manual_corrections_account_id ON manual_corrections(account_id);
CREATE INDEX idx_manual_corrections_upload_id ON manual_corrections(upload_id);

CREATE INDEX idx_audit_log_account_id ON audit_log(account_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_uploads_updated_at BEFORE UPDATE ON uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_periods_updated_at BEFORE UPDATE ON tax_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default tax periods function
CREATE OR REPLACE FUNCTION create_default_tax_periods(p_account_id UUID, p_tax_year INTEGER)
RETURNS VOID AS $$
BEGIN
    -- Create quarterly periods for the tax year
    INSERT INTO tax_periods (account_id, tax_year, quarter, deadline_date) VALUES
    (p_account_id, p_tax_year, 1, DATE(p_tax_year || '-07-05')), -- Q1: Apr-Jun, due July 5
    (p_account_id, p_tax_year, 2, DATE(p_tax_year || '-10-05')), -- Q2: Jul-Sep, due Oct 5
    (p_account_id, p_tax_year, 3, DATE((p_tax_year + 1) || '-01-05')), -- Q3: Oct-Dec, due Jan 5
    (p_account_id, p_tax_year, 4, DATE((p_tax_year + 1) || '-04-05')); -- Q4: Jan-Mar, due Apr 5
    
    -- Create annual period
    INSERT INTO tax_periods (account_id, tax_year, quarter, deadline_date) VALUES
    (p_account_id, p_tax_year, NULL, DATE((p_tax_year + 2) || '-01-31')); -- Annual: due Jan 31 (next year + 1)
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default tax periods for new accounts
CREATE OR REPLACE FUNCTION create_account_tax_periods()
RETURNS TRIGGER AS $$
BEGIN
    -- Create tax periods for current and next tax year
    PERFORM create_default_tax_periods(NEW.id, EXTRACT(YEAR FROM NOW())::INTEGER);
    PERFORM create_default_tax_periods(NEW.id, EXTRACT(YEAR FROM NOW())::INTEGER + 1);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_account_tax_periods
    AFTER INSERT ON accounts
    FOR EACH ROW EXECUTE FUNCTION create_account_tax_periods();



-- Comments for documentation
COMMENT ON TABLE accounts IS 'User accounts with business information for MTD compliance';
COMMENT ON TABLE uploads IS 'File uploads with processing status and transaction data';
COMMENT ON TABLE upload_status IS 'Detailed tracking of file processing steps';
COMMENT ON TABLE submissions IS 'HMRC submissions with status and financial totals';
COMMENT ON TABLE submission_history IS 'Audit trail of submission status changes';
COMMENT ON TABLE tax_periods IS 'Tax period deadlines and completion tracking';
COMMENT ON TABLE manual_corrections IS 'User corrections to automated categorization';
COMMENT ON TABLE audit_log IS 'System audit trail for compliance and debugging';

-- View for dashboard summary
CREATE VIEW dashboard_summary AS
SELECT 
    a.id as account_id,
    a.first_name,
    a.last_name,
    a.business_type,
    a.vat_registered,
    COUNT(DISTINCT s.id) as total_submissions,
    COUNT(DISTINCT CASE WHEN s.status = 'submitted' THEN s.id END) as submitted_count,
    COUNT(DISTINCT CASE WHEN s.status = 'accepted' THEN s.id END) as accepted_count,
    COUNT(DISTINCT CASE WHEN tp.deadline_date < NOW() AND NOT tp.is_complete THEN tp.id END) as overdue_periods,
    COUNT(DISTINCT CASE WHEN tp.deadline_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND NOT tp.is_complete THEN tp.id END) as upcoming_deadlines
FROM accounts a
LEFT JOIN submissions s ON a.id = s.account_id
LEFT JOIN tax_periods tp ON a.id = tp.account_id
GROUP BY a.id, a.first_name, a.last_name, a.business_type, a.vat_registered;

COMMENT ON VIEW dashboard_summary IS 'Dashboard overview with submission counts and deadline tracking';