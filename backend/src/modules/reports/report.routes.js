'use strict';

/**
 * Report Routes - /api/v1/reports
 * Super-admin uniquement.
 */

const express             = require('express');
const { requireAuth }          = require('../../middleware/authMiddleware');
const { requireSuperAdmin }    = require('../../middleware/rbac');
const reportService            = require('./report.service');

const router = express.Router();

router.use(requireAuth, requireSuperAdmin);

/**
 * GET /api/v1/reports
 * Liste les rapports générés.
 * Query : session_type?, limit?, offset?
 */
router.get('/', async (req, res, next) => {
  try {
    const { session_type, limit = 50, offset = 0 } = req.query;
    const reports = await reportService.listReports({
      sessionType: session_type || null,
      limit:       Math.min(parseInt(limit, 10) || 50, 200),
      offset:      parseInt(offset, 10) || 0,
    });
    res.json({ reports });
  } catch (err) { next(err); }
});

module.exports = router;
