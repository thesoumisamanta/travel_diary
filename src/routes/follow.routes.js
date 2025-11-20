import express from 'express';
import auth from '../middlewares/auth.js';
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus
} from '../controllers/follow.controller.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Follow/Unfollow
router.post('/follow/:userId', followUser);
router.post('/unfollow/:userId', unfollowUser);

// Get followers and following
router.get('/followers/:userId', getFollowers);
router.get('/following/:userId', getFollowing);

// Check follow status
router.get('/status/:userId', checkFollowStatus);

export default router;