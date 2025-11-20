import Follow from '../models/follow.models.js';
import User from '../models/user.models.js';
import asyncHandler from '../utils/async_handler.js';
import ApiError from '../utils/api_error.js';
import ApiResponse from '../utils/api_response.js';
import mongoose from 'mongoose';

// Follow a user
export const followUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  // Validate userId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  // Cannot follow yourself
  if (userId === currentUserId.toString()) {
    throw new ApiError(400, "You cannot follow yourself");
  }

  // Check if target user exists
  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  // Check if already following
  const existingFollow = await Follow.findOne({
    follower: currentUserId,
    following: userId
  });

  if (existingFollow) {
    throw new ApiError(400, "You are already following this user");
  }

  // Create follow relationship
  await Follow.create({
    follower: currentUserId,
    following: userId
  });

  // Update follower and following counts
  await User.findByIdAndUpdate(userId, { $inc: { followersCount: 1 } });
  await User.findByIdAndUpdate(currentUserId, { $inc: { followingCount: 1 } });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User followed successfully"));
});

// Unfollow a user
export const unfollowUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  // Validate userId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  // Find and delete follow relationship
  const follow = await Follow.findOneAndDelete({
    follower: currentUserId,
    following: userId
  });

  if (!follow) {
    throw new ApiError(400, "You are not following this user");
  }

  // Update follower and following counts
  await User.findByIdAndUpdate(userId, { $inc: { followersCount: -1 } });
  await User.findByIdAndUpdate(currentUserId, { $inc: { followingCount: -1 } });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User unfollowed successfully"));
});

// Get followers of a user
export const getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
  const skip = (page - 1) * limit;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const followers = await Follow.find({ following: userId })
    .populate('follower', 'username fullName avatar bio')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const followersList = followers.map(f => f.follower);

  return res
    .status(200)
    .json(new ApiResponse(200, followersList, "Followers fetched successfully"));
});

// Get following of a user
export const getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
  const skip = (page - 1) * limit;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const following = await Follow.find({ follower: userId })
    .populate('following', 'username fullName avatar bio')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const followingList = following.map(f => f.following);

  return res
    .status(200)
    .json(new ApiResponse(200, followingList, "Following fetched successfully"));
});

// Check if current user follows target user
export const checkFollowStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const isFollowing = await Follow.exists({
    follower: currentUserId,
    following: userId
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { isFollowing: !!isFollowing }, "Follow status fetched"));
});

export default {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus
};