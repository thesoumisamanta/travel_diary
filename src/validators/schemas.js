import Joi from 'joi';

// User schemas
export const registerSchema = Joi.object({
  username: Joi.string().min(2).max(50).required()
    .messages({
      'string.min': 'Username must be at least 2 characters',
      'any.required': 'Username is required'
    }),
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Please provide a valid email',
      'any.required': 'Email is required'
    }),
  password: Joi.string().min(6).required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required'
    }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Confirm password is required'
    }),
  fullName: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Full name must be at least 2 characters',
      'any.required': 'Full name is required'
    }),
  accountType: Joi.string().valid('Personal', 'Business').required()
    .messages({
      'any.only': 'Account type must be either Personal or Business',
      'any.required': 'Account type is required'
    })
});

export const loginSchema = Joi.object({
  email: Joi.string().email().when('username', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  username: Joi.string().when('email', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  password: Joi.string().required()
    .messages({
      'any.required': 'Password is required'
    })
}).or('email', 'username')
  .messages({
    'object.missing': 'Either email or username is required'
  });

export const updateUserSchema = Joi.object({
  fullName: Joi.string().min(2).max(100),
  email: Joi.string().email(),
  bio: Joi.string().max(200),
  description: Joi.string().max(500)
});

export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required()
    .messages({
      'any.required': 'Old password is required'
    }),
  newPassword: Joi.string().min(6).required()
    .messages({
      'string.min': 'New password must be at least 6 characters',
      'any.required': 'New password is required'
    })
});

// Video schemas
export const uploadVideoSchema = Joi.object({
  title: Joi.string().min(1).max(200).required()
    .messages({
      'any.required': 'Video title is required'
    }),
  description: Joi.string().max(5000).allow(''),
  tags: Joi.string().allow('')
});

// Comment schemas
export const commentSchema = Joi.object({
  text: Joi.string().min(1).max(1000).required()
    .messages({
      'any.required': 'Comment text is required',
      'string.max': 'Comment cannot exceed 1000 characters'
    }),
  parent: Joi.string().optional()
});

// Playlist schemas
export const createPlaylistSchema = Joi.object({
  title: Joi.string().min(1).max(100).required()
    .messages({
      'any.required': 'Playlist title is required'
    }),
  description: Joi.string().max(500).allow(''),
  isPublic: Joi.boolean().default(true)
});