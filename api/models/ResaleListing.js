import mongoose from 'mongoose';

const ResaleListingSchema = new mongoose.Schema({
  token_id: {
    type: Number,
    required: true,
  },
  event_id: {
    type: Number,
    required: true,
  },
  seller: {
    type: String,
    required: true,
    lowercase: true,
  },
  buyer: {
    type: String,
    lowercase: true,
    sparse: true,
  },
  price: {
    type: String,
    required: true,
  },
  original_price: String,
  platform_fee: {
    type: String,
    default: '0',
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'cancelled'],
    default: 'active',
  },
  cancellation_reason: String,
  transaction_hash: String,
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  sold_at: Date,
});

// Indexes for efficient querying
ResaleListingSchema.index({ seller: 1 });
ResaleListingSchema.index({ event_id: 1 });
ResaleListingSchema.index({ token_id: 1 });
ResaleListingSchema.index({ status: 1 });
ResaleListingSchema.index({ created_at: -1 });

ResaleListingSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const ResaleListing = mongoose.model('ResaleListing', ResaleListingSchema);
