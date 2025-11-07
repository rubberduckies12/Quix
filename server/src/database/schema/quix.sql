-- Quix MTD Database Schema
-- PostgreSQL Database for Making Tax Digital Platform

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS totals CASCADE;
DROP TABLE IF EXISTS uploads CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

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

-- Create indexes for better performance
CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_tax_year ON uploads(tax_year);
CREATE INDEX idx_uploads_type_quarter ON uploads(type, quarter);
CREATE INDEX idx_totals_upload_id ON totals(upload_id);
CREATE INDEX idx_totals_category ON totals(hmrc_category);

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



