import multer from 'multer';
import path from 'path';


// store in memory for direct Cloudinary upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  // allow images and common video extensions
  const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mov', '.mkv', '.webm'];
  if (!allowed.includes(ext)) {
    return cb(new Error('Unsupported file type'), false);
  }
  cb(null, true);
};

const limits = {
  fileSize: 200 * 1024 * 1024 // 200MB - adjust for video sizes; env var recommended
};

const upload = multer({ storage, fileFilter, limits });

export default upload;
