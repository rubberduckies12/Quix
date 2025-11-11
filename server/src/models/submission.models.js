const { pool } = require('../database/utilities/dbconnect');

class SubmissionModel {
  /**
   * Save submission data to database
   * @param {Object} submissionData - The complete submission data
   * @param {number} userId - User ID (temporary hardcoded for now)
   * @returns {Object} Saved submission with upload_id
   */
  static async saveSubmission(submissionData, userId = 1) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Extract data from submission - handle both structures:
      // 1. Structured with metadata object (legacy)
      // 2. Flat structure with metadata at top level (current)
      const {
        metadata,
        submission,
        processingDetails,
        categorization,
        categorizedData,
        // Top-level fields (current structure)
        submissionType: topLevelSubmissionType,
        quarter: topLevelQuarter,
        businessType: topLevelBusinessType,
        taxYear: topLevelTaxYear
      } = submissionData;
      
      // Extract metadata fields - prioritize nested metadata, fallback to top-level
      const submissionType = metadata?.submissionType || topLevelSubmissionType || 'annual';
      const quarter = (metadata?.quarter || topLevelQuarter)?.toLowerCase() || null;
      const businessType = metadata?.businessType || topLevelBusinessType || 'sole_trader';
      const taxYear = metadata?.taxYear || topLevelTaxYear || new Date().getFullYear();
      
      // Determine if this is annual or quarterly based on available data
      // If no quarter is provided, treat as annual submission
      const isAnnual = !quarter || submissionType === 'annual';
      const dbType = isAnnual ? 'annual' : 'quarterly';
      const dbQuarter = isAnnual ? null : quarter;
      
      console.log('📊 Saving submission:', { 
        submissionType, 
        quarter, 
        businessType,
        taxYear,
        isAnnual, 
        dbType, 
        dbQuarter 
      });

      // Calculate totals
      const incomeTotal = submission?.summary?.totalIncome || 0;
      const expenseTotal = submission?.summary?.totalExpenses || 0;
      const profitLoss = submission?.summary?.netProfitLoss || (incomeTotal - expenseTotal);

      // Insert upload record
      const uploadQuery = `
        INSERT INTO uploads (
          user_id, type, quarter, tax_year, 
          income_total, expense_total, profit_loss, status
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING upload_id, created_at
      `;
      
      const uploadParams = [
        userId,
        dbType,
        dbQuarter,
        taxYear,
        incomeTotal,
        expenseTotal,
        profitLoss,
        'uploaded'
      ];

      const uploadResult = await client.query(uploadQuery, uploadParams);
      const uploadId = uploadResult.rows[0].upload_id;

      // Insert totals breakdown
      const totalsData = [];
      
      // Process categorized data for totals
      if (categorizedData?.frontendSummary) {
        categorizedData.frontendSummary.forEach(item => {
          totalsData.push({
            uploadId,
            hmrcCategory: item.category,
            type: item.type, // 'income' or 'expense'
            amount: item.totalAmount
          });
        });
      }

      // Insert totals if we have data
      if (totalsData.length > 0) {
        const totalsQuery = `
          INSERT INTO totals (upload_id, hmrc_category, type, amount)
          VALUES ($1, $2, $3, $4)
        `;

        for (const total of totalsData) {
          await client.query(totalsQuery, [
            total.uploadId,
            total.hmrcCategory,
            total.type,
            total.amount
          ]);
        }
      }

      await client.query('COMMIT');

      console.log(`✅ Submission saved with upload_id: ${uploadId}`);
      
      return {
        uploadId,
        success: true,
        message: 'Submission saved successfully',
        createdAt: uploadResult.rows[0].created_at,
        totalsCount: totalsData.length
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error saving submission:', error);
      throw new Error(`Failed to save submission: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get user submissions
   * @param {number} userId - User ID
   * @returns {Array} List of user submissions
   */
  static async getUserSubmissions(userId = 1) {
    try {
      const query = `
        SELECT 
          u.upload_id,
          u.type,
          u.quarter,
          u.tax_year,
          u.income_total,
          u.expense_total,
          u.profit_loss,
          u.status,
          u.created_at,
          COUNT(t.total_id) as categories_count
        FROM uploads u
        LEFT JOIN totals t ON u.upload_id = t.upload_id
        WHERE u.user_id = $1
        GROUP BY u.upload_id, u.type, u.quarter, u.tax_year, u.income_total, 
                 u.expense_total, u.profit_loss, u.status, u.created_at
        ORDER BY u.created_at DESC
      `;

      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching user submissions:', error);
      throw new Error(`Failed to fetch submissions: ${error.message}`);
    }
  }

  /**
   * Get submission details with totals breakdown
   * @param {number} uploadId - Upload ID
   * @returns {Object} Detailed submission data
   */
  static async getSubmissionDetails(uploadId) {
    try {
      const uploadQuery = `
        SELECT * FROM uploads WHERE upload_id = $1
      `;
      
      const totalsQuery = `
        SELECT * FROM totals WHERE upload_id = $1 ORDER BY hmrc_category
      `;

      const uploadResult = await pool.query(uploadQuery, [uploadId]);
      const totalsResult = await pool.query(totalsQuery, [uploadId]);

      if (uploadResult.rows.length === 0) {
        throw new Error('Submission not found');
      }

      return {
        submission: uploadResult.rows[0],
        totals: totalsResult.rows
      };
    } catch (error) {
      console.error('❌ Error fetching submission details:', error);
      throw new Error(`Failed to fetch submission details: ${error.message}`);
    }
  }

  /**
   * Update submission status
   * @param {number} uploadId - Upload ID
   * @param {string} status - New status
   * @returns {Object} Updated submission
   */
  static async updateSubmissionStatus(uploadId, status) {
    try {
      const query = `
        UPDATE uploads 
        SET status = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE upload_id = $2 
        RETURNING *
      `;

      const result = await pool.query(query, [status, uploadId]);
      
      if (result.rows.length === 0) {
        throw new Error('Submission not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error updating submission status:', error);
      throw new Error(`Failed to update submission status: ${error.message}`);
    }
  }

  /**
   * Delete a submission (only if not submitted to HMRC)
   * @param {number} uploadId - Upload ID
   * @param {number} userId - User ID (for verification)
   * @returns {Object} Deletion result
   */
  static async deleteSubmission(uploadId, userId) {
    try {
      // First check if submission exists and belongs to user
      const checkQuery = `
        SELECT upload_id, status, user_id, type, quarter, tax_year
        FROM uploads 
        WHERE upload_id = $1 AND user_id = $2
      `;
      
      const checkResult = await pool.query(checkQuery, [uploadId, userId]);
      
      if (checkResult.rows.length === 0) {
        throw new Error('Submission not found or does not belong to user');
      }

      const submission = checkResult.rows[0];

      // Prevent deletion if already submitted to HMRC
      if (submission.status === 'submitted_to_hmrc' || 
          submission.status === 'hmrc_accepted' || 
          submission.status === 'hmrc_rejected') {
        throw new Error('Cannot delete submissions that have been submitted to HMRC');
      }

      // Delete the submission (CASCADE will handle related records in totals and submission_logs)
      const deleteQuery = `
        DELETE FROM uploads 
        WHERE upload_id = $1 AND user_id = $2
        RETURNING upload_id, type, quarter, tax_year
      `;

      const result = await pool.query(deleteQuery, [uploadId, userId]);
      
      console.log(`🗑️ Deleted submission: upload_id=${uploadId}, type=${submission.type}, quarter=${submission.quarter}`);

      return {
        success: true,
        deletedSubmission: result.rows[0],
        message: 'Submission deleted successfully'
      };
    } catch (error) {
      console.error('❌ Error deleting submission:', error);
      throw new Error(`Failed to delete submission: ${error.message}`);
    }
  }

  /**
   * Log a submission event (upload or HMRC submission)
   * @param {number} userId - User ID
   * @param {number} uploadId - Upload ID
   * @param {number} taxYear - Tax year
   * @param {string} period - Period (q1, q2, q3, q4, annual)
   * @param {string} action - Action ('uploaded' or 'submitted_to_hmrc')
   * @param {string|null} hmrcResponse - HMRC response (optional)
   * @param {string|null} hmrcSubmissionId - HMRC submission ID (optional)
   * @returns {Object} Created log entry
   */
  static async logSubmission(userId, uploadId, taxYear, period, action, hmrcResponse = null, hmrcSubmissionId = null) {
    try {
      const query = `
        INSERT INTO submission_logs (
          user_id, upload_id, tax_year, period, action, hmrc_response, hmrc_submission_id
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *
      `;
      
      const params = [
        userId,
        uploadId,
        taxYear,
        period,
        action,
        hmrcResponse,
        hmrcSubmissionId
      ];

      const result = await pool.query(query, params);
      
      console.log(`📝 Logged ${action} event for upload_id: ${uploadId}`);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error logging submission:', error);
      throw new Error(`Failed to log submission: ${error.message}`);
    }
  }

  /**
   * Get submission logs for a user
   * @param {number} userId - User ID
   * @param {Object} filters - Optional filters (period, action, taxYear)
   * @returns {Array} List of submission logs
   */
  static async getSubmissionLogs(userId, filters = {}) {
    try {
      let query = `
        SELECT 
          sl.*,
          u.type as upload_type,
          u.quarter as upload_quarter,
          u.income_total,
          u.expense_total,
          u.profit_loss,
          u.status as upload_status
        FROM submission_logs sl
        LEFT JOIN uploads u ON sl.upload_id = u.upload_id
        WHERE sl.user_id = $1
      `;
      
      const params = [userId];
      let paramIndex = 2;

      // Add filters
      if (filters.action) {
        query += ` AND sl.action = $${paramIndex}`;
        params.push(filters.action);
        paramIndex++;
      }

      if (filters.period) {
        query += ` AND sl.period = $${paramIndex}`;
        params.push(filters.period);
        paramIndex++;
      }

      if (filters.taxYear) {
        query += ` AND sl.tax_year = $${paramIndex}`;
        params.push(filters.taxYear);
        paramIndex++;
      }

      query += ` ORDER BY sl.created_at DESC`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching submission logs:', error);
      throw new Error(`Failed to fetch submission logs: ${error.message}`);
    }
  }
}

module.exports = SubmissionModel;