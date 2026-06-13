import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  user_id: {
    type: String,
    unique: true,
    sparse: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  wallet_address: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
  },
  full_name: {
    type: String,
    trim: true,
  },
  avatar_url: String,
  phone: String,
  is_admin: {
    type: Boolean,
    default: false,
  },
  is_organizer: {
    type: Boolean,
    default: false,
  },
  kyc_status: {
    type: String,
    enum: ['unverified', 'pending', 'approved', 'rejected'],
    default: 'unverified',
  },
  last_login: Date,
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  // Email notification tracking
  email_notifications_enabled: {
    type: Boolean,
    default: true,
  },
  last_confirmation_email_sent: {
    type: Date,
    default: null,
  },
  email_sent_count: {
    type: Number,
    default: 0,
  },
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    this.updated_at = new Date();
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.updated_at = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

export const User = mongoose.model('User', UserSchema);
