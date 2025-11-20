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

// Upload post (video OR images)
router.post('/upload', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'images', maxCount: 10 }
]), uploadPost);

// Feed - only followed users' posts
router.get('/feed/following', getFeed);

// User's own posts
router.get('/user/:userId', getUserPosts);

// Like/Dislike
router.post('/:id/like', likePost);
router.post('/:id/dislike', dislikePost);

export default router;