import express from 'express';
import auth from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import videoController from '../controllers/video.controller.js';

const router = express.Router();

// Public routes
router.get('/', videoController.list);
router.get('/search', videoController.search);
router.get('/:id', videoController.getVideo);

// Protected routes - ONLY SINGLE VIDEO UPLOAD
router.post('/', auth, upload.single('video'), videoController.upload);
router.post('/:id/like', auth, videoController.like);
router.post('/:id/dislike', auth, videoController.dislike);

export default router;