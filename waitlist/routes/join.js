const express = require('express');
const router = express.Router();
const { addToWaitlist, emailExists } = require('../db-connect/dbconnect');

// POST /join - Add user to waitlist
router.post('/join', async (req, res) => {
    try {
        const { firstName, lastName, email, organisationName } = req.body;

        // Basic validation
        if (!firstName || !lastName || !email) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, and email are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Check if email already exists
        const exists = await emailExists(email);
        if (exists) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered on waitlist'
            });
        }

        // Add to waitlist
        const result = await addToWaitlist(firstName, lastName, email, organisationName);

        if (result.success) {
            res.status(201).json({
                success: true,
                message: 'Successfully added to waitlist',
                data: {
                    id: result.data.id,
                    created_at: result.data.created_at
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to add to waitlist',
                error: result.error
            });
        }

    } catch (error) {
        console.error('Error in /join route:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;