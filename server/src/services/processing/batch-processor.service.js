const Queue = require('bull');
const Redis = require('ioredis');
const EventEmitter = require('events');
const cron = require('node-cron');
const crypto = require('crypto');

/**
 * Comprehensive Batch Processor Service for MTD Tax Bridge Application
 * Handles large-scale data processing, AI categorization, HMRC submissions, and scheduled tasks
 */
class BatchProcessorService extends EventEmitter {
  constructor(logger, cacheService, redisConfig) {
    super();
    this.logger = logger;
    this.cache = cacheService;
    
    // Redis connection for Bull queues
    this.redis = new Redis(redisConfig);
    
    // Queue management
    this.queues = {};
    this.workers = {};
    this.scheduledJobs = new Map();
    
    // Performance monitoring
    this.metrics = {
      processed: 0,
      failed: 0,
      avgProcessingTime: 0,
      queueDepth: 0,
      activeWorkers: 0,
      lastReset: Date.now()
    };
    
    // Configuration
    this.config = {
      defaultConcurrency: 5,
      maxRetries: 3,
      backoffDelay: 5000,
      chunkSize: 1000,
      maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
      circuitBreakerThreshold: 10,
      progressUpdateInterval: 5000,
      workerScaling: {
        minWorkers: 2,
        maxWorkers: 10,
        scaleUpThreshold: 100,
        scaleDownThreshold: 10
      }
    };
    
    // Circuit breaker state
    this.circuitBreaker = {
      failures: 0,
      lastFailure: null,
      state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
    };
    
    this._initializeQueues();
    this._setupHealthMonitoring();
  }

  // ====== CORE BATCH PROCESSING FRAMEWORK ======

  /**
   * Main batch processing orchestrator
   */
  async processBatch(jobType, data, options = {}) {
    const jobId = this._generateJobId(jobType);
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting batch processing for ${jobType}`, { jobId, dataSize: data.length });
      
      // Initialize progress tracking
      await this.trackBatchProgress(jobId, { status: 'starting', processed: 0, total: data.length });
      
      // Chunk the data
      const chunks = this.chunkData(data, options.chunkSize || this.config.chunkSize);
      
      let results;
      if (options.parallel) {
        results = await this.processChunksParallel(chunks, options.processor, options.concurrency);
      } else {
        results = await this.processChunksSequentially(chunks, options.processor, jobId);
      }
      
      const processingTime = Date.now() - startTime;
      await this.trackBatchProgress(jobId, { 
        status: 'completed', 
        processed: data.length, 
        total: data.length,
        processingTime 
      });
      
      this._updateMetrics(data.length, 0, processingTime);
      
      return {
        jobId,
        success: true,
        totalProcessed: data.length,
        processingTime,
        results
      };
      
    } catch (error) {
      await this.trackBatchProgress(jobId, { status: 'failed', error: error.message });
      this._updateMetrics(0, 1, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Split large datasets into manageable chunks
   */
  chunkData(dataset, chunkSize = this.config.chunkSize) {
    if (!Array.isArray(dataset)) {
      throw new Error('Dataset must be an array');
    }
    
    const chunks = [];
    for (let i = 0; i < dataset.length; i += chunkSize) {
      chunks.push({
        id: Math.floor(i / chunkSize),
        data: dataset.slice(i, i + chunkSize),
        startIndex: i,
        endIndex: Math.min(i + chunkSize - 1, dataset.length - 1)
      });
    }
    
    this.logger.debug(`Data chunked into ${chunks.length} chunks of max size ${chunkSize}`);
    return chunks;
  }

  /**
   * Process chunks sequentially with state management
   */
  async processChunksSequentially(chunks, processor, jobId) {
    const results = [];
    const checkpointInterval = 10; // Checkpoint every 10 chunks
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const result = await this._processChunkWithCircuitBreaker(chunk, processor);
        results.push(result);
        
        // Update progress
        if (jobId) {
          await this.trackBatchProgress(jobId, {
            status: 'processing',
            processed: (i + 1) * chunk.data.length,
            total: chunks.length * chunk.data.length,
            currentChunk: i + 1,
            totalChunks: chunks.length
          });
        }
        
        // Create checkpoint
        if (i % checkpointInterval === 0) {
          await this._createCheckpoint(jobId, i, results);
        }
        
      } catch (error) {
        this.logger.error(`Chunk ${chunk.id} failed:`, error);
        
        const failureResult = await this.handleBatchFailures([chunk], {
          maxRetries: this.config.maxRetries,
          processor
        });
        
        results.push(failureResult);
      }
    }
    
    return results;
  }

  /**
   * Process chunks in parallel with concurrency limits
   */
  async processChunksParallel(chunks, processor, concurrency = this.config.defaultConcurrency) {
    const results = [];
    const activePromises = new Set();
    let chunkIndex = 0;
    
    const processNextChunk = async () => {
      if (chunkIndex >= chunks.length) return;
      
      const chunk = chunks[chunkIndex++];
      
      try {
        const result = await this._processChunkWithCircuitBreaker(chunk, processor);
        results[chunk.id] = result;
      } catch (error) {
        this.logger.error(`Parallel chunk ${chunk.id} failed:`, error);
        results[chunk.id] = { success: false, error: error.message };
      }
    };
    
    // Start initial batch of concurrent processes
    for (let i = 0; i < Math.min(concurrency, chunks.length); i++) {
      const promise = processNextChunk();
      activePromises.add(promise);
      
      promise.finally(() => {
        activePromises.delete(promise);
        if (chunkIndex < chunks.length) {
          const nextPromise = processNextChunk();
          activePromises.add(nextPromise);
        }
      });
    }
    
    // Wait for all chunks to complete
    while (activePromises.size > 0 || chunkIndex < chunks.length) {
      await Promise.race(activePromises);
    }
    
    return results;
  }

  /**
   * Real-time progress tracking and updates
   */
  async trackBatchProgress(jobId, progress) {
    const progressData = {
      jobId,
      timestamp: new Date().toISOString(),
      ...progress
    };
    
    // Store in cache for real-time access
    await this.cache.set(`progress:${jobId}`, progressData, 3600);
    
    // Emit for WebSocket updates
    this.emit('progressUpdate', progressData);
    
    this.logger.debug(`Progress update for ${jobId}:`, progress);
  }

  /**
   * Robust failure handling and recovery
   */
  async handleBatchFailures(failedChunks, retryOptions = {}) {
    const maxRetries = retryOptions.maxRetries || this.config.maxRetries;
    const backoffDelay = retryOptions.backoffDelay || this.config.backoffDelay;
    
    const retryResults = [];
    
    for (const chunk of failedChunks) {
      let retryCount = 0;
      let success = false;
      let lastError;
      
      while (retryCount < maxRetries && !success) {
        try {
          // Exponential backoff
          if (retryCount > 0) {
            const delay = backoffDelay * Math.pow(2, retryCount - 1);
            await this._sleep(delay);
          }
          
          const result = await retryOptions.processor(chunk.data);
          retryResults.push({ chunkId: chunk.id, success: true, result, retryCount });
          success = true;
          
        } catch (error) {
          lastError = error;
          retryCount++;
          this.logger.warn(`Retry ${retryCount}/${maxRetries} failed for chunk ${chunk.id}:`, error);
        }
      }
      
      if (!success) {
        retryResults.push({ 
          chunkId: chunk.id, 
          success: false, 
          error: lastError.message, 
          retryCount: maxRetries 
        });
        
        // Quarantine problematic data
        await this.quarantineProblematicData([chunk], `Failed after ${maxRetries} retries: ${lastError.message}`);
      }
    }
    
    return retryResults;
  }

  // ====== JOB QUEUE MANAGEMENT (REDIS BULL) ======

  /**
   * Queue jobs with priority, delay, and retry settings
   */
  async createJob(jobType, data, options = {}) {
    const queue = this._getQueue(jobType);
    
    const jobOptions = {
      priority: options.priority || 0,
      delay: options.delay || 0,
      attempts: options.attempts || this.config.maxRetries,
      backoff: {
        type: 'exponential',
        delay: this.config.backoffDelay
      },
      removeOnComplete: options.removeOnComplete || 100,
      removeOnFail: options.removeOnFail || 50,
      ...options.bullOptions
    };
    
    const job = await queue.add(jobType, data, jobOptions);
    
    this.logger.info(`Job created: ${jobType}`, { jobId: job.id, priority: jobOptions.priority });
    
    return {
      jobId: job.id,
      jobType,
      status: 'queued',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Execute queued jobs with comprehensive error handling
   */
  async processJob(jobId, processor) {
    try {
      const startTime = Date.now();
      
      // Execute processor
      const result = await processor();
      
      const processingTime = Date.now() - startTime;
      this._updateMetrics(1, 0, processingTime);
      
      return {
        success: true,
        result,
        processingTime
      };
      
    } catch (error) {
      this._updateMetrics(0, 1, 0);
      this._handleCircuitBreaker(error);
      
      throw error;
    }
  }

  /**
   * Dynamic job prioritization based on business rules
   */
  async manageJobPriorities(jobs, priorityRules) {
    const prioritizedJobs = jobs.map(job => {
      let priority = job.priority || 0;
      
      // Apply business rules
      if (priorityRules.deadline && job.deadline) {
        const timeToDeadline = new Date(job.deadline) - new Date();
        if (timeToDeadline < 24 * 60 * 60 * 1000) { // Less than 24 hours
          priority += 100;
        }
      }
      
      if (priorityRules.userType && job.userType === 'premium') {
        priority += 50;
      }
      
      if (priorityRules.dataSize && job.dataSize > 10000) {
        priority += 20;
      }
      
      return { ...job, priority };
    });
    
    return prioritizedJobs.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Schedule recurring jobs with cron-like scheduling
   */
  scheduleRecurringJobs(schedule, jobDefinition) {
    const jobId = `recurring_${jobDefinition.type}_${Date.now()}`;
    
    const task = cron.schedule(schedule, async () => {
      try {
        this.logger.info(`Executing recurring job: ${jobDefinition.type}`);
        
        await this.createJob(jobDefinition.type, jobDefinition.data, {
          priority: jobDefinition.priority || 0
        });
        
      } catch (error) {
        this.logger.error(`Recurring job failed: ${jobDefinition.type}`, error);
      }
    }, {
      scheduled: false
    });
    
    this.scheduledJobs.set(jobId, {
      task,
      schedule,
      definition: jobDefinition,
      createdAt: new Date()
    });
    
    task.start();
    
    this.logger.info(`Recurring job scheduled: ${jobDefinition.type}`, { schedule, jobId });
    
    return jobId;
  }

  /**
   * Monitor queue health and metrics
   */
  async monitorQueueHealth() {
    const health = {};
    
    for (const [queueName, queue] of Object.entries(this.queues)) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      
      health[queueName] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        throughput: this._calculateThroughput(queueName),
        avgProcessingTime: this.metrics.avgProcessingTime
      };
    }
    
    // Auto-scale workers based on queue depth
    for (const [queueName, metrics] of Object.entries(health)) {
      await this.scaleWorkers(queueName, metrics.waiting, metrics.active);
    }
    
    return health;
  }

  /**
   * Automatic worker scaling based on demand
   */
  async scaleWorkers(queueName, queueDepth, activeJobs) {
    const queue = this.queues[queueName];
    if (!queue) return;
    
    const currentWorkers = this.workers[queueName] || this.config.workerScaling.minWorkers;
    let targetWorkers = currentWorkers;
    
    // Scale up if queue is backing up
    if (queueDepth > this.config.workerScaling.scaleUpThreshold) {
      targetWorkers = Math.min(
        currentWorkers + 2,
        this.config.workerScaling.maxWorkers
      );
    }
    
    // Scale down if queue is light
    if (queueDepth < this.config.workerScaling.scaleDownThreshold && activeJobs === 0) {
      targetWorkers = Math.max(
        currentWorkers - 1,
        this.config.workerScaling.minWorkers
      );
    }
    
    if (targetWorkers !== currentWorkers) {
      this.workers[queueName] = targetWorkers;
      
      // Update queue concurrency
      queue.concurrency = targetWorkers;
      
      this.logger.info(`Scaled workers for ${queueName}: ${currentWorkers} -> ${targetWorkers}`);
    }
  }

  // ====== LARGE FILE PROCESSING ======

  /**
   * Stream process large Excel/CSV files
   */
  async processLargeSpreadsheet(fileId, chunkSize = 1000) {
    const jobId = this._generateJobId('file_processing');
    
    try {
      // Get file metadata
      const fileInfo = await this.cache.get(`file:${fileId}`);
      if (!fileInfo) {
        throw new Error(`File not found: ${fileId}`);
      }
      
      await this.trackBatchProgress(jobId, { 
        status: 'starting', 
        fileId, 
        fileName: fileInfo.fileName 
      });
      
      // Process file in chunks using streaming
      const processor = async (chunk) => {
        // This would integrate with your spreadsheet parser
        return await this._processSpreadsheetChunk(chunk, fileInfo);
      };
      
      const result = await this.parseSpreadsheetInChunks(fileInfo.filePath, chunkSize, processor);
      
      await this.trackBatchProgress(jobId, { 
        status: 'completed', 
        processed: result.totalRows,
        results: result
      });
      
      return result;
      
    } catch (error) {
      await this.trackBatchProgress(jobId, { status: 'failed', error: error.message });
      throw error;
    }
  }

  /**
   * Chunk-based spreadsheet parsing with progress tracking
   */
  async parseSpreadsheetInChunks(filePath, rowsPerChunk, processor) {
    const results = {
      totalRows: 0,
      processedRows: 0,
      errors: [],
      transactions: []
    };
    
    // This is a simplified implementation - would integrate with actual spreadsheet parser
    const chunks = await this._createFileChunks(filePath, rowsPerChunk);
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunkResult = await processor(chunks[i]);
        
        results.processedRows += chunkResult.rowCount;
        results.transactions.push(...chunkResult.transactions);
        
        // Memory management - cache processed chunks
        await this.cache.set(`chunk:${filePath}:${i}`, chunkResult, 3600);
        
      } catch (error) {
        results.errors.push({
          chunkIndex: i,
          error: error.message
        });
      }
    }
    
    results.totalRows = results.processedRows;
    return results;
  }

  /**
   * Bulk data validation with error aggregation
   */
  async validateDataInBatches(transactions, validationRules, batchSize = 1000) {
    const chunks = this.chunkData(transactions, batchSize);
    const validationResults = {
      valid: [],
      invalid: [],
      errors: []
    };
    
    const validateChunk = async (chunk) => {
      const chunkResults = { valid: [], invalid: [], errors: [] };
      
      for (const transaction of chunk.data) {
        try {
          const isValid = await this._validateTransaction(transaction, validationRules);
          
          if (isValid.success) {
            chunkResults.valid.push(transaction);
          } else {
            chunkResults.invalid.push({
              transaction,
              errors: isValid.errors
            });
          }
        } catch (error) {
          chunkResults.errors.push({
            transaction,
            error: error.message
          });
        }
      }
      
      return chunkResults;
    };
    
    const results = await this.processChunksParallel(chunks, validateChunk, 3);
    
    // Aggregate results
    results.forEach(result => {
      validationResults.valid.push(...result.valid);
      validationResults.invalid.push(...result.invalid);
      validationResults.errors.push(...result.errors);
    });
    
    return validationResults;
  }

  /**
   * Efficient database bulk operations
   */
  async bulkInsertTransactions(transactions, batchSize = 1000) {
    const chunks = this.chunkData(transactions, batchSize);
    const insertResults = [];
    
    for (const chunk of chunks) {
      try {
        // This would integrate with your database service
        const result = await this._performBulkInsert(chunk.data);
        insertResults.push({
          chunkId: chunk.id,
          success: true,
          insertedCount: result.insertedCount
        });
        
      } catch (error) {
        insertResults.push({
          chunkId: chunk.id,
          success: false,
          error: error.message
        });
      }
    }
    
    return insertResults;
  }

  // ====== AI CATEGORIZATION BATCH PROCESSING ======

  /**
   * Batch process thousands of transactions through AI
   */
  async bulkCategorizeTransactions(transactions, batchSize = 100) {
    const jobId = this._generateJobId('ai_categorization');
    
    await this.trackBatchProgress(jobId, {
      status: 'starting',
      total: transactions.length,
      operation: 'ai_categorization'
    });
    
    const chunks = this.chunkData(transactions, batchSize);
    const categorizationResults = [];
    
    const categorizeChunk = async (chunk) => {
      // Check cache first
      const cacheKey = this._generateCacheKey('ai_categorization', chunk.data);
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }
      
      // Rate limiting for Vertex AI
      await this.manageVertexAIRateLimits();
      
      // Call AI service (mock implementation)
      const result = await this._callVertexAI(chunk.data);
      
      // Cache results
      await this.cacheCategorizationResults(result, cacheKey);
      
      return result;
    };
    
    try {
      const results = await this.processChunksSequentially(chunks, categorizeChunk, jobId);
      
      // Aggregate results
      results.forEach(result => {
        categorizationResults.push(...result.categorizations);
      });
      
      // Analyze confidence scores
      const confidenceAnalysis = this.aggregateConfidenceScores(categorizationResults);
      
      await this.trackBatchProgress(jobId, {
        status: 'completed',
        processed: transactions.length,
        results: {
          totalCategorized: categorizationResults.length,
          averageConfidence: confidenceAnalysis.average,
          lowConfidenceCount: confidenceAnalysis.lowConfidenceCount
        }
      });
      
      return {
        categorizations: categorizationResults,
        confidence: confidenceAnalysis
      };
      
    } catch (error) {
      await this.trackBatchProgress(jobId, { status: 'failed', error: error.message });
      throw error;
    }
  }

  /**
   * Handle Google Vertex AI rate limiting
   */
  async manageVertexAIRateLimits() {
    const rateLimitKey = 'vertex_ai_rate_limit';
    const currentRequests = await this.cache.get(rateLimitKey) || 0;
    const maxRequestsPerMinute = 60; // Example limit
    
    if (currentRequests >= maxRequestsPerMinute) {
      const waitTime = 60000; // Wait 1 minute
      this.logger.warn(`Vertex AI rate limit reached, waiting ${waitTime}ms`);
      await this._sleep(waitTime);
      await this.cache.delete(rateLimitKey);
    } else {
      await this.cache.increment(rateLimitKey);
      await this.cache.expire(rateLimitKey, 60); // Expire after 1 minute
    }
  }

  /**
   * Cache AI categorization results
   */
  async cacheCategorizationResults(results, cacheKey) {
    await this.cache.set(cacheKey, results, 24 * 3600); // Cache for 24 hours
  }

  /**
   * Analyze and report AI confidence across batches
   */
  aggregateConfidenceScores(results) {
    if (!results || results.length === 0) {
      return { average: 0, lowConfidenceCount: 0, distribution: {} };
    }
    
    const scores = results.map(r => r.confidence || 0);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const lowConfidenceThreshold = 0.7;
    const lowConfidenceCount = scores.filter(score => score < lowConfidenceThreshold).length;
    
    const distribution = {
      high: scores.filter(s => s >= 0.8).length,
      medium: scores.filter(s => s >= 0.6 && s < 0.8).length,
      low: scores.filter(s => s < 0.6).length
    };
    
    return {
      average: parseFloat(average.toFixed(3)),
      lowConfidenceCount,
      distribution,
      total: results.length
    };
  }

  // ====== ERROR HANDLING & RECOVERY ======

  /**
   * Implement exponential backoff for failed operations
   */
  async implementExponentialBackoff(operation, maxRetries = 3) {
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        retryCount++;
        
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        const delay = this.config.backoffDelay * Math.pow(2, retryCount - 1);
        this.logger.warn(`Operation failed, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
        
        await this._sleep(delay);
      }
    }
  }

  /**
   * Quarantine problematic data for manual review
   */
  async quarantineProblematicData(failedRecords, quarantineReason) {
    const quarantineId = crypto.randomUUID();
    
    const quarantineData = {
      id: quarantineId,
      reason: quarantineReason,
      records: failedRecords,
      quarantinedAt: new Date().toISOString(),
      status: 'quarantined'
    };
    
    await this.cache.set(`quarantine:${quarantineId}`, quarantineData, 7 * 24 * 3600); // 7 days
    
    this.logger.warn(`Data quarantined: ${quarantineReason}`, { 
      quarantineId, 
      recordCount: failedRecords.length 
    });
    
    return quarantineId;
  }

  /**
   * Resume processing from saved checkpoints
   */
  async resumeFromCheckpoint(jobId, checkpointData) {
    const checkpoint = checkpointData || await this.cache.get(`checkpoint:${jobId}`);
    
    if (!checkpoint) {
      throw new Error(`No checkpoint found for job ${jobId}`);
    }
    
    this.logger.info(`Resuming job ${jobId} from checkpoint`, { 
      lastProcessedChunk: checkpoint.lastProcessedChunk 
    });
    
    return checkpoint;
  }

  // ====== HELPER METHODS ======

  _initializeQueues() {
    const queueTypes = [
      'file_processing',
      'ai_categorization',
      'hmrc_submission',
      'data_validation',
      'report_generation',
      'system_maintenance'
    ];
    
    queueTypes.forEach(queueType => {
      this.queues[queueType] = new Queue(queueType, {
        redis: this.redis.options,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50
        }
      });
      
      // Set up job processors
      this.queues[queueType].process(async (job) => {
        return await this.processJob(job.id, () => this._processJobByType(queueType, job.data));
      });
    });
  }

  async _processJobByType(jobType, data) {
    switch (jobType) {
      case 'file_processing':
        return await this.processLargeSpreadsheet(data.fileId, data.chunkSize);
      case 'ai_categorization':
        return await this.bulkCategorizeTransactions(data.transactions, data.batchSize);
      case 'data_validation':
        return await this.validateDataInBatches(data.transactions, data.rules);
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  }

  _setupHealthMonitoring() {
    setInterval(async () => {
      try {
        await this.monitorQueueHealth();
      } catch (error) {
        this.logger.error('Health monitoring failed:', error);
      }
    }, 30000); // Every 30 seconds
  }

  async _processChunkWithCircuitBreaker(chunk, processor) {
    if (this.circuitBreaker.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailure;
      if (timeSinceLastFailure < 60000) { // 1 minute
        throw new Error('Circuit breaker is OPEN');
      } else {
        this.circuitBreaker.state = 'HALF_OPEN';
      }
    }
    
    try {
      const result = await processor(chunk.data);
      
      if (this.circuitBreaker.state === 'HALF_OPEN') {
        this.circuitBreaker.state = 'CLOSED';
        this.circuitBreaker.failures = 0;
      }
      
      return result;
    } catch (error) {
      this._handleCircuitBreaker(error);
      throw error;
    }
  }

  _handleCircuitBreaker(error) {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    if (this.circuitBreaker.failures >= this.config.circuitBreakerThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.logger.error('Circuit breaker opened due to repeated failures');
    }
  }

  async _createCheckpoint(jobId, chunkIndex, results) {
    const checkpoint = {
      jobId,
      lastProcessedChunk: chunkIndex,
      results: results.slice(-10), // Keep last 10 results
      timestamp: new Date().toISOString()
    };
    
    await this.cache.set(`checkpoint:${jobId}`, checkpoint, 24 * 3600);
  }

  _generateJobId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateCacheKey(operation, data) {
    const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `${operation}_${hash}`;
  }

  _getQueue(queueType) {
    if (!this.queues[queueType]) {
      throw new Error(`Queue type not supported: ${queueType}`);
    }
    return this.queues[queueType];
  }

  _updateMetrics(processed, failed, processingTime) {
    this.metrics.processed += processed;
    this.metrics.failed += failed;
    
    if (processingTime > 0) {
      this.metrics.avgProcessingTime = 
        (this.metrics.avgProcessingTime + processingTime) / 2;
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _callVertexAI(transactions) {
    // Mock AI categorization - would integrate with actual Vertex AI
    return {
      categorizations: transactions.map(t => ({
        transactionId: t.id,
        category: 'office_costs',
        confidence: 0.85 + Math.random() * 0.1
      }))
    };
  }

  async _validateTransaction(transaction, rules) {
    // Mock validation - would integrate with validation service
    return { success: true, errors: [] };
  }

  async _performBulkInsert(transactions) {
    // Mock database insert - would integrate with database service
    return { insertedCount: transactions.length };
  }

  async _processSpreadsheetChunk(chunk, fileInfo) {
    // Mock spreadsheet processing - would integrate with parser service
    return {
      rowCount: chunk.data.length,
      transactions: chunk.data.map(row => ({ id: Math.random(), ...row }))
    };
  }

  async _createFileChunks(filePath, rowsPerChunk) {
    // Mock file chunking - would integrate with actual file reading
    const totalRows = 10000; // Mock total
    const chunks = [];
    
    for (let i = 0; i < totalRows; i += rowsPerChunk) {
      chunks.push({
        id: Math.floor(i / rowsPerChunk),
        data: Array(Math.min(rowsPerChunk, totalRows - i)).fill().map(() => ({ row: i })),
        startRow: i,
        endRow: Math.min(i + rowsPerChunk - 1, totalRows - 1)
      });
    }
    
    return chunks;
  }

  _calculateThroughput(queueName) {
    // Mock throughput calculation
    return this.metrics.processed / ((Date.now() - this.metrics.lastReset) / 1000);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger.info('Shutting down batch processor service...');
    
    // Close all queues
    for (const queue of Object.values(this.queues)) {
      await queue.close();
    }
    
    // Stop scheduled jobs
    for (const [jobId, job] of this.scheduledJobs) {
      job.task.stop();
    }
    
    // Close Redis connection
    await this.redis.quit();
    
    this.logger.info('Batch processor service shutdown complete');
  }
}

module.exports = BatchProcessorService;