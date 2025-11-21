import Post from '../models/post.models.js';
import User from '../models/user.models.js';
import { uploadToCloudinary, saveLocally } from '../services/uploadService.js';
import mongoose from 'mongoose';
import Joi from 'joi';

const uploadPostSchema = Joi.object({
  title: Joi.string().min(1).required(),
  description: Joi.string().allow(''),
  tags: Joi.string().allow('')
});

// Upload post (either video or images)
export const uploadPost = async (req, res) => {
  try {
    const { error, value } = uploadPostSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const hasVideo = req.files && req.files['video'];
    const hasImages = req.files && req.files['images'];

    // Validation: Cannot upload both video and images
    if (hasVideo && hasImages) {
      return res.status(400).json({ 
        message: 'Cannot upload both video and images together. Please upload either a video OR images.' 
      });
    }

    // Validation: Must upload something
    if (!hasVideo && !hasImages) {
      return res.status(400).json({ 
        message: 'Please upload either a video or at least one image' 
      });
    }

    // Parse tags
    const tags = value.tags ? value.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    // Handle VIDEO upload
    if (hasVideo) {
      const videoFile = hasVideo[0];
      const filename = videoFile.originalname;

      if (process.env.CLOUDINARY_API_KEY) {
        const uploaded = await uploadToCloudinary(videoFile.buffer, filename, 'posts/videos');
        
        const post = new Post({
          title: value.title,
          description: value.description,
          tags,
          uploader: req.user._id,
          postType: 'video',
          videoUrl: uploaded.secure_url,
          thumbnailUrl: uploaded.format && uploaded.resource_type !== 'image' ? null : uploaded.secure_url,
          duration: uploaded.duration || null
        });

        await post.save();
        return res.status(201).json(post);
      } else {
        const saved = await saveLocally(videoFile.buffer, filename, 'public/uploads/posts/videos');
        
        const post = new Post({
          title: value.title,
          description: value.description,
          tags,
          uploader: req.user._id,
          postType: 'video',
          videoUrl: saved.url
        });

        await post.save();
        return res.status(201).json(post);
      }
    }

    // Handle IMAGES upload (multiple images, max 10)
    if (hasImages) {
      const imageFiles = hasImages;

      // Validation: Max 10 images
      if (imageFiles.length > 10) {
        return res.status(400).json({ 
          message: 'Maximum 10 images allowed per post' 
        });
      }

      const uploadedImages = [];

      for (const imageFile of imageFiles) {
        const filename = imageFile.originalname;

        if (process.env.CLOUDINARY_API_KEY) {
          const uploaded = await uploadToCloudinary(imageFile.buffer, filename, 'posts/images');
          uploadedImages.push({
            url: uploaded.secure_url,
            caption: ''
          });
        } else {
          const saved = await saveLocally(imageFile.buffer, filename, 'public/uploads/posts/images');
          uploadedImages.push({
            url: saved.url,
            caption: ''
          });
        }
      }

      const post = new Post({
        title: value.title,
        description: value.description,
        tags,
        uploader: req.user._id,
        postType: 'images',
        images: uploadedImages
      });

      await post.save();
      return res.status(201).json(post);
    }

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ message: err.message || 'Upload failed' });
  }
};

// Get single post
export const getPost = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const post = await Post.findByIdAndUpdate(
      id, 
      { $inc: { views: 1 } }, 
      { new: true }
    ).populate('uploader', 'username fullName avatar');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Like post
export const likePost = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Toggle like
    if (post.likes.includes(userId)) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);
      post.dislikes.pull(userId); // Remove dislike if present
    }

    await post.save();
    res.json({ likes: post.likes.length, dislikes: post.dislikes.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Dislike post
export const dislikePost = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Toggle dislike
    if (post.dislikes.includes(userId)) {
      post.dislikes.pull(userId);
    } else {
      post.dislikes.push(userId);
      post.likes.pull(userId); // Remove like if present
    }

    await post.save();
    res.json({ likes: post.likes.length, dislikes: post.dislikes.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// List all posts with pagination (PUBLIC - all posts)
export const listPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    const posts = await Post.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploader', 'username fullName avatar');

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get feed - ONLY posts from followed users (NOT including current user's own posts)
export const getFeed = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    // Get current user's following array
    const currentUser = await User.findById(currentUserId).select('following');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followingIds = currentUser.following;

    // If not following anyone, return empty array
    if (followingIds.length === 0) {
      return res.json([]);
    }

    // Get posts ONLY from followed users (NOT including current user)
    const posts = await Post.find({ 
      uploader: { $in: followingIds },
      isPublic: true 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploader', 'username fullName avatar');

    res.json(posts);
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Get user's own posts (for profile page)
export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const posts = await Post.find({ 
      uploader: userId,
      isPublic: true 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploader', 'username fullName avatar');

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Search posts
export const searchPosts = async (req, res) => {
  try {
    const q = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({ message: 'Query required' });
    }

    const posts = await Post.find({ 
      $text: { $search: q }, 
      isPublic: true 
    })
      .skip(skip)
      .limit(limit)
      .populate('uploader', 'username fullName avatar');

    res.json(posts);
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