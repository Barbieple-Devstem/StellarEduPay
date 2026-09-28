/**
 * Retry Queue Routes
 * 
 * API endpoints for managing the transaction retry queue system.
 * All routes require admin authentication.
 */

'use strict';

const express = require('express');
const {
  getStats,
  getHealth,
  getJob,
  getJobs,
  manualRetry,
  deleteJob,
  pause,
  resume,
  queueTransaction,
} = require('../controllers/retryQueueController');
const { requireAdminAuth } = require('../middleware/auth');
const { auditContext } = require('../middleware/auditContext');

const router = express.Router();

// Apply admin auth to all retry queue routes
router.use(requireAdminAuth);

// Queue statistics and monitoring (read-only — no audit context needed)
router.get('/stats', getStats);
router.get('/health', getHealth);

// Job management
router.get('/jobs/:jobId', getJob);
router.get('/jobs/state/:state', getJobs);
// #1554 — state-changing operations require auditContext so every mutation is
// attributed to the acting administrator in the immutable audit trail.
router.post('/jobs/:jobId/retry', auditContext, manualRetry);
router.delete('/jobs/:jobId', auditContext, deleteJob);

// Queue control
router.post('/pause', auditContext, pause);
router.post('/resume', auditContext, resume);

// Manual transaction queuing
router.post('/queue', auditContext, queueTransaction);

module.exports = router;
