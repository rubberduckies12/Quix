-- Quix MTD Database Schema
-- PostgreSQL Database for Making Tax Digital Platform
-- Create accounts table
CREATE TABLE accounts (
    account_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    ni_number_hash VARCHAR(255), -- Optional, for future HMRC integration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create uploads table
CREATE TABLE uploads (
    upload_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('quarterly', 'annual')),
    quarter VARCHAR(2) CHECK (quarter IN ('q1', 'q2', 'q3', 'q4')), -- Only for quarterly
    done_on_different_system BOOLEAN DEFAULT FALSE,
    tax_year INTEGER NOT NULL,
    income_total DECIMAL(12,2) DEFAULT 0.00,
    expense_total DECIMAL(12,2) DEFAULT 0.00,
    profit_loss DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'submitted_to_hmrc', 'hmrc_accepted', 'hmrc_rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create totals table (breakdown by HMRC categories)
CREATE TABLE totals (
    total_id SERIAL PRIMARY KEY,
    upload_id INTEGER NOT NULL REFERENCES uploads(upload_id) ON DELETE CASCADE,
    hmrc_category VARCHAR(50) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create submission_logs table to track uploads and HMRC submissions
CREATE TABLE submission_logs (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    upload_id INTEGER REFERENCES uploads(upload_id) ON DELETE CASCADE,
    tax_year INTEGER NOT NULL,
    period VARCHAR(10) NOT NULL CHECK (period IN ('q1', 'q2', 'q3', 'q4', 'annual')),
    action VARCHAR(20) NOT NULL CHECK (action IN ('uploaded', 'submitted_to_hmrc')),
    hmrc_response TEXT, -- Store HMRC response if submitted
    hmrc_submission_id VARCHAR(100), -- HMRC reference number
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_tax_year ON uploads(tax_year);
CREATE INDEX idx_uploads_type_quarter ON uploads(type, quarter);
CREATE INDEX idx_totals_upload_id ON totals(upload_id);
CREATE INDEX idx_totals_category ON totals(hmrc_category);
CREATE INDEX idx_submission_logs_user_id ON submission_logs(user_id);
CREATE INDEX idx_submission_logs_upload_id ON submission_logs(upload_id);
CREATE INDEX idx_submission_logs_tax_year ON submission_logs(tax_year);
CREATE INDEX idx_submission_logs_period ON submission_logs(period);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_uploads_updated_at BEFORE UPDATE ON uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE uploads ADD CONSTRAINT check_quarterly_has_quarter
    CHECK (type != 'quarterly' OR quarter IS NOT NULL);

ALTER TABLE uploads ADD CONSTRAINT check_annual_no_quarter
    CHECK (type != 'annual' OR quarter IS NULL);



