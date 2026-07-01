const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// @route   POST api/users/register
// @desc    Register a user
// @access  Public
router.post('/register', userController.registerUser);

// @route   POST api/users/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', userController.loginUser);

// @route   GET api/users/profile
// @desc    Get user profile data
// @access  Private
router.get('/profile', authMiddleware, userController.getUserProfile);

module.exports = router;
