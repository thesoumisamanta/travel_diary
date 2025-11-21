import express from 'express';
import auth from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import {
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
  changeCurrentPassword,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus
} from '../controllers/user.controller.js';

const router = express.Router();

// ==================== USER PROFILE ROUTES ====================

// Get current authenticated user
router.get('/current', auth, getCurrentUser);

// Update account details
router.patch('/update-account', auth, updateAccountDetails);

// Change password
router.patch('/change-password', auth, changeCurrentPassword);

// Update avatar (image only)
router.patch('/avatar', auth, upload.single('avatar'), updateUserAvatar);

// Update cover image (image only)
router.patch('/cover-image', auth, upload.single('coverImage'), updateUserCoverImage);

// Get user channel profile by username
router.get('/channel/:username', getUserChannelProfile);

// Get watch history
router.get('/watch-history', auth, getWatchHistory);

// ==================== FOLLOW/UNFOLLOW ROUTES ====================

// Follow a user
router.post('/follow/:userId', auth, followUser);

// Unfollow a user
router.post('/unfollow/:userId', auth, unfollowUser);

// Get followers of a user (userId optional - defaults to current user)
router.get('/followers/:userId?', auth, getFollowers);

// Get following of a user (userId optional - defaults to current user)
router.get('/following/:userId?', auth, getFollowing);

// Check if current user follows target user
router.get('/status/:userId', auth, checkFollowStatus);

export default router;