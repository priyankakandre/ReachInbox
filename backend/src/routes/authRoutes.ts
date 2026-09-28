import { Router } from 'express';
import { demoLogin, getGoogleAuthUrl, googleCallback, getMe, logout } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/demo-login', demoLogin);
router.get('/google', getGoogleAuthUrl);
router.get('/google/callback', googleCallback);
router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

export default router;
