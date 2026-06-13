import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ticketshield_dev_secret_key_12345';

// GET all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-__v -password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET user by ID
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-__v -password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET user by wallet address
router.get('/wallet/:walletAddress', async (req, res) => {
  try {
    const user = await User.findOne({ wallet_address: req.params.walletAddress }).select('-__v -password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST verify user credentials (login)
router.post('/verify', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.log(`❌ Login failed: User not found for email ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log(`❌ Login failed: Invalid password for ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log(`✅ Login successful for ${email}`);

    // Update last login
    user.last_login = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        is_admin: user.is_admin,
        wallet_address: user.wallet_address,
      },
      JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days
    );

    // Return user with token
    const userObj = user.toObject();
    delete userObj.password;
    
    res.json({
      token,
      user: userObj,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create user
router.post('/', async (req, res) => {
  try {
    const { email, password, wallet_address, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { wallet_address }],
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = new User({
      email: email.toLowerCase().trim(),
      password,
      wallet_address,
      full_name: full_name || '',
    });

    await user.save();
    
    // Return user without password
    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json(userObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update user
router.put('/:userId', async (req, res) => {
  try {
    // Don't allow password updates through this endpoint
    const { password, ...updateData } = req.body;

    const user = await User.findByIdAndUpdate(req.params.userId, updateData, {
      new: true,
      runValidators: true,
    }).select('-__v -password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE user
router.delete('/:userId', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
