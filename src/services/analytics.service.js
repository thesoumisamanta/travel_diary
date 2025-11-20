import Video from '../models/video.models.js';
import Follow from '../models/follow.models.js';
import Comment from '../models/comment.models.js';

/**
 * @desc Basic analytics service - can be extended with Redis or data warehouse
 */
export const getDashboardStats = async (userId) => {
  const videosCount = await Video.countDocuments({ uploader: userId });
  const totalViewsAgg = await Video.aggregate([
    { $match: { uploader: userId } },
    { $group: { _id: null, totalViews: { $sum: '$views' } } }
  ]);

  const followers = await Follow.countDocuments({ following: userId });
  const following = await Follow.countDocuments({ follower: userId });
  const comments = await Comment.countDocuments({ author: userId });

  return {
    videosCount,
    totalViews: totalViewsAgg[0]?.totalViews || 0,
    followers,
    following,
    comments
  };
};

/**
 * @desc Get trending videos by views
 */
export const getTrendingVideos = async (limit = 10) => {
  return Video.find({ isPublic: true }).sort({ views: -1 }).limit(limit)
    .populate('uploader', 'username fullName avatar');
};