import { Router } from 'express';
import {
  getSlackStatus,
  setSlackWebhook,
  connectSlackOAuth,
  slackOAuthCallback,
  testSlackNotification,
  disconnectSlack,
} from '../controllers/slackController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Callback does not require JWT authorization header because it comes from Slack redirect
router.get('/callback', slackOAuthCallback);

// Protected routes
router.use(requireAuth);

router.get('/status', getSlackStatus);
router.post('/webhook', setSlackWebhook);
router.post('/connect', connectSlackOAuth);
router.post('/test', testSlackNotification);
router.post('/disconnect', disconnectSlack);

export default router;
