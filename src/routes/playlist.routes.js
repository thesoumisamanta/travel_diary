import express from 'express';
import auth from '../middlewares/auth.js';
import Playlist from '../controllers/playlist.controller.js';

const router = express.Router();


router.post('/', auth, Playlist.createPlaylist);
router.get('/:id', Playlist.getPlaylist);
router.post('/:id/add', auth, Playlist.addVideo);
router.post('/:id/remove', auth, Playlist.removeVideo);

export default router;
