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

    // Check for duplicate submissions
    const submissionType = submissionData.metadata?.submissionType || submissionData.submissionType || 'annual';
    const quarter = (submissionData.metadata?.quarter || submissionData.quarter)?.toLowerCase() || null;
    const taxYear = submissionData.metadata?.taxYear || submissionData.taxYear || new Date().getFullYear();

    // Check if a submission already exists for this period
    const existingSubmissions = await SubmissionModel.getUserSubmissions(userId);
    const duplicateExists = existingSubmissions.some(existing => {
      if (submissionType === 'quarterly') {
        return existing.type === 'quarterly' && 
               existing.quarter === quarter && 
               existing.tax_year === taxYear;
      } else {
        return existing.type === 'annual' && existing.tax_year === taxYear;
      }
    });

    if (duplicateExists) {
      const periodName = submissionType === 'quarterly' ? quarter.toUpperCase() : 'Annual';
      return res.status(409).json({
        success: false,
        error: `A submission for ${periodName} ${taxYear} already exists. Please delete the existing submission first if you want to re-upload.`
      });
    }

    // Save to database
    const result = await SubmissionModel.saveSubmission(submissionData, userId);

    // Log the upload in submission_logs table
    if (result.uploadId) {
      // Check both metadata and top-level properties for backwards compatibility
      const submissionType = submissionData.metadata?.submissionType || submissionData.submissionType || 'annual';
      const quarter = (submissionData.metadata?.quarter || submissionData.quarter)?.toLowerCase() || null;
      const taxYear = submissionData.metadata?.taxYear || submissionData.taxYear || new Date().getFullYear();
      
      // Determine period for logging
      const period = submissionType === 'quarterly' && quarter ? quarter : 'annual';
      
      console.log('🔍 Logging submission with:', {
        submissionType,
        quarter,
        taxYear,
        period,
        uploadId: result.uploadId
      });
      
      await SubmissionModel.logSubmission(
        userId,
        result.uploadId,
        taxYear,
        period,
        'uploaded'
      );

      console.log('✅ Upload logged in submission_logs:', {
        userId,
        uploadId: result.uploadId,
        taxYear,
        period,
        action: 'uploaded'
      });
    } else {
      console.warn('⚠️ No uploadId returned from saveSubmission, cannot log');
    }

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
    const { status, hmrcResponse, hmrcSubmissionId } = req.body;

    const validStatuses = ['uploaded', 'submitted_to_hmrc', 'hmrc_accepted', 'hmrc_rejected'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const updatedSubmission = await SubmissionModel.updateSubmissionStatus(uploadId, status);

    // If status is submitted_to_hmrc, log it in submission_logs
    if (status === 'submitted_to_hmrc' && updatedSubmission) {
      const uploadData = await SubmissionModel.getSubmissionDetails(uploadId);

      if (uploadData && uploadData.submission) {
        const submission = uploadData.submission;
        const submissionType = submission.type; // 'quarterly' or 'annual'
        const quarter = submission.quarter || null;
        
        // Determine period for logging
        const period = submissionType === 'quarterly' && quarter ? quarter : 'annual';

        await SubmissionModel.logSubmission(
          submission.user_id,
          uploadId,
          submission.tax_year,
          period,
          'submitted_to_hmrc',
          hmrcResponse ? JSON.stringify(hmrcResponse) : null,
          hmrcSubmissionId || null
        );

        console.log('✅ HMRC submission logged in submission_logs:', {
          uploadId,
          taxYear: submission.tax_year,
          period,
          hmrcSubmissionId
        });
      }
    }

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

/**
 * DELETE /api/submissions/:uploadId
 * Delete a submission (only if not submitted to HMRC)
 */
router.delete('/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { userId = 1 } = req.query;

    const result = await SubmissionModel.deleteSubmission(parseInt(uploadId), parseInt(userId));

    res.json({
      success: true,
      data: result.deletedSubmission,
      message: result.message
    });

  } catch (error) {
    console.error('❌ Delete submission error:', error);
    
    // Send appropriate status code based on error
    const statusCode = error.message.includes('Cannot delete') ? 403 : 
                       error.message.includes('not found') ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to delete submission'
    });
  }
});

/**
 * GET /api/submissions/logs/:userId
 * Get submission logs for a user
 */
router.get('/logs/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, period, taxYear } = req.query;

    const filters = {};
    if (action) filters.action = action;
    if (period) filters.period = period;
    if (taxYear) filters.taxYear = parseInt(taxYear);

    const logs = await SubmissionModel.getSubmissionLogs(parseInt(userId), filters);

    res.json({
      success: true,
      data: logs,
      count: logs.length
    });

  } catch (error) {
    console.error('❌ Get submission logs error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch submission logs'
    });
  }
});

module.exports = router;