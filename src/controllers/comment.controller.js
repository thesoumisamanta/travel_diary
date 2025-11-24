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

// Helper function to find root comment
const findRootComment = async (commentId) => {
  let currentComment = await Comment.findById(commentId);
  
  // Traverse up to find root (comment with no parent)
  while (currentComment && currentComment.parent) {
    currentComment = await Comment.findById(currentComment.parent);
  }
  
  return currentComment;
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
    let rootComment = null;
    
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
      
      // Find the root comment (the one with no parent)
      rootComment = await findRootComment(value.parentId);
    }

    // Create the comment
    const comment = new Comment({
      post: postId,
      author: req.user._id,
      content: value.content,
      parent: value.parentId || null
    });

    await comment.save();

    // Update reply count for the ROOT comment only (not intermediate replies)
    if (rootComment) {
      rootComment.replyCount += 1;
      await rootComment.save();
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

// Get replies for a comment (ALL nested replies, not just direct children)
export const getRepliesForComment = async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100; // Increased limit for nested replies
    const skip = (page - 1) * limit;

    // Validate comment ID
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid comment ID' });
    }

    // Verify the comment exists
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Get ALL replies recursively
    const getAllReplies = async (parentId) => {
      const directReplies = await Comment.find({ parent: parentId })
        .populate('author', 'username fullName avatar isVerified')
        .sort({ createdAt: 1 }); // Oldest first

      const allReplies = [];
      
      for (const reply of directReplies) {
        allReplies.push(reply);
        // Recursively get nested replies
        const nestedReplies = await getAllReplies(reply._id);
        allReplies.push(...nestedReplies);
      }
      
      return allReplies;
    };

    const allReplies = await getAllReplies(commentId);
    
    // Apply pagination
    const paginatedReplies = allReplies.slice(skip, skip + limit);

    // Add like/dislike state for each reply
    const repliesWithState = paginatedReplies.map(reply => 
      addUserLikeState(reply, userId)
    );

    res.json({
      success: true,
      data: repliesWithState,
      pagination: {
        page,
        limit,
        total: allReplies.length,
        hasMore: (skip + limit) < allReplies.length
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

    // Count total replies (including nested)
    const countReplies = async (parentId) => {
      const directReplies = await Comment.find({ parent: parentId });
      let count = directReplies.length;
      
      for (const reply of directReplies) {
        count += await countReplies(reply._id);
      }
      
      return count;
    };

    const totalRepliesCount = await countReplies(commentId);

    // Find root comment to update its reply count
    if (comment.parent) {
      const rootComment = await findRootComment(comment.parent);
      if (rootComment) {
        // Decrease by 1 (for this comment) + all its nested replies
        rootComment.replyCount = Math.max(0, rootComment.replyCount - (1 + totalRepliesCount));
        await rootComment.save();
      }
    }

    // Delete all replies to this comment recursively
    const deleteRepliesRecursively = async (parentId) => {
      const replies = await Comment.find({ parent: parentId });
      
      for (const reply of replies) {
        await deleteRepliesRecursively(reply._id);
        await Comment.findByIdAndDelete(reply._id);
      }
    };

    await deleteRepliesRecursively(commentId);

    // Delete the comment itself
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