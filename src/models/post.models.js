import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    index: 'text' 
  },
  description: { 
    type: String,
    default: ''
  },
  uploader: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  
  // Post Type: 'video' or 'images'
  postType: {
    type: String,
    enum: ['video', 'images'],
    required: true
  },
  
  // For video posts (only 1 video)
  videoUrl: { 
    type: String 
  },
  thumbnailUrl: { 
    type: String 
  },
  duration: { 
    type: Number 
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
  tags: [String],
  isPublic: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Text search index
postSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Validation: Ensure correct fields based on postType
postSchema.pre('save', function(next) {
  if (this.postType === 'video') {
    if (!this.videoUrl) {
      return next(new Error('Video URL is required for video posts'));
    }
    // Clear images array for video posts
    this.images = [];
  } else if (this.postType === 'images') {
    if (!this.images || this.images.length === 0) {
      return next(new Error('At least one image is required for image posts'));
    }
    if (this.images.length > 10) {
      return next(new Error('Maximum 10 images allowed per post'));
    }
    // Clear video fields for image posts
    this.videoUrl = undefined;
    this.thumbnailUrl = undefined;
    this.duration = undefined;
  }
  next();
});

export default mongoose.model('Post', postSchema);