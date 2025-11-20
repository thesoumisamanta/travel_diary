import multer from 'multer';
import path from 'path';

// Store in memory for direct Cloudinary upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Different allowed extensions based on field name
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const videoExtensions = ['.mp4', '.mov', '.mkv', '.webm', '.avi'];
  
  const isImage = imageExtensions.includes(ext);
  const isVideo = videoExtensions.includes(ext);
  
  // For avatar and coverImage, only allow images (single file)
  if (file.fieldname === 'avatar' || file.fieldname === 'coverImage') {
    if (!isImage) {
      return cb(new Error('Only image files are allowed for avatar and cover image'), false);
    }
    return cb(null, true);
  }
  
  // For video field, only allow videos (single file)
  if (file.fieldname === 'video') {
    if (!isVideo) {
      return cb(new Error('Only video files are allowed for video field'), false);
    }
    return cb(null, true);
  }
  
  // For images field, only allow images (multiple files, max 10)
  if (file.fieldname === 'images') {
    if (!isImage) {
      return cb(new Error('Only image files are allowed for images field'), false);
    }
    return cb(null, true);
  }
  
  // Default: reject unsupported types
  cb(new Error('Unsupported file type'), false);
};

const limits = {
  fileSize: 200 * 1024 * 1024 // 200MB max file size
};

const upload = multer({ 
  storage, 
  fileFilter, 
  limits 
});

// Custom middleware to validate mixed upload attempts
export const validatePostUpload = (req, res, next) => {
  // Check if both video and images are uploaded
  const hasVideo = req.files && req.files['video'];
  const hasImages = req.files && req.files['images'];
  
  if (hasVideo && hasImages) {
    return res.status(400).json({ 
      message: 'Cannot upload both video and images together. Please upload either a video OR images.' 
    });
  }
  
  // Check if images exceed 10
  if (hasImages && hasImages.length > 10) {
    return res.status(400).json({ 
      message: 'Maximum 10 images allowed per post' 
    });
  }
  
  // Check if nothing is uploaded
  if (!hasVideo && !hasImages) {
    return res.status(400).json({ 
      message: 'Please upload either a video or at least one image' 
    });
  }
  
  next();
};

export default upload;