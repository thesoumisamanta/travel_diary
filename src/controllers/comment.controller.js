import Comment from '../models/comment.models.js';
import Post from '../models/post.models.js';
import Joi from 'joi';
import mongoose from 'mongoose';

const commentSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required(),
  parentId: Joi.string().optional()
});

const addUserLikeState = (comment, userId) => {
  const commentObj = comment.toObject ? comment.toObject() : comment;
  const userIdStr = userId?.toString();
  
  return {
    ...commentObj,
    isLiked: commentObj.likes?.some(id => id.toString() === userIdStr) || false,
    isDisliked: commentObj.dislikes?.some(id => id.toString() === userIdStr) || false,
    likesCount: commentObj.likes?.length || 0,
    dislikesCount: commentObj.dislikes?.length || 0
  };
};

// Add a comment to a post
export const addComment = async (req, res) => {
  try {
    const { error, value } = commentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const postId = req.params.postId;
    
    // Validate post ID
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // If this is a reply, check if parent comment exists
    let parentComment = null;
    if (value.parentId) {
      if (!mongoose.Types.ObjectId.isValid(value.parentId)) {
        return res.status(400).json({ message: 'Invalid parent comment ID' });
      }

      parentComment = await Comment.findById(value.parentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }

      // Ensure parent comment belongs to the same post
      if (parentComment.post.toString() !== postId) {
        return res.status(400).json({ message: 'Parent comment does not belong to this post' });
      }
    }

    // Create the comment
    const comment = new Comment({
      post: postId,
      author: req.user._id,
      content: value.content,
      parent: value.parentId || null
    });

    await comment.save();

    // Update parent comment's reply count
    if (parentComment) {
      parentComment.replyCount += 1;
      await parentComment.save();
    }

    // Populate author details
    await comment.populate('author', 'username fullName avatar isVerified');

    // Add like/dislike state
    const commentWithState = addUserLikeState(comment, req.user._id);

    res.status(201).json({
      success: true,
      data: commentWithState,
      message: 'Comment added successfully'
    });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Get comments for a post (with pagination)
export const getCommentsForPost = async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Validate post ID
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    // Get only top-level comments (no parent)
    const comments = await Comment.find({ 
      post: postId, 
      parent: null 
    })
      .populate('author', 'username fullName avatar isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Add like/dislike state for each comment
    const commentsWithState = comments.map(comment => 
      addUserLikeState(comment, userId)
    );

    res.json({
      success: true,
      data: commentsWithState,
      pagination: {
        page,
        limit,
        hasMore: comments.length === limit
      }
    });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Get replies for a comment
export const getRepliesForComment = async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Validate comment ID
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid comment ID' });
    }

    // Get replies
    const replies = await Comment.find({ 
      parent: commentId 
    })
      .populate('author', 'username fullName avatar isVerified')
      .sort({ createdAt: 1 }) // Oldest first for replies
      .skip(skip)
      .limit(limit);

    // Add like/dislike state for each reply
    const repliesWithState = replies.map(reply => 
      addUserLikeState(reply, userId)
    );

    res.json({
      success: true,
      data: repliesWithState,
      pagination: {
        page,
        limit,
        hasMore: replies.length === limit
      }
    });
  } catch (err) {
    console.error('Get replies error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Like a comment
export const likeComment = async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const alreadyLiked = comment.likes.includes(userId);

    if (alreadyLiked) {
      // Unlike
      comment.likes.pull(userId);
    } else {
      // Like and remove dislike if exists
      comment.likes.push(userId);
      comment.dislikes.pull(userId);
    }

    await comment.save();

    res.json({
      success: true,
      data: {
        likes: comment.likes.length,
        dislikes: comment.dislikes.length,
        isLiked: comment.likes.some(id => id.toString() === userId.toString()),
        isDisliked: comment.dislikes.some(id => id.toString() === userId.toString())
      }
    });
  } catch (err) {
    console.error('Like comment error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Dislike a comment
export const dislikeComment = async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const alreadyDisliked = comment.dislikes.includes(userId);

    if (alreadyDisliked) {
      // Remove dislike
      comment.dislikes.pull(userId);
    } else {
      // Dislike and remove like if exists
      comment.dislikes.push(userId);
      comment.likes.pull(userId);
    }

    await comment.save();

    res.json({
      success: true,
      data: {
        likes: comment.likes.length,
        dislikes: comment.dislikes.length,
        isLiked: comment.likes.some(id => id.toString() === userId.toString()),
        isDisliked: comment.dislikes.some(id => id.toString() === userId.toString())
      }
    });
  } catch (err) {
    console.error('Dislike comment error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Update a comment
export const updateComment = async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the author
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }

    comment.content = content;
    comment.isEdited = true;
    comment.editedAt = new Date();

    await comment.save();
    await comment.populate('author', 'username fullName avatar isVerified');

    const commentWithState = addUserLikeState(comment, req.user._id);

    res.json({
      success: true,
      data: commentWithState,
      message: 'Comment updated successfully'
    });
  } catch (err) {
    console.error('Update comment error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Delete a comment
export const deleteComment = async (req, res) => {
  try {
    const commentId = req.params.commentId;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the author
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // If this comment has a parent, decrease parent's reply count
    if (comment.parent) {
      await Comment.findByIdAndUpdate(comment.parent, {
        $inc: { replyCount: -1 }
      });
    }

    // Delete all replies to this comment
    await Comment.deleteMany({ parent: commentId });

    // Delete the comment
    await Comment.findByIdAndDelete(commentId);

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ message: err.message });
  }
};

export default {
  addComment,
  getCommentsForPost,
  getRepliesForComment,
  likeComment,
  dislikeComment,
  updateComment,
  deleteComment
};