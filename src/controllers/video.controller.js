import Video from '../models/video.models.js';
import { uploadToCloudinary, saveLocally } from '../services/uploadService.js';
import mongoose from 'mongoose';
import Joi from 'joi';

const uploadVideoSchema = Joi.object({
  title: Joi.string().min(1).required(),
  description: Joi.string().allow(''),
  tags: Joi.string().allow('')
});

// Upload video (ONLY SINGLE VIDEO - no images)
export const upload = async (req, res) => {
  try {
    const { error, value } = uploadVideoSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No video file uploaded' });
    }

    const filename = req.file.originalname;

    if (process.env.CLOUDINARY_API_KEY) {
      const uploaded = await uploadToCloudinary(req.file.buffer, filename, 'videos');
      
      const video = new Video({
        title: value.title,
        description: value.description,
        tags: value.tags ? value.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        uploader: req.user._id,
        fileUrl: uploaded.secure_url,
        thumbnailUrl: uploaded.format && uploaded.resource_type !== 'image' ? null : uploaded.secure_url,
        duration: uploaded.duration || null
      });

      await video.save();
      return res.status(201).json(video);
    } else {
      const saved = await saveLocally(req.file.buffer, filename, 'public/uploads/videos');
      
      const video = new Video({
        title: value.title,
        description: value.description,
        tags: value.tags ? value.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        uploader: req.user._id,
        fileUrl: saved.url
      });

      await video.save();
      return res.status(201).json(video);
    }
  } catch (err) {
    console.error('Video upload error:', err);
    return res.status(500).json({ message: err.message || 'Upload failed' });
  }
};

export const getVideo = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const video = await Video.findByIdAndUpdate(
      id, 
      { $inc: { views: 1 } }, 
      { new: true }
    ).populate('uploader', 'username fullName avatar');

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    res.json(video);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const like = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user._id;

    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Toggle like
    if (video.likes.includes(userId)) {
      video.likes.pull(userId);
    } else {
      video.likes.push(userId);
      video.dislikes.pull(userId);
    }

    await video.save();
    res.json({ likes: video.likes.length, dislikes: video.dislikes.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const dislike = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user._id;

    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    if (video.dislikes.includes(userId)) {
      video.dislikes.pull(userId);
    } else {
      video.dislikes.push(userId);
      video.likes.pull(userId);
    }

    await video.save();
    res.json({ likes: video.likes.length, dislikes: video.dislikes.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const list = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    const videos = await Video.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploader', 'username fullName avatar');

    res.json(videos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const search = async (req, res) => {
  try {
    const q = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(process.env.DEFAULT_PAGE_SIZE || 20);
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({ message: 'Query required' });
    }

    const videos = await Video.find({ 
      $text: { $search: q }, 
      isPublic: true 
    })
      .skip(skip)
      .limit(limit)
      .populate('uploader', 'username fullName avatar');

    res.json(videos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export default { upload, getVideo, like, dislike, list, search };