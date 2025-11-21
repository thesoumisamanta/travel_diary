import mongoose from 'mongoose';

const playlistSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
  isPublic: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Playlist', playlistSchema);
