const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection configuration
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'quix_waitlist',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    console.log('Connected to PostgreSQL database');
    release();
});

// Function to add user to waitlist
const addToWaitlist = async (firstName, lastName, email, organisationName = null) => {
    const query = `
        INSERT INTO waitlist (first_name, last_name, email, organisation_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
    `;
    
    try {
        const result = await pool.query(query, [firstName, lastName, email, organisationName]);
        return {
            success: true,
            data: result.rows[0]
        };
    } catch (error) {
        console.error('Error adding to waitlist:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Function to get all waitlist entries
const getWaitlist = async () => {
    const query = 'SELECT * FROM waitlist ORDER BY created_at DESC';
    
    try {
        const result = await pool.query(query);
        return {
            success: true,
            data: result.rows
        };
    } catch (error) {
        console.error('Error getting waitlist:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Function to check if email exists
const emailExists = async (email) => {
    const query = 'SELECT id FROM waitlist WHERE email = $1';
    
    try {
        const result = await pool.query(query, [email]);
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking email:', error);
        return false;
    }
};

module.exports = {
    pool,
    addToWaitlist,
    getWaitlist,
    emailExists
};