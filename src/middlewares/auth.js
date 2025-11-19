import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';
import ApiError from '../utils/api_error.js';
import asyncHandler from '../utils/async_handler.js';

const auth = asyncHandler(async (req, res, next) => {
  console.log("AUTH MIDDLEWARE EXECUTED");
  
  // Get token from cookies or Authorization header
  const token = req.cookies?.accessToken || 
                req.header("Authorization")?.replace("Bearer ", "");

  console.log("Token received:", token ? "Yes" : "No");

  if (!token) {
    throw new ApiError(401, 'Access token is required');
  }

  try {
    // Verify token with correct secret
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("Decoded token:", decoded);

    // Find user by ID from token
    const user = await User.findById(decoded._id).select('-password -refreshToken');

    if (!user) {
      throw new ApiError(401, 'Invalid access token - user not found');
    }

    console.log("User found:", user.username, user.email);

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid access token');
    } else if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Access token has expired');
    } else {
      throw new ApiError(401, error?.message || 'Invalid access token');
    }
  }
});

export default auth;