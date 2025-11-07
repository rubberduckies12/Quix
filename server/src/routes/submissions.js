const express = require('express');
const router = express.Router();
const SubmissionModel = require('../models/submission.models');

/**
 * POST /api/submissions/save
 * Save a processed submission to the database
 */
router.post('/save', async (req, res) => {
  try {
    console.log('📤 Received save submission request:', {
      submissionType: req.body.submissionType,
      quarter: req.body.quarter,
      hasSubmission: !!req.body.submission,
      hasCategorizedData: !!req.body.categorizedData
    });

    const { submissionData, userId = 1 } = req.body;

    if (!submissionData) {
      return res.status(400).json({
        success: false,
        error: 'Missing submission data'
      });
    }

    // Save to database
    const result = await SubmissionModel.saveSubmission(submissionData, userId);

    res.json({
      success: true,
      data: result,
      message: 'Submission saved successfully'
    });

  } catch (error) {
    console.error('❌ Save submission error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save submission'
    });
  }
});

/**
 * GET /api/submissions/list
 * Get user submissions list
 */
router.get('/list', async (req, res) => {
  try {
    const { userId = 1 } = req.query;
    
    const submissions = await SubmissionModel.getUserSubmissions(userId);

    res.json({
      success: true,
      data: submissions,
      count: submissions.length
    });

  } catch (error) {
    console.error('❌ Get submissions error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch submissions'
    });
  }
});

/**
 * GET /api/submissions/:uploadId
 * Get detailed submission data
 */
router.get('/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    const submissionDetails = await SubmissionModel.getSubmissionDetails(uploadId);

    res.json({
      success: true,
      data: submissionDetails
    });

  } catch (error) {
    console.error('❌ Get submission details error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch submission details'
    });
  }
});

/**
 * PUT /api/submissions/:uploadId/status
 * Update submission status
 */
router.put('/:uploadId/status', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { status } = req.body;

    const validStatuses = ['uploaded', 'submitted_to_hmrc', 'hmrc_accepted', 'hmrc_rejected'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const updatedSubmission = await SubmissionModel.updateSubmissionStatus(uploadId, status);

    res.json({
      success: true,
      data: updatedSubmission,
      message: 'Status updated successfully'
    });

  } catch (error) {
    console.error('❌ Update status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update status'
    });
  }
});

module.exports = router;