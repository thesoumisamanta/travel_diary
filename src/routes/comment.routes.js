import express from 'express';
import auth from '../middlewares/auth.js';
import commentController from '../controllers/comment.controller.js';

const router = express.Router();

// Post comments
router.post('/:postId', auth, commentController.addComment);
router.get('/:postId', commentController.getCommentsForPost);

// Comment replies
router.get('/:commentId/replies', commentController.getRepliesForComment);

// Comment actions
router.post('/:commentId/like', auth, commentController.likeComment);
router.post('/:commentId/dislike', auth, commentController.dislikeComment);
router.put('/:commentId', auth, commentController.updateComment);
router.delete('/:commentId', auth, commentController.deleteComment);

export default router;