import Post from '../models/post.models.js';
import User from '../models/user.models.js';
import { uploadToCloudinary, saveLocally } from '../services/uploadService.js';
import mongoose from 'mongoose';
import Joi from 'joi';

const uploadPostSchema = Joi.object({
  title: Joi.string().min(1).required(),
  description: Joi.string().allow(''),
  tags: Joi.string().allow(''),
  postType: Joi.string().valid('video', 'images', 'short').optional()
});

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

export const uploadPost = async (req, res) => {
  try {
    console.log('========== UPLOAD POST DEBUG ==========');
    console.log('Headers:', req.headers['content-type']);
    console.log('Body:', req.body);
    console.log('Files:', req.files ? Object.keys(req.files) : 'NO FILES');
    console.log('======================================');

    const { error, value } = uploadPostSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const hasVideo = req.files && req.files['video'];
    const hasImages = req.files && req.files['images'];
    const hasShort = req.files && req.files['short'];

    console.log('Detected types:', { hasVideo: !!hasVideo, hasImages: !!hasImages, hasShort: !!hasShort });

    const uploadTypes = [hasVideo, hasImages, hasShort].filter(Boolean).length;
    if (uploadTypes > 1) {
      return res.status(400).json({
        message: 'Cannot upload multiple types. Please upload either video, images, OR short.'
      });
    }

    if (!hasVideo && !hasImages && !hasShort) {
      return res.status(400).json({
        message: 'Please upload either a video, images, or a short video.'
      });
    }

    const tags = value.tags ? value.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    // Handle SHORT video upload
    if (hasShort) {
      const shortFile = hasShort[0];
      const filename = shortFile.originalname;

      let videoUrl, thumbnailUrl = null, duration = null;

      if (process.env.CLOUDINARY_API_KEY) {
        const uploaded = await uploadToCloudinary(shortFile.buffer, filename, 'posts/shorts');
        if (uploaded.duration && uploaded.duration > 60) {
          return res.status(400).json({ message: 'Shorts must be 60 seconds or less' });
        }
        videoUrl = uploaded.secure_url;
        thumbnailUrl = uploaded.format && uploaded.resource_type !== 'image' ? null : uploaded.secure_url;
        duration = uploaded.duration || null;
      } else {
        const saved = await saveLocally(shortFile.buffer, filename, 'public/uploads/posts/shorts');
        videoUrl = saved.url;
      }

      const post = new Post({
        title: value.title,
        description: value.description,
        tags,
        uploader: req.user._id,
        postType: 'short',
        videoUrl,
        thumbnailUrl,
        duration,
        isPublic: true
      });

      await post.save();

      // 🔥 CRITICAL: Populate uploader before returning
      await post.populate('uploader', 'username fullName avatar followersCount followingCount');

      return res.status(201).json(post);
    }

    // Handle VIDEO upload
    if (hasVideo) {
      const videoFile = hasVideo[0];
      const filename = videoFile.originalname;

      let videoUrl, thumbnailUrl = null, duration = null;

      if (process.env.CLOUDINARY_API_KEY) {
        const uploaded = await uploadToCloudinary(videoFile.buffer, filename, 'posts/videos');
        videoUrl = uploaded.secure_url;
        thumbnailUrl = uploaded.format && uploaded.resource_type !== 'image' ? null : uploaded.secure_url;
        duration = uploaded.duration || null;
      } else {
        const saved = await saveLocally(videoFile.buffer, filename, 'public/uploads/posts/videos');
        videoUrl = saved.url;
      }

      const post = new Post({
        title: value.title,
        description: value.description,
        tags,
        uploader: req.user._id,
        postType: 'video',
        videoUrl,
        thumbnailUrl,
        duration,
        isPublic: true
      });

      await post.save();

      // 🔥 CRITICAL: Populate uploader before returning
      await post.populate('uploader', 'username fullName avatar followersCount followingCount');

      return res.status(201).json(post);
    }

    // Handle IMAGES upload
    if (hasImages) {
      const imageFiles = hasImages;

      if (imageFiles.length > 10) {
        return res.status(400).json({ message: 'Maximum 10 images allowed per post' });
      }

      const uploadedImages = [];

      for (const imageFile of imageFiles) {
        const filename = imageFile.originalname;

        if (process.env.CLOUDINARY_API_KEY) {
          const uploaded = await uploadToCloudinary(imageFile.buffer, filename, 'posts/images');
          uploadedImages.push({ url: uploaded.secure_url, caption: '' });
        } else {
          const saved = await saveLocally(imageFile.buffer, filename, 'public/uploads/posts/images');
          uploadedImages.push({ url: saved.url, caption: '' });
        }
      }

      const post = new Post({
        title: value.title,
        description: value.description,
        tags,
        uploader: req.user._id,
        postType: 'images',
        images: uploadedImages,
         isPublic: true
      });

      await post.save();

      // 🔥 CRITICAL: Populate uploader before returning
      await post.populate('uploader', 'username fullName avatar followersCount followingCount');

      return res.status(201).json(post);
    }

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ message: err.message || 'Upload failed' });
  }
};


export const getPost = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const post = await Post.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('uploader', 'username fullName avatar followersCount followingCount');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const postWithLikeState = addUserLikeState(post, userId);
    res.json(postWithLikeState);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const likePost = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);
      post.dislikes.pull(userId);
    }

    await post.save();

    res.json({
      likes: post.likes.length,
      dislikes: post.dislikes.length,
      isLiked: post.likes.some(id => id.toString() === userId.toString()),
      isDisliked: post.dislikes.some(id => id.toString() === userId.toString())
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const dislikePost = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const alreadyDisliked = post.dislikes.includes(userId);

    if (alreadyDisliked) {
      post.dislikes.pull(userId);
    } else {
      post.dislikes.push(userId);
      post.likes.pull(userId);
    }

    await post.save();

    res.json({
      likes: post.likes.length,
      dislikes: post.dislikes.length,
      isLiked: post.likes.some(id => id.toString() === userId.toString()),
      isDisliked: post.dislikes.some(id => id.toString() === userId.toString())
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listPosts = async (req, res) => {
  try {
    const userId = req.user?._id;
    const page = parseInt(req.query.page) || 1;
    const postType = req.query.type; // Optional filter: 'video', 'images', 'short'
    const shortsOnly = req.query.shortsOnly === 'true'; // NEW: Optional shorts filter
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    const query = { isPublic: true };

    // If shortsOnly is true, override postType and only fetch shorts
    if (shortsOnly) {
      query.postType = 'short';
    } else if (postType && ['video', 'images', 'short'].includes(postType)) {
      query.postType = postType;
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploader', 'username fullName avatar followersCount followingCount');

    const postsWithLikeState = posts.map(post => addUserLikeState(post, userId));
    res.json(postsWithLikeState);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getFeed = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const postType = req.query.type;
    const shortsOnly = req.query.shortsOnly === 'true';
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(currentUserId).select('following');

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followingIds = currentUser.following;

    // If user is not following anyone, return empty feed
    if (followingIds.length === 0) {
      return res.json([]);
    }

    // 🔥 CRITICAL FIX: Explicitly exclude current user's posts
    const query = {
      uploader: {
        $in: followingIds,
        $ne: currentUserId  // ✅ This ensures current user's posts are EXCLUDED
      },
      isPublic: true
    };

    if (shortsOnly) {
      query.postType = 'short';
    } else if (postType && ['video', 'images', 'short'].includes(postType)) {
      query.postType = postType;
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploader', 'username fullName avatar followersCount followingCount');

    const postsWithLikeState = posts.map(post => addUserLikeState(post, currentUserId));

    console.log(`Feed returned ${posts.length} posts for user ${currentUserId}, excluding their own posts`);

    res.json(postsWithLikeState);
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?._id;
    const page = parseInt(req.query.page) || 1;
    const postType = req.query.type; // Optional filter
    const shortsOnly = req.query.shortsOnly === 'true'; // NEW: Optional shorts filter
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const query = {
      uploader: userId,
      isPublic: true
    };

    // If shortsOnly is true, override postType and only fetch shorts
    if (shortsOnly) {
      query.postType = 'short';
    } else if (postType && ['video', 'images', 'short'].includes(postType)) {
      query.postType = postType;
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploader', 'username fullName avatar followersCount followingCount');

    const postsWithLikeState = posts.map(post => addUserLikeState(post, currentUserId));
    res.json(postsWithLikeState);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const searchPosts = async (req, res) => {
  try {
    const userId = req.user?._id;
    const q = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const shortsOnly = req.query.shortsOnly === 'true'; // NEW: Optional shorts filter
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({ message: 'Query required' });
    }

    const query = {
      $text: { $search: q },
      isPublic: true
    };

    // If shortsOnly is true, only fetch shorts
    if (shortsOnly) {
      query.postType = 'short';
    }

    const posts = await Post.find(query)
      .skip(skip)
      .limit(limit)
      .populate('uploader', 'username fullName avatar followersCount followingCount');

    const postsWithLikeState = posts.map(post => addUserLikeState(post, userId));
    res.json(postsWithLikeState);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export default {
  uploadPost,
  getPost,
  likePost,
  dislikePost,
  listPosts,
  getFeed,
  getUserPosts,
  searchPosts
};