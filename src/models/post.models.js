import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    index: 'text' 
  },
  description: { 
    type: String,
    default: '',
    index: 'text'
  },
  uploader: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  
  // Post Type: 'video', 'images', or 'short'
  postType: {
    type: String,
    enum: ['video', 'images', 'short'],
    required: true
  },
  
  // Content identifier for frontend formatting
  // 'gallery' for multiple images, 'single_image' for one image,
  // 'long_video' for videos > 60s, 'short_video' for shorts <= 60s
  contentFormat: {
    type: String,
    enum: ['gallery', 'single_image', 'long_video', 'short_video'],
    default: null
  },
  
  // For video/short posts (only 1 video)
  videoUrl: { 
    type: String 
  },
  thumbnailUrl: { 
    type: String 
  },
  duration: { 
    type: Number // Duration in seconds
  },
  
  // For image posts (up to 10 images)
  images: [{
    url: { type: String, required: true },
    caption: { type: String, default: '' }
  }],
  
  // Common fields
  views: { 
    type: Number, 
    default: 0 
  },
  likes: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  dislikes: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  tags: {
    type: [String],
    index: 'text'
  },
  isPublic: { 
    type: Boolean, 
    default: true 
  },
  
  // Aspect ratio for proper display in frontend
  aspectRatio: {
    type: Number, // width / height
    default: null
  },
  
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: -1
  }
});

// Compound text search index for better search performance
postSchema.index({ 
  title: 'text', 
  description: 'text', 
  tags: 'text' 
}, {
  weights: {
    title: 10,
    tags: 5,
    description: 1
  }
});

// Additional indexes for filtering and search
postSchema.index({ postType: 1, createdAt: -1 });
postSchema.index({ uploader: 1, postType: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ title: 1 });

// Validation and auto-set contentFormat
postSchema.pre('save', function(next) {
  if (this.postType === 'video') {
    if (!this.videoUrl) {
      return next(new Error('Video URL is required for video posts'));
    }
    this.images = [];
    this.contentFormat = 'long_video';
  } else if (this.postType === 'short') {
    if (!this.videoUrl) {
      return next(new Error('Video URL is required for short posts'));
    }
    if (this.duration && this.duration > 60) {
      return next(new Error('Shorts must be 60 seconds or less'));
    }
    this.images = [];
    this.contentFormat = 'short_video';
  } else if (this.postType === 'images') {
    if (!this.images || this.images.length === 0) {
      return next(new Error('At least one image is required for image posts'));
    }
    if (this.images.length > 10) {
      return next(new Error('Maximum 10 images allowed per post'));
    }
    this.videoUrl = undefined;
    this.thumbnailUrl = undefined;
    this.duration = undefined;
    this.contentFormat = this.images.length > 1 ? 'gallery' : 'single_image';
  }
  next();
});

// Virtual for formatted response
postSchema.virtual('formattedType').get(function() {
  return {
    type: this.postType,
    format: this.contentFormat,
    isVideo: this.postType === 'video' || this.postType === 'short',
    isShort: this.postType === 'short',
    isGallery: this.postType === 'images' && this.images?.length > 1,
    isSingleImage: this.postType === 'images' && this.images?.length === 1
  };
});

postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

export default mongoose.model('Post', postSchema);