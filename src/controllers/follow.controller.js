import Follow from '../models/follow.models.js';
import User from '../models/user.models.js';

export const followUser = async (req, res) => {
  const userIdToFollow = req.params.userId;
  
  // Check if trying to follow self
  if (req.user._id.equals(userIdToFollow)) {
    return res.status(400).json({ message: 'Cannot follow yourself' });
  }

  // Check if user exists
  const userExists = await User.findById(userIdToFollow);
  if (!userExists) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Check if already following
  const exists = await Follow.findOne({ 
    follower: req.user._id, 
    following: userIdToFollow 
  });
  
  if (exists) {
    return res.status(400).json({ message: 'Already following this user' });
  }

  // Create follow relationship
  const follow = new Follow({ 
    follower: req.user._id, 
    following: userIdToFollow 
  });
  await follow.save();
  
  // Update followers count
  await User.findByIdAndUpdate(userIdToFollow, { 
    $inc: { followersCount: 1 } 
  });

  res.status(201).json({ message: 'User followed successfully' });
};

export const unfollowUser = async (req, res) => {
  const userIdToUnfollow = req.params.userId;
  
  // Delete follow relationship
  const deleted = await Follow.findOneAndDelete({ 
    follower: req.user._id, 
    following: userIdToUnfollow 
  });
  
  if (!deleted) {
    return res.status(400).json({ message: 'Not following this user' });
  }
  
  // Update followers count
  await User.findByIdAndUpdate(userIdToUnfollow, { 
    $inc: { followersCount: -1 } 
  });

  res.json({ message: 'User unfollowed successfully' });
};

export const getFollowers = async (req, res) => {
  const userId = req.params.userId || req.user._id;
  
  const followers = await Follow.find({ following: userId })
    .populate('follower', 'username fullName avatar bio followersCount')
    .sort({ createdAt: -1 });
  
  res.json(followers.map(f => f.follower));
};

export const getFollowing = async (req, res) => {
  const userId = req.params.userId || req.user._id;
  
  const following = await Follow.find({ follower: userId })
    .populate('following', 'username fullName avatar bio followersCount')
    .sort({ createdAt: -1 });
  
  res.json(following.map(f => f.following));
};

export default { followUser, unfollowUser, getFollowers, getFollowing };