import express from 'express';
import multer from 'multer';
import auth from '../middlewares/auth.js';
import {
  uploadPost,
  getPost,
  likePost,
  dislikePost,
  listPosts,
  getFeed,
  getUserPosts,
  searchPosts
} from '../controllers/post.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Optional auth middleware for public routes that benefit from user context
const optionalAuth = async (req, res, next) => {
  const token = req.cookies?.accessToken || 
                req.header("Authorization")?.replace("Bearer ", "");
  
  if (token) {
    try {
      const jwt = await import('jsonwebtoken');
      const User = (await import('../models/user.models.js')).default;
      const decoded = jwt.default.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decoded._id).select('-password -refreshToken');
      if (user) {
        req.user = user;
      }
    } catch (error) {
      // Token invalid, continue without user
    }
  }
  next();
};

// Public routes (with optional auth for like states)
router.get('/search', optionalAuth, searchPosts);
router.get('/list', optionalAuth, listPosts); // All public posts, supports ?type=video|images|short
router.get('/:id', optionalAuth, getPost);

// Protected routes
router.use(auth);

// Upload post (video OR images OR short - user chooses via form fields)
// Use 'video' field for uploading 1 video
// Use 'images' field for uploading up to 10 images
// Use 'short' field for uploading 1 short video (max 60 seconds)
router.post('/upload', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'short', maxCount: 1 }
]), uploadPost);

// Unified feed - shows posts from ONLY followed users
// Supports ?type=video|images|short filter
router.get('/feed/following', getFeed);

// Get specific user's posts (for profile page)
// Supports ?type=video|images|short filter
router.get('/user/:userId', getUserPosts);

// Like/Dislike
router.post('/:id/like', likePost);
router.post('/:id/dislike', dislikePost);

export default router;