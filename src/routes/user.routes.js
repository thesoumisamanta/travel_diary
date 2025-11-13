import express from 'express';
import auth from '../middlewares/auth.js';
import SubscriptionController from '../controllers/subscription.controller.js';

const router = express.Router();


router.post('/subscribe/:channelId', auth, SubscriptionController.subscribe);
router.post('/unsubscribe/:channelId', auth, SubscriptionController.unsubscribe);
router.get('/subscriptions', auth, SubscriptionController.getSubscriptions);

// other routes: profile update, get by id, avatar upload (omitted for brevity)

export default router;
