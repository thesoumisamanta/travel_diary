import Joi from 'joi';

// User schemas
export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
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
