import express from 'express';
import auth from '../middlewares/auth.js';
import commentController from '../controllers/comment.controller.js';

const router = express.Router();


router.post('/:videoId', auth, commentController.addComment);
router.get('/:videoId', commentController.getCommentsForVideo);
router.post('/like/:id', auth, commentController.likeComment);

export default router;
