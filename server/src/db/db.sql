-- MTD Tax Bridge - Complete Database Schema
-- For HMRC Making Tax Digital ITSA (Income Tax Self Assessment)
-- Sole Traders & Landlords Only

-- Create database and extensions
CREATE DATABASE mtd_tax_bridge;
\c mtd_tax_bridge;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =====================================================
-- USERS TABLE - Sole Traders & Landlords
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    
    -- Address
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    city VARCHAR(100),
    postcode VARCHAR(8),
    
    -- HMRC Information
    utr VARCHAR(10) UNIQUE NOT NULL,
    ni_number VARCHAR(9),
    
    -- HMRC OAuth 2.0 Integration
    hmrc_access_token TEXT,
    hmrc_refresh_token TEXT,
    hmrc_token_expires TIMESTAMP,
    hmrc_scope VARCHAR(255),
    hmrc_auth_date TIMESTAMP,
    
    -- Self Employment Details
    trading_name VARCHAR(255),
    trade_description VARCHAR(255),
    business_start_date DATE,
    business_address_same_as_home BOOLEAN DEFAULT TRUE,
    business_address TEXT,
    business_postcode VARCHAR(8),
    
    -- Property Rental (if applicable)
    is_landlord BOOLEAN DEFAULT FALSE,
    property_count INTEGER DEFAULT 0,
    
    -- VAT Information (optional)
    is_vat_registered BOOLEAN DEFAULT FALSE,
    vat_number VARCHAR(12),
    vat_scheme VARCHAR(50) CHECK (vat_scheme IN ('standard', 'flat_rate', 'cash_accounting')),
    vat_registration_date DATE,
    flat_rate_percentage DECIMAL(4,2),
    
    -- Tax Settings
    tax_year_start DATE DEFAULT '2024-04-06',
    tax_year_end DATE DEFAULT '2025-04-05',
    accounting_method VARCHAR(20) DEFAULT 'cash' CHECK (accounting_method IN ('cash', 'accruals')),
    
    -- MTD Compliance
    mtd_eligible BOOLEAN DEFAULT TRUE,
    income_threshold_met BOOLEAN DEFAULT FALSE,
    quarterly_reporting_required BOOLEAN DEFAULT TRUE,
    
    -- Preferences
    currency VARCHAR(3) DEFAULT 'GBP',
    timezone VARCHAR(50) DEFAULT 'Europe/London',
    notification_preferences JSONB DEFAULT '{}',
    
    -- System Fields
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SPREADSHEETS TABLE - File Upload Tracking
-- =====================================================
CREATE TABLE spreadsheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- File Information
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    file_hash VARCHAR(64),
    
    -- Processing Status
    status VARCHAR(20) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'queued', 'processing', 'completed', 'failed')),
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    
    -- Content Information
    total_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    
    -- VAT Processing
    vat_enabled BOOLEAN DEFAULT FALSE,
    vat_scheme_used VARCHAR(50),
    
    -- Metadata
    column_mapping JSONB,
    processing_config JSONB,
    error_details JSONB,
    
    -- Tax Period
    tax_year VARCHAR(7),
    period_start DATE,
    period_end DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TRANSACTIONS TABLE - All Financial Data
-- =====================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spreadsheet_id UUID REFERENCES spreadsheets(id) ON DELETE SET NULL,
    
    -- Transaction Details
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference VARCHAR(100),
    supplier_name VARCHAR(255),
    
    -- Financial Information
    gross_amount DECIMAL(12,2) NOT NULL,
    net_amount DECIMAL(12,2),
    vat_amount DECIMAL(12,2) DEFAULT 0,
    vat_rate DECIMAL(4,2) DEFAULT 0,
    
    -- Income/Expense Classification
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    
    -- HMRC Income Categories
    income_category VARCHAR(50) CHECK (income_category IN (
        'self_employment_income',
        'property_rental_income',
        'other_business_income',
        'dividend_income',
        'interest_income'
    )),
    
    -- HMRC Allowable Expense Categories
    expense_category VARCHAR(50) CHECK (expense_category IN (
        'office_costs',                 -- Office, property and equipment
        'car_van_travel',              -- Car, van and travel costs
        'clothing',                    -- Clothing (uniforms, protective)
        'staff_costs',                 -- Staff costs, employees, subcontractors
        'things_to_resell',            -- Cost of goods sold
        'legal_financial_costs',       -- Legal and financial costs
        'marketing_hospitality',       -- Marketing, entertainment, hospitality
        'training_courses',            -- Training courses, trade publications
        'insurance',                   -- Business insurance
        'repairs_maintenance',         -- Repairs and maintenance
        'rent_rates',                  -- Rent, rates, power
        'phone_internet',              -- Phone, fax, stationery, internet
        'professional_fees',           -- Accountant, solicitor fees
        'bank_charges',                -- Bank charges
        'other_business_expenses'      -- Other allowable business expenses
    )),
    
    -- Property Specific Categories
    property_expense_category VARCHAR(50) CHECK (property_expense_category IN (
        'letting_agent_fees',
        'legal_management_costs',
        'maintenance_repairs',
        'insurance',
        'mortgage_interest',
        'rent_ground_rent',
        'council_tax',
        'utilities',
        'safety_certificates',
        'other_property_expenses'
    )),
    
    -- AI Categorization Results
    ai_category VARCHAR(100),
    ai_confidence DECIMAL(4,3),
    ai_suggestions JSONB,
    ai_processed_at TIMESTAMP,
    
    -- User Verification
    user_verified BOOLEAN DEFAULT FALSE,
    user_category_override VARCHAR(100),
    verification_date TIMESTAMP,
    user_notes TEXT,
    
    -- Tax Information
    tax_year VARCHAR(7) NOT NULL,
    quarter VARCHAR(2),
    is_allowable_expense BOOLEAN,
    personal_use_percentage DECIMAL(4,2),
    
    -- Capital Allowances
    is_capital_expenditure BOOLEAN DEFAULT FALSE,
    annual_investment_allowance BOOLEAN DEFAULT FALSE,
    capital_allowance_rate DECIMAL(4,2),
    
    -- Source Information
    source_row INTEGER,
    source_sheet VARCHAR(100),
    original_data JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: Only one category type can be set
    CONSTRAINT check_single_category CHECK (
        (income_category IS NOT NULL)::integer + 
        (expense_category IS NOT NULL)::integer + 
        (property_expense_category IS NOT NULL)::integer <= 1
    )
);

-- =====================================================
-- HMRC SUBMISSIONS TABLE - Quarterly & Annual Returns
-- =====================================================
CREATE TABLE hmrc_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Submission Details
    submission_type VARCHAR(20) NOT NULL CHECK (submission_type IN ('quarterly', 'annual')),
    tax_year VARCHAR(7) NOT NULL,
    period_key VARCHAR(50),
    quarter VARCHAR(2),
    
    -- HMRC Submission Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'submitted', 'accepted', 'rejected')),
    hmrc_submission_id VARCHAR(50),
    hmrc_receipt_id VARCHAR(50),
    submission_date TIMESTAMP,
    acknowledgment_date TIMESTAMP,
    
    -- Self Employment Summary
    total_self_employment_income DECIMAL(12,2) DEFAULT 0,
    total_allowable_expenses DECIMAL(12,2) DEFAULT 0,
    net_self_employment_profit DECIMAL(12,2) DEFAULT 0,
    
    -- Property Summary (if landlord)
    total_property_income DECIMAL(12,2) DEFAULT 0,
    total_property_expenses DECIMAL(12,2) DEFAULT 0,
    net_property_profit DECIMAL(12,2) DEFAULT 0,
    
    -- Overall Summary
    total_income DECIMAL(12,2) DEFAULT 0,
    total_expenses DECIMAL(12,2) DEFAULT 0,
    total_profit DECIMAL(12,2) DEFAULT 0,
    
    -- Class 4 National Insurance (annual only)
    class_4_nic_due DECIMAL(12,2) DEFAULT 0,
    
    -- VAT Summary (if applicable)
    total_vat_due DECIMAL(12,2) DEFAULT 0,
    vat_reclaimed DECIMAL(12,2) DEFAULT 0,
    net_vat_due DECIMAL(12,2) DEFAULT 0,
    
    -- HMRC API Data
    submission_payload JSONB NOT NULL,
    hmrc_response JSONB,
    validation_errors JSONB,
    
    -- Deadlines
    filing_deadline DATE,
    payment_deadline DATE,
    
    -- Software Info
    software_id VARCHAR(50) DEFAULT 'MTD-TAX-BRIDGE',
    software_version VARCHAR(20),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PROCESSING JOBS TABLE - Background Job Tracking
-- =====================================================
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spreadsheet_id UUID REFERENCES spreadsheets(id) ON DELETE CASCADE,
    
    -- Job Details
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN (
        'parse_spreadsheet',
        'categorize_transactions', 
        'generate_quarterly_submission',
        'generate_annual_submission',
        'submit_to_hmrc'
    )),
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 5,
    
    -- Progress Tracking
    total_items INTEGER,
    processed_items INTEGER DEFAULT 0,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Job Configuration
    job_config JSONB,
    vat_enabled BOOLEAN DEFAULT FALSE,
    
    -- Results
    result_data JSONB,
    error_message TEXT,
    error_details JSONB,
    
    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_completion TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AUDIT LOG TABLE - Compliance & Security
-- =====================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Action Details
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    
    -- HMRC Specific
    hmrc_correlation_id VARCHAR(255),
    submission_reference VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_utr ON users(utr);
CREATE INDEX idx_users_ni_number ON users(ni_number);
CREATE INDEX idx_users_hmrc_tokens ON users(hmrc_access_token) WHERE hmrc_access_token IS NOT NULL;

-- Spreadsheets
CREATE INDEX idx_spreadsheets_user_id ON spreadsheets(user_id);
CREATE INDEX idx_spreadsheets_status ON spreadsheets(status);
CREATE INDEX idx_spreadsheets_tax_year ON spreadsheets(tax_year);

-- Transactions
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_spreadsheet_id ON transactions(spreadsheet_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_tax_year ON transactions(tax_year);
CREATE INDEX idx_transactions_quarter ON transactions(quarter);
CREATE INDEX idx_transactions_verified ON transactions(user_verified);
CREATE INDEX idx_transactions_income_cat ON transactions(income_category);
CREATE INDEX idx_transactions_expense_cat ON transactions(expense_category);
CREATE INDEX idx_transactions_property_cat ON transactions(property_expense_category);
CREATE INDEX idx_transactions_description_search ON transactions USING gin(to_tsvector('english', description));

-- HMRC Submissions
CREATE INDEX idx_submissions_user_id ON hmrc_submissions(user_id);
CREATE INDEX idx_submissions_type ON hmrc_submissions(submission_type);
CREATE INDEX idx_submissions_tax_year ON hmrc_submissions(tax_year);
CREATE INDEX idx_submissions_status ON hmrc_submissions(status);
CREATE INDEX idx_submissions_period_key ON hmrc_submissions(period_key);

-- Processing Jobs
CREATE INDEX idx_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX idx_jobs_status ON processing_jobs(status);
CREATE INDEX idx_jobs_type ON processing_jobs(job_type);
CREATE INDEX idx_jobs_created_at ON processing_jobs(created_at);

-- Audit Logs
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATES
-- =====================================================

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_spreadsheets_updated_at BEFORE UPDATE ON spreadsheets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_submissions_updated_at BEFORE UPDATE ON hmrc_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_jobs_updated_at BEFORE UPDATE ON processing_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- HMRC expense categories reference data
CREATE TABLE hmrc_categories (
    id SERIAL PRIMARY KEY,
    category_code VARCHAR(50) UNIQUE NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    description TEXT,
    applies_to VARCHAR(50) CHECK (applies_to IN ('self_employment', 'property', 'both')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert HMRC categories
INSERT INTO hmrc_categories (category_code, category_name, description, applies_to) VALUES
('office_costs', 'Office, property and equipment costs', 'Office rent, business rates, equipment', 'self_employment'),
('car_van_travel', 'Car, van and travel costs', 'Fuel, insurance, repairs, hotel stays', 'self_employment'),
('clothing', 'Clothing', 'Uniforms, protective clothing', 'self_employment'),
('staff_costs', 'Staff costs', 'Employee wages, subcontractor payments', 'self_employment'),
('things_to_resell', 'Cost of goods sold', 'Raw materials, stock, goods for resale', 'self_employment'),
('legal_financial_costs', 'Legal and financial costs', 'Solicitor fees, accountant fees, bank charges', 'both'),
('marketing_hospitality', 'Marketing and hospitality', 'Advertising, business entertainment', 'self_employment'),
('training_courses', 'Training courses', 'Training, trade publications', 'self_employment'),
('insurance', 'Insurance', 'Business insurance, professional indemnity', 'both'),
('letting_agent_fees', 'Letting agent fees', 'Property management fees', 'property'),
('maintenance_repairs', 'Maintenance and repairs', 'Property maintenance, repairs', 'property'),
('mortgage_interest', 'Mortgage interest', 'Interest on property mortgages', 'property');

COMMIT;