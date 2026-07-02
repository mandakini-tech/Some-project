import express from "express";

import {
  registerUser,
  loginUser,
  getUserProfile,
} from "../controllers/userController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Register
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);

// Profile
router.get("/profile", authMiddleware, getUserProfile);

export default router;