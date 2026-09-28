import { Router } from 'express';
import {
  scheduleEmails,
  getEmails,
  getEmailStats,
  searchEmails,
  reindexEmails,
  resetRateLimit,
  loadTestSchedule,
} from '../controllers/emailController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.post('/schedule', scheduleEmails);
router.get('/', getEmails);
router.get('/stats', getEmailStats);
router.get('/search', searchEmails);
router.post('/reindex', reindexEmails);
router.post('/reset-rate-limit', resetRateLimit);
router.post('/load-test', loadTestSchedule);

export default router;
