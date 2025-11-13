import PlaylistModel from '../models/playlist.models.js';

export const createPlaylist = async (req, res) => {
  const { title, description } = req.body;
  const pl = new PlaylistModel({ owner: req.user._id, title, description });
  await pl.save();
  res.status(201).json(pl);
};

export const getPlaylist = async (req, res) => {
  const pl = await PlaylistModel.findById(req.params.id).populate('videos');
  if (!pl) return res.status(404).json({ message: 'Not found' });
  res.json(pl);
};

export const addVideo = async (req, res) => {
  const pl = await PlaylistModel.findById(req.params.id);
  if (!pl) return res.status(404).json({ message: 'Playlist not found' });
  if (!pl.owner.equals(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  const videoId = req.body.videoId;
  if (!videoId) return res.status(400).json({ message: 'videoId required' });
  pl.videos.push(videoId);
  await pl.save();
  res.json(pl);
};

export const removeVideo = async (req, res) => {
  const pl = await PlaylistModel.findById(req.params.id);
  if (!pl) return res.status(404).json({ message: 'Playlist not found' });
  if (!pl.owner.equals(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  pl.videos.pull(req.body.videoId);
  await pl.save();
  res.json(pl);
};

export default { createPlaylist, getPlaylist, addVideo, removeVideo };
