const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { dbState } = require('../Config/db');

// JWT Generator
const generateToken = (userId) => {
  return jwt.sign(
    { user: { id: userId } },
    process.env.JWT_SECRET || 'supersecretjwtkeyforinvestorriskanalyzer',
    { expiresIn: '7d' }
  );
};

// Register User
exports.registerUser = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  try {
    if (dbState.isFallback) {
      // JSON Fallback Flow
      const data = dbState.readFallbackData();
      const existingUser = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ msg: 'User already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = {
        id: `user_${Date.now()}`,
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString()
      };

      data.users.push(newUser);
      dbState.writeFallbackData(data);

      const token = generateToken(newUser.id);
      return res.status(201).json({ token, user: { id: newUser.id, username } });

    } else {
      // MongoDB Flow
      let user = await User.findOne({ username });
      if (user) {
        return res.status(400).json({ msg: 'User already exists' });
      }

      user = new User({ username, password });

      // Hash password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      await user.save();

      const token = generateToken(user.id);
      return res.status(201).json({ token, user: { id: user.id, username } });
    }
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).send('Server error during registration');
  }
};

// Login User
exports.loginUser = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  try {
    if (dbState.isFallback) {
      // JSON Fallback Flow
      const data = dbState.readFallbackData();
      const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) {
        return res.status(400).json({ msg: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: 'Invalid credentials' });
      }

      const token = generateToken(user.id);
      return res.json({ token, user: { id: user.id, username } });

    } else {
      // MongoDB Flow
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(400).json({ msg: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: 'Invalid credentials' });
      }

      const token = generateToken(user.id);
      return res.json({ token, user: { id: user.id, username } });
    }
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).send('Server error during login');
  }
};

// Get User Profile
exports.getUserProfile = async (req, res) => {
  try {
    if (dbState.isFallback) {
      const data = dbState.readFallbackData();
      const user = data.users.find(u => u.id === req.user.id);
      if (!user) {
        return res.status(404).json({ msg: 'User not found' });
      }
      return res.json({ id: user.id, username: user.username });
    } else {
      const user = await User.findById(req.user.id).select('-password');
      if (!user) {
        return res.status(404).json({ msg: 'User not found' });
      }
      return res.json(user);
    }
  } catch (err) {
    console.error('Get profile error:', err.message);
    res.status(500).send('Server error fetching profile');
  }
};
