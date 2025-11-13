import Subscription from '../models/subscription.models.js';
import User from '../models/user.models.js';

export const subscribe = async (req, res) => {
  const channelId = req.params.channelId;
  if (req.user._id.equals(channelId)) return res.status(400).json({ message: 'Cannot subscribe to yourself' });

  const exists = await Subscription.findOne({ subscriber: req.user._id, channel: channelId });
  if (exists) return res.status(400).json({ message: 'Already subscribed' });

  const sub = new Subscription({ subscriber: req.user._id, channel: channelId });
  await sub.save();
  await User.findByIdAndUpdate(channelId, { $inc: { subscribersCount: 1 } });
  res.status(201).json({ message: 'Subscribed' });
};

export const unsubscribe = async (req, res) => {
  const channelId = req.params.channelId;
  const deleted = await Subscription.findOneAndDelete({ subscriber: req.user._id, channel: channelId });
  if (!deleted) return res.status(400).json({ message: 'Not subscribed' });
  await User.findByIdAndUpdate(channelId, { $inc: { subscribersCount: -1 } });
  res.json({ message: 'Unsubscribed' });
};

export const getSubscriptions = async (req, res) => {
  const subs = await Subscription.find({ subscriber: req.user._id }).populate('channel', 'name avatarUrl subscribersCount');
  res.json(subs.map(s => s.channel));
};

export default { subscribe, unsubscribe, getSubscriptions };
