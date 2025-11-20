import express from 'express';
import auth from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import FollowController from '../controllers/follow.controller.js';
import {
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
  changeCurrentPassword
} from '../controllers/user.controller.js';

const router = express.Router();

// Follow routes
router.post('/follow/:userId', auth, FollowController.followUser);
router.post('/unfollow/:userId', auth, FollowController.unfollowUser);
router.get('/followers/:userId?', auth, FollowController.getFollowers);
router.get('/following/:userId?', auth, FollowController.getFollowing);

// User profile routes
router.get('/current', auth, getCurrentUser);
router.patch('/update-account', auth, updateAccountDetails);
router.patch('/change-password', auth, changeCurrentPassword);

// Avatar and cover image routes
router.patch('/avatar', auth, upload.single('avatar'), updateUserAvatar);
router.patch('/cover-image', auth, upload.single('coverImage'), updateUserCoverImage);

// Channel profile
router.get('/channel/:username', getUserChannelProfile);

// Watch history
router.get('/watch-history', auth, getWatchHistory);

export default router;