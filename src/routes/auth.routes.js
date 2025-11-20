import express from 'express';
import { registerUser, loginUser, logoutUser, refreshAccessToken } from "../controllers/user.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", auth, logoutUser);
router.post("/refresh-token", refreshAccessToken);

export default router;
