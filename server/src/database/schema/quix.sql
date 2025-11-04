-- Database: Quix MTD System
-- Simple schema for MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Accounts table - basic user info
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Uploads table - file uploads with type and period
CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    upload_type VARCHAR(20) CHECK (upload_type IN ('quarterly', 'annual')) NOT NULL,
    quarter INTEGER CHECK (quarter BETWEEN 1 AND 4), -- NULL for annual uploads
    tax_year INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'uploaded',
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table - stores individual transactions as JSON
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL, -- original row number in Excel file
    transaction_data JSONB NOT NULL, -- complete transaction data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_uploads_account_id ON uploads(account_id);
CREATE INDEX idx_uploads_type_year ON uploads(upload_type, tax_year);
CREATE INDEX idx_transactions_upload_id ON transactions(upload_id);
CREATE INDEX idx_transactions_data ON transactions USING GIN (transaction_data);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to accounts table
CREATE TRIGGER update_accounts_updated_at 
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE accounts IS 'User accounts with basic information';
COMMENT ON TABLE uploads IS 'File uploads with quarterly/annual type and period info';
COMMENT ON TABLE transactions IS 'Individual transactions stored as JSON from uploaded files';