import express from 'express';
import multer from 'multer';
import { registerUser, loginUser, logoutUser, refreshAccessToken } from "../controllers/user.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Accept multipart/form-data with optional file uploads
router.post("/register", upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]), registerUser);

// Login doesn't need files, so use upload.none()
router.post("/login", upload.none(), loginUser);

router.post("/logout", auth, logoutUser);
router.post("/refresh-token", refreshAccessToken);

export default router;