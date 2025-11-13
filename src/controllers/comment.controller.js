import Comment from '../models/comment.models.js';
import Video from '../models/video.models.js';
import Joi from 'joi';


const commentSchema = Joi.object({
  text: Joi.string().min(1).required(),
  parent: Joi.string().optional()
});

export const addComment = async (req, res) => {
  const { error, value } = commentSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  const videoId = req.params.videoId;
  const video = await Video.findById(videoId);
  if (!video) return res.status(404).json({ message: 'Video not found' });

  const comment = new Comment({
    video: videoId,
    author: req.user._id,
    text: value.text,
    parent: value.parent || null
  });
  await comment.save();
  res.status(201).json(comment);
};

export const getCommentsForVideo = async (req, res) => {
  const videoId = req.params.videoId;
  const comments = await Comment.find({ video: videoId })
    .populate('author', 'name avatarUrl')
    .sort({ createdAt: -1 });
  res.json(comments);
};

export const likeComment = async (req, res) => {
  const id = req.params.id;
  const comment = await Comment.findById(id);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });

  if (comment.likes.includes(req.user._id)) comment.likes.pull(req.user._id);
  else comment.likes.push(req.user._id);

  await comment.save();
  res.json({ likes: comment.likes.length });
};

export default { addComment, getCommentsForVideo, likeComment };
