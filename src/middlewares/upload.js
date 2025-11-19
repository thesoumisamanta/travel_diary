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
  
  // For avatar and coverImage, only allow images
  if (file.fieldname === 'avatar' || file.fieldname === 'coverImage') {
    if (!isImage) {
      return cb(new Error('Only image files are allowed for avatar and cover image'), false);
    }
  }
  
  // For video uploads, allow both images (thumbnails) and videos
  if (file.fieldname === 'video') {
    if (!isVideo && !isImage) {
      return cb(new Error('Only video and image files are allowed'), false);
    }
  }
  
  // Allow all supported types
  if (!isImage && !isVideo) {
    return cb(new Error('Unsupported file type'), false);
  }
  
  cb(null, true);
};

const limits = {
  fileSize: 200 * 1024 * 1024 // 200MB for videos
};

const upload = multer({ 
  storage, 
  fileFilter, 
  limits 
});

export default upload;