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
    }
  }
  next();
};

router.get('/search', optionalAuth, searchPosts);
router.get('/list', optionalAuth, listPosts);
router.get('/:id', optionalAuth, getPost);

router.use(auth);


router.post('/upload', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'short', maxCount: 1 }
]), uploadPost);


router.get('/feed/following', getFeed);


router.get('/user/:userId', getUserPosts);

router.post('/:id/like', likePost);
router.post('/:id/dislike', dislikePost);

export default router;