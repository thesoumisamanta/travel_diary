import Post from '../models/post.models.js';
import User from '../models/user.models.js';
import mongoose from 'mongoose';

// Helper to add user like state to posts
const addUserLikeState = (post, userId) => {
  const postObj = post.toObject ? post.toObject() : post;
  const userIdStr = userId?.toString();
  
  return {
    ...postObj,
    isLiked: postObj.likes?.some(id => id.toString() === userIdStr) || false,
    isDisliked: postObj.dislikes?.some(id => id.toString() === userIdStr) || false,
    likesCount: postObj.likes?.length || 0,
    dislikesCount: postObj.dislikes?.length || 0
  };
};

/**
 * @desc Search users by username or fullName
 * @route GET /api/search/users
 * @query q - search query string
 * @query page - page number (default: 1)
 */
export const searchUsers = async (req, res) => {
  try {
    const q = req.query.q || req.query.query || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    // Don't use lean() so virtuals are included, or select the actual arrays
    const users = await User.find({
      $or: [
        { username: { $regex: searchRegex } },
        { fullName: { $regex: searchRegex } }
      ]
    })
      .select('username fullName avatar bio accountType isVerified followers following')
      .skip(skip)
      .limit(limit);

    // Map users to include follower counts from array length
    const usersWithCounts = users.map(user => {
      const userObj = user.toObject ? user.toObject() : user;
      return {
        _id: userObj._id,
        username: userObj.username,
        fullName: userObj.fullName,
        avatar: userObj.avatar,
        bio: userObj.bio,
        accountType: userObj.accountType,
        isVerified: userObj.isVerified || false,
        // Calculate counts from arrays
        followersCount: userObj.followers ? userObj.followers.length : 0,
        followingCount: userObj.following ? userObj.following.length : 0,
      };
    });

    res.json({
      success: true,
      data: usersWithCounts,
      page,
      hasMore: users.length === limit
    });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Search posts by title, description, or tags
 * @route GET /api/search/posts
 * @query q - search query string
 * @query type - filter by postType (video, images, short) - optional
 * @query page - page number (default: 1)
 */
export const searchPosts = async (req, res) => {
  try {
    const userId = req.user?._id;
    const q = req.query.q || req.query.query || '';
    const postType = req.query.type;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    // Build query
    const query = {
      isPublic: true,
      $or: [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { tags: { $regex: searchRegex } }
      ]
    };

    // Add postType filter if provided
    if (postType && ['video', 'images', 'short'].includes(postType)) {
      query.postType = postType;
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'uploader',
        select: 'username fullName avatar followers following isVerified'
      });

    // Add like state and proper counts
    const postsWithLikeState = posts.map(post => {
      const postObj = addUserLikeState(post, userId);
      // Ensure uploader has proper counts
      if (postObj.uploader) {
        postObj.uploader.followersCount = postObj.uploader.followers?.length || 0;
        postObj.uploader.followingCount = postObj.uploader.following?.length || 0;
      }
      return postObj;
    });

    res.json({
      success: true,
      data: postsWithLikeState,
      page,
      hasMore: posts.length === limit
    });
  } catch (err) {
    console.error('Search posts error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Search all content (users + posts) - unified search
 * @route GET /api/search/all
 * @query q - search query string
 * @query page - page number (default: 1)
 */
export const searchAll = async (req, res) => {
  try {
    const userId = req.user?._id;
    const q = req.query.q || req.query.query || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 10);
    const skip = (page - 1) * limit;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    // Search users - include followers/following arrays for count calculation
    const users = await User.find({
      $or: [
        { username: { $regex: searchRegex } },
        { fullName: { $regex: searchRegex } }
      ]
    })
      .select('username fullName avatar bio accountType isVerified followers following')
      .skip(skip)
      .limit(limit);

    // Map users with proper counts
    const usersWithCounts = users.map(user => {
      const userObj = user.toObject ? user.toObject() : user;
      return {
        _id: userObj._id,
        username: userObj.username,
        fullName: userObj.fullName,
        avatar: userObj.avatar,
        bio: userObj.bio,
        accountType: userObj.accountType,
        isVerified: userObj.isVerified || false,
        followersCount: userObj.followers ? userObj.followers.length : 0,
        followingCount: userObj.following ? userObj.following.length : 0,
      };
    });

    // Search posts
    const posts = await Post.find({
      isPublic: true,
      $or: [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { tags: { $regex: searchRegex } }
      ]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'uploader',
        select: 'username fullName avatar followers following isVerified'
      });

    const postsWithLikeState = posts.map(post => {
      const postObj = addUserLikeState(post, userId);
      if (postObj.uploader) {
        postObj.uploader.followersCount = postObj.uploader.followers?.length || 0;
        postObj.uploader.followingCount = postObj.uploader.following?.length || 0;
      }
      return postObj;
    });

    res.json({
      success: true,
      data: {
        users: usersWithCounts,
        posts: postsWithLikeState
      },
      page,
      hasMore: users.length === limit || posts.length === limit
    });
  } catch (err) {
    console.error('Search all error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Get shorts only (filtered posts with postType: 'short')
 * @route GET /api/search/shorts
 * @query page - page number (default: 1)
 */
export const getShorts = async (req, res) => {
  try {
    const userId = req.user?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    const shorts = await Post.find({
      postType: 'short',
      isPublic: true
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'uploader',
        select: 'username fullName avatar followers following isVerified'
      });

    const shortsWithLikeState = shorts.map(post => {
      const postObj = addUserLikeState(post, userId);
      if (postObj.uploader) {
        postObj.uploader.followersCount = postObj.uploader.followers?.length || 0;
        postObj.uploader.followingCount = postObj.uploader.following?.length || 0;
      }
      return postObj;
    });

    res.json({
      success: true,
      data: shortsWithLikeState,
      page,
      hasMore: shorts.length === limit
    });
  } catch (err) {
    console.error('Get shorts error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Get user profile by ID
 * @route GET /api/search/user/:userId
 */
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId)
      .select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userObj = user.toObject();

    // Check if current user follows this user
    let isFollowing = false;
    if (currentUserId) {
      isFollowing = user.followers.some(id => id.toString() === currentUserId.toString());
    }

    // Get user's posts
    const posts = await Post.find({ uploader: userId, isPublic: true })
      .sort({ createdAt: -1 })
      .select('_id title postType videoUrl images thumbnailUrl createdAt views likes dislikes');

    const userProfile = {
      ...userObj,
      followersCount: user.followers?.length || 0,
      followingCount: user.following?.length || 0,
      postsCount: posts.length,
      isFollowing,
      posts: posts.map(post => ({
        ...post.toObject(),
        likesCount: post.likes?.length || 0,
        dislikesCount: post.dislikes?.length || 0,
      }))
    };

    // Remove arrays to avoid sending large data
    delete userProfile.followers;
    delete userProfile.following;

    res.json({
      success: true,
      data: userProfile
    });
  } catch (err) {
    console.error('Get user by ID error:', err);
    res.status(500).json({ message: err.message });
  }
};

export default {
  searchUsers,
  searchPosts,
  searchAll,
  getShorts,
  getUserById
};