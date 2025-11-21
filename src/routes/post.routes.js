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

// Public routes
router.get('/search', searchPosts);
router.get('/list', listPosts); // All public posts
router.get('/:id', getPost);

// Protected routes
router.use(auth);

// Upload post (video OR images - user chooses via form fields)
// Use 'video' field for uploading 1 video
// Use 'images' field for uploading up to 10 images
router.post('/upload', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'images', maxCount: 10 }
]), uploadPost);

// Unified feed - shows posts from ONLY followed users (not current user's posts)
router.get('/feed/following', getFeed);

// Get specific user's posts (for profile page)
router.get('/user/:userId', getUserPosts);

// Like/Dislike
router.post('/:id/like', likePost);
router.post('/:id/dislike', dislikePost);

export default router;