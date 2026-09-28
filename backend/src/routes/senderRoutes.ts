import { Router } from 'express';
import { getSenders, createSender } from '../controllers/senderController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', getSenders);
router.post('/', createSender);

export default router;
