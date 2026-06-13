import mongoose from 'mongoose';

const KYCSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true,
  },
  wallet_address: {
    type: String,
    required: true,
    lowercase: true,
  },
  full_name: {
    type: String,
    required: true,
  },
  date_of_birth: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  id_type: {
    type: String,
    enum: ['passport', 'drivers_license', 'national_id', 'other'],
    required: true,
  },
  id_number: String,
  document_url: String,
  status: {
    type: String,
    enum: ['unverified', 'pending', 'approved', 'rejected'],
    default: 'pending',
  },
  rejection_reason: String,
  rejection_date: Date,
  submitted_at: {
    type: Date,
    default: Date.now,
  },
  reviewed_at: Date,
  reviewed_by: String,
  ip_address: String,
  user_agent: String,
});

// Index for efficient querying
KYCSchema.index({ user_id: 1 });
KYCSchema.index({ wallet_address: 1 });
KYCSchema.index({ status: 1 });

export const KYC = mongoose.model('KYC', KYCSchema);
