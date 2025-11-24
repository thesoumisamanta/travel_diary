import User from "../models/user.models.js";
import Post from "../models/post.models.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import asyncHandler from "../utils/async_handler.js";
import ApiError from "../utils/api_error.js";
import ApiResponse from "../utils/api_response.js";
import { uploadToCloudinary, saveLocally } from "../services/uploadService.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Token generation error:", error);
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
};

// ==================== AUTH FUNCTIONS ====================

export const registerUser = asyncHandler(async (req, res) => {
  // DEBUG: Log what's received
  console.log("req.body:", req.body);
  console.log("req.files:", req.files);

  const { fullName, email, username, password, accountType, bio, description } = req.body;

  console.log("Registration attempt:", { fullName, email, username, accountType });

  // Validation - check each field individually for better error message
  if (!fullName || fullName.trim() === "") {
    throw new ApiError(400, "Full name is required");
  }
  if (!email || email.trim() === "") {
    throw new ApiError(400, "Email is required");
  }
  if (!username || username.trim() === "") {
    throw new ApiError(400, "Username is required");
  }
  if (!password || password.trim() === "") {
    throw new ApiError(400, "Password is required");
  }
  if (!accountType || accountType.trim() === "") {
    throw new ApiError(400, "Account type is required");
  }

  // Validate account type
  if (!['Personal', 'Business'].includes(accountType)) {
    throw new ApiError(400, "Account type must be either 'Personal' or 'Business'");
  }

  // Password length validation
  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long");
  }

  // Check if user exists
  const existedUser = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // Handle optional avatar upload
  let avatarUrl = "";
  if (req.files?.avatar && req.files.avatar[0]) {
    try {
      if (process.env.CLOUDINARY_API_KEY) {
        const uploaded = await uploadToCloudinary(
          req.files.avatar[0].buffer,
          req.files.avatar[0].originalname,
          'avatars'
        );
        avatarUrl = uploaded.secure_url;
      } else {
        const saved = await saveLocally(
          req.files.avatar[0].buffer,
          req.files.avatar[0].originalname,
          'public/uploads/avatars'
        );
        avatarUrl = saved.url;
      }
    } catch (error) {
      console.error("Avatar upload error during registration:", error);
      // Continue without avatar - it's optional
    }
  }

  // Handle optional cover image upload
  let coverImageUrl = "";
  if (req.files?.coverImage && req.files.coverImage[0]) {
    try {
      if (process.env.CLOUDINARY_API_KEY) {
        const uploaded = await uploadToCloudinary(
          req.files.coverImage[0].buffer,
          req.files.coverImage[0].originalname,
          'cover-images'
        );
        coverImageUrl = uploaded.secure_url;
      } else {
        const saved = await saveLocally(
          req.files.coverImage[0].buffer,
          req.files.coverImage[0].originalname,
          'public/uploads/covers'
        );
        coverImageUrl = saved.url;
      }
    } catch (error) {
      console.error("Cover image upload error during registration:", error);
      // Continue without cover image - it's optional
    }
  }

  // Create user
  const user = await User.create({
    fullName,
    email: email.toLowerCase(),
    password,
    username: username.toLowerCase(),
    accountType,
    avatar: avatarUrl,
    coverImage: coverImageUrl,
    bio: bio || "",
    description: description || ""
  });

  const createdUser = await User.findById(user._id).select("-password -refreshToken");

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  console.log("User registered successfully:", createdUser.username);

  return res.status(201).json(
    new ApiResponse(201, createdUser, "User registered successfully")
  );
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  console.log("Login attempt:", { email, username });

  // Validate input
  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  // Find user by username OR email
  const user = await User.findOne({
    $or: [
      { username: username?.toLowerCase() },
      { email: email?.toLowerCase() }
    ]
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  console.log("User found:", user.username, user.email);

  // Check password
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  };

  console.log("Login successful:", loggedInUser.username);

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken
        },
        "User logged in successfully"
      )
    );
});

export const logoutUser = asyncHandler(async (req, res) => {
  console.log("Logout user:", req.user?._id);

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1
      }
    },
    {
      new: true
    }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

// ==================== USER PROFILE FUNCTIONS ====================

export const getCurrentUser = asyncHandler(async (req, res) => {
  console.log("Getting current user:", req.user?._id);

  if (!req.user) {
    throw new ApiError(401, "User not authenticated");
  }

  // Fetch fresh user data from database
  const user = await User.findById(req.user._id).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Get user's posts (both video and image posts)
  const posts = await Post.find({ uploader: user._id, isPublic: true })
    .sort({ createdAt: -1 })
    .select('_id title postType videoUrl images thumbnailUrl createdAt views likes dislikes');

  // Add posts to user object
  const userWithContent = {
    ...user.toObject(),
    posts: posts
  };

  return res
    .status(200)
    .json(new ApiResponse(200, userWithContent, "User fetched successfully"));
});

export const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email, bio, description } = req.body;

  const updateFields = {};
  if (fullName) updateFields.fullName = fullName;
  if (email) updateFields.email = email.toLowerCase();
  if (bio !== undefined) updateFields.bio = bio;
  if (description !== undefined) updateFields.description = description;

  if (Object.keys(updateFields).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: updateFields },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

export const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old password and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters long");
  }

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

export const updateUserAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Avatar file is missing");
  }

  let avatarUrl;

  try {
    if (process.env.CLOUDINARY_API_KEY) {
      const uploaded = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        'avatars'
      );
      avatarUrl = uploaded.secure_url;
    } else {
      const saved = await saveLocally(
        req.file.buffer,
        req.file.originalname,
        'public/uploads/avatars'
      );
      avatarUrl = saved.url;
    }
  } catch (error) {
    console.error("Avatar upload error:", error);
    throw new ApiError(400, "Error while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatarUrl
      }
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

export const updateUserCoverImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Cover image file is missing");
  }

  let coverImageUrl;

  try {
    if (process.env.CLOUDINARY_API_KEY) {
      const uploaded = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        'cover-images'
      );
      coverImageUrl = uploaded.secure_url;
    } else {
      const saved = await saveLocally(
        req.file.buffer,
        req.file.originalname,
        'public/uploads/covers'
      );
      coverImageUrl = saved.url;
    }
  } catch (error) {
    console.error("Cover image upload error:", error);
    throw new ApiError(400, "Error while uploading cover image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImageUrl
      }
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

export const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  // Find user by username
  const user = await User.findOne({ username: username.toLowerCase() })
    .select("-password -refreshToken");

  if (!user) {
    throw new ApiError(404, "Channel does not exist");
  }

  // Check if current user follows this channel
  let isFollowing = false;
  if (req.user && req.user._id) {
    isFollowing = user.followers.includes(req.user._id);
  }

  // Get user's posts
  const posts = await Post.find({ uploader: user._id, isPublic: true })
    .sort({ createdAt: -1 })
    .select('_id title postType videoUrl images thumbnailUrl createdAt views likes dislikes');

  const channelProfile = {
    ...user.toObject(),
    isFollowing,
    posts
  };

  return res
    .status(200)
    .json(new ApiResponse(200, channelProfile, "User channel fetched successfully"));
});

export const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: 'watchHistory',
      populate: {
        path: 'uploader',
        select: 'username fullName avatar'
      }
    });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user.watchHistory,
        "Watch history fetched successfully"
      )
    );
});

// ==================== FOLLOW/UNFOLLOW FUNCTIONS ====================

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
  const currentUser = await User.findById(currentUserId);
  if (currentUser.following.includes(userId)) {
    throw new ApiError(400, "You are already following this user");
  }

  // Add to current user's following array
  await User.findByIdAndUpdate(currentUserId, {
    $addToSet: { following: userId }
  });

  // Add to target user's followers array
  await User.findByIdAndUpdate(userId, {
    $addToSet: { followers: currentUserId }
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User followed successfully"));
});

export const unfollowUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  // Validate userId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  // Check if currently following
  const currentUser = await User.findById(currentUserId);
  if (!currentUser.following.includes(userId)) {
    throw new ApiError(400, "You are not following this user");
  }

  // Remove from current user's following array
  await User.findByIdAndUpdate(currentUserId, {
    $pull: { following: userId }
  });

  // Remove from target user's followers array
  await User.findByIdAndUpdate(userId, {
    $pull: { followers: currentUserId }
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User unfollowed successfully"));
});

export const getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
  const skip = (page - 1) * limit;

  // Use current user's ID if userId not provided
  const targetUserId = userId || req.user._id;

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  // Get user and populate followers with pagination
  const user = await User.findById(targetUserId)
    .select('followers')
    .populate({
      path: 'followers',
      select: 'username fullName avatar bio',
      options: {
        skip: skip,
        limit: limit
      }
    });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user.followers, "Followers fetched successfully"));
});

export const getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
  const skip = (page - 1) * limit;

  // Use current user's ID if userId not provided
  const targetUserId = userId || req.user._id;

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  // Get user and populate following with pagination
  const user = await User.findById(targetUserId)
    .select('following')
    .populate({
      path: 'following',
      select: 'username fullName avatar bio',
      options: {
        skip: skip,
        limit: limit
      }
    });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user.following, "Following fetched successfully"));
});

export const checkFollowStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const currentUser = await User.findById(currentUserId).select('following');

  if (!currentUser) {
    throw new ApiError(404, "User not found");
  }

  const isFollowing = currentUser.following.includes(userId);

  return res
    .status(200)
    .json(new ApiResponse(200, { isFollowing }, "Follow status fetched"));
});