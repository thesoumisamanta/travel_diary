import Joi from 'joi';

// User schemas
export const registerSchema = Joi.object({
  username: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  fullName: Joi.string().min(2).max(100).required(),
  accountType: Joi.string().valid('Personal', 'Business').required(),
  avatar: Joi.string().uri().allow(''),
  coverImage: Joi.string().uri().allow(''),
  watchHistory: Joi.array().items(Joi.string())
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(50),
  bio: Joi.string().max(200),
  avatarUrl: Joi.string().uri().allow('')
});

// Video schemas
export const uploadVideoSchema = Joi.object({
  title: Joi.string().min(1).required(),
  description: Joi.string().allow(''),
  tags: Joi.string().allow('')
});

// Comment schemas
export const commentSchema = Joi.object({
  text: Joi.string().min(1).required(),
  parent: Joi.string().optional()
});
