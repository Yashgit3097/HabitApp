import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { collections } from '../../config/db.js';
import { processUploadedFile } from '../../middleware/uploadMiddleware.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_habit_tracker_jwt_key_2026_secure');
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, username, and password' });
    }

    // Check if username already exists
    const existingUser = await collections.users.findOne({ username: username.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username is already taken' });
    }

    // Process Avatar if uploaded
    let avatarUrl = '';
    if (req.file) {
      avatarUrl = await processUploadedFile(req.file, req);
    } else {
      // Default dicebear avatar
      avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username.trim())}`;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await collections.users.insertOne({
      name: name.trim(),
      username: username.toLowerCase().trim(),
      password: hashedPassword,
      avatar: avatarUrl,
      bio: req.body.bio || 'Building positive habits every day 🚀',
      createdAt: new Date().toISOString()
    });

    const token = generateToken(newUser.id || newUser._id);

    const { password: _, ...userResponse } = newUser;

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please provide username and password' });
    }

    const user = await collections.users.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = generateToken(user.id || user._id);
    const { password: _, ...userResponse } = user;

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error during login', error: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await collections.users.findById(req.user.id || req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { password: _, ...userResponse } = user;
    res.status(200).json({
      success: true,
      data: userResponse
    });
  } catch (error) {
    console.error('Get Me Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving profile' });
  }
};

// @desc    Update user profile & avatar
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const updates = {};

    if (req.body.name) updates.name = req.body.name.trim();
    if (req.body.bio !== undefined) updates.bio = req.body.bio.trim();

    if (req.file) {
      updates.avatar = await processUploadedFile(req.file, req);
    }

    const updatedUser = await collections.users.updateOne({ id: userId }, updates);
    const { password: _, ...userResponse } = updatedUser;

    // Sync updated avatar & name across all groups the user is a member of
    try {
      const allGroups = await collections.groups.find();
      for (const group of allGroups) {
        if (group.members && group.members.some((m) => (m.userId || m.userId?.toString()) === userId.toString())) {
          const newMembers = group.members.map((m) => {
            if ((m.userId || m.userId?.toString()) === userId.toString()) {
              return {
                ...m,
                name: updates.name || m.name,
                avatar: updates.avatar || m.avatar
              };
            }
            return m;
          });
          await collections.groups.updateOne({ id: group.id || group._id }, { members: newMembers });

          if (req.io) {
            req.io.to(`group:${group.id || group._id}`).emit('group_habit_updated', {
              groupId: group.id || group._id
            });
          }
        }
      }

      // Also update creator avatar in habits
      if (updates.avatar || updates.name) {
        const habitUpdates = {};
        if (updates.avatar) habitUpdates.creatorAvatar = updates.avatar;
        if (updates.name) habitUpdates.creatorName = updates.name;
        const userHabits = await collections.habits.find({ userId: userId.toString() });
        for (const h of userHabits) {
          await collections.habits.updateOne({ id: h.id || h._id }, habitUpdates);
        }
      }
    } catch (syncErr) {
      console.error('Error syncing profile update to groups & habits:', syncErr);
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: userResponse
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
};
