import express from 'express';
import multer from 'multer';
import auth from '../middlewares/auth.js';
import {
  upload,
  getVideo,
  like,
  dislike,
  list,
  getFeed,
  getUserVideos,
  search
} from '../controllers/video.controller.js';

const router = express.Router();
const videoUpload = multer({ storage: multer.memoryStorage() });

// Public routes
router.get('/search', search);
router.get('/list', list); // All public videos
router.get('/:id', getVideo);

// Protected routes
router.use(auth);

// Upload video
router.post('/upload', videoUpload.single('video'), upload);

// Feed - only followed users' videos
router.get('/feed/following', getFeed);

// User's own videos
router.get('/user/:userId', getUserVideos);

// Like/Dislike
router.post('/:id/like', like);
router.post('/:id/dislike', dislike);

export default router;