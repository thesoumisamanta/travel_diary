import express from 'express';
import auth from '../middlewares/auth.js';
import {
  searchUsers,
  searchPosts,
  searchAll,
  getShorts,
  getUserById
} from '../controllers/search.controller.js';

const router = express.Router();

// Optional auth middleware for getting like states and follow status
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

// Search users - GET /api/search/users?q=searchterm&page=1
router.get('/users', optionalAuth, searchUsers);

// Search posts - GET /api/search/posts?q=searchterm&type=video&page=1
router.get('/posts', optionalAuth, searchPosts);

// Search all content - GET /api/search/all?q=searchterm&page=1
router.get('/all', optionalAuth, searchAll);

// Get shorts - GET /api/search/shorts?page=1
router.get('/shorts', optionalAuth, getShorts);

// Get user by ID - GET /api/search/user/:userId
router.get('/user/:userId', optionalAuth, getUserById);

export default router;