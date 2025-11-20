import express from 'express';
import auth from '../middlewares/auth.js';
import upload, { validatePostUpload } from '../middlewares/upload.js';
import postController from '../controllers/post.controller.js';

const router = express.Router();

// Public routes
router.get('/', postController.listPosts);
router.get('/search', postController.searchPosts);
router.get('/:id', postController.getPost);

// Protected routes
router.post(
  '/', 
  auth, 
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  validatePostUpload,
  postController.uploadPost
);

router.post('/:id/like', auth, postController.likePost);
router.post('/:id/dislike', auth, postController.dislikePost);

export default router;