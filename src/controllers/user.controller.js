import User from '../models/user.models.js';
import Video from '../models/video.models.js';
import Subscription from '../models/subscription.models.js';
import Joi from 'joi';

/**
 * @desc Get public user profile with stats (channel info)
 */
export const getUserProfile = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });

  const videosCount = await Video.countDocuments({ uploader: id });
  const subscribersCount = await Subscription.countDocuments({ channel: id });

  res.json({ user, stats: { videosCount, subscribersCount } });
};

/**
 * @desc Update logged-in user profile
 */
export const updateProfile = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50),
    bio: Joi.string().max(200),
    avatarUrl: Joi.string().uri().allow('')
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  const user = await User.findByIdAndUpdate(req.user._id, value, { new: true }).select('-password');
  res.json(user);
};

/**
 * @desc Delete user (soft delete optional)
 */
export const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (req.user._id.toString() !== id) return res.status(403).json({ message: 'Forbidden' });

  await User.findByIdAndDelete(id);
  await Video.deleteMany({ uploader: id });
  res.json({ message: 'User and videos deleted successfully' });
};

/**
 * @desc Get channel videos
 */
export const getUserVideos = async (req, res) => {
  const { id } = req.params;
  const videos = await Video.find({ uploader: id }).sort({ createdAt: -1 });
  res.json(videos);
};

export default { getUserProfile, updateProfile, deleteUser, getUserVideos };
