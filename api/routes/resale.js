import express from 'express';
import { ResaleListing } from '../models/ResaleListing.js';

const router = express.Router();

// GET all resale listings with optional filtering
router.get('/', async (req, res) => {
  try {
    const { status, seller, event_id } = req.query;
    const filter = {};

    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    if (seller) {
      filter.seller = seller.toLowerCase();
    }

    if (event_id) {
      filter.event_id = parseInt(event_id);
    }

    const listings = await ResaleListing.find(filter).select('-__v').sort({ created_at: -1 });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET resale listing by ID
router.get('/:id', async (req, res) => {
  try {
    const listing = await ResaleListing.findById(req.params.id).select('-__v');
    if (!listing) {
      return res.status(404).json({ error: 'Resale listing not found' });
    }
    res.json(listing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET listings by seller
router.get('/seller/:seller', async (req, res) => {
  try {
    const listings = await ResaleListing.find({
      seller: req.params.seller.toLowerCase(),
    }).select('-__v').sort({ created_at: -1 });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create resale listing
router.post('/', async (req, res) => {
  try {
    const { token_id, event_id, seller, price, original_price } = req.body;

    if (!token_id || !event_id || !seller || !price) {
      return res.status(400).json({
        error: 'Missing required fields: token_id, event_id, seller, price',
      });
    }

    // Check if token is already listed for resale
    const existingListing = await ResaleListing.findOne({
      token_id,
      seller: seller.toLowerCase(),
      status: 'active',
    });

    if (existingListing) {
      return res.status(409).json({ error: 'Token already listed for resale' });
    }

    const listing = new ResaleListing({
      token_id,
      event_id,
      seller: seller.toLowerCase(),
      price,
      original_price,
    });

    await listing.save();
    res.status(201).json(listing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update resale listing
router.put('/:id', async (req, res) => {
  try {
    const listing = await ResaleListing.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select('-__v');

    if (!listing) {
      return res.status(404).json({ error: 'Resale listing not found' });
    }

    res.json(listing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT mark listing as sold
router.put('/:id/sold', async (req, res) => {
  try {
    const { buyer, transaction_hash } = req.body;

    if (!buyer) {
      return res.status(400).json({ error: 'Buyer address is required' });
    }

    const listing = await ResaleListing.findByIdAndUpdate(
      req.params.id,
      {
        status: 'sold',
        buyer: buyer.toLowerCase(),
        transaction_hash,
        sold_at: new Date(),
      },
      { new: true }
    ).select('-__v');

    if (!listing) {
      return res.status(404).json({ error: 'Resale listing not found' });
    }

    res.json(listing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT cancel resale listing
router.put('/:id/cancel', async (req, res) => {
  try {
    const { cancellation_reason } = req.body;

    const listing = await ResaleListing.findByIdAndUpdate(
      req.params.id,
      {
        status: 'cancelled',
        cancellation_reason,
      },
      { new: true }
    ).select('-__v');

    if (!listing) {
      return res.status(404).json({ error: 'Resale listing not found' });
    }

    res.json(listing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE resale listing
router.delete('/:id', async (req, res) => {
  try {
    const listing = await ResaleListing.findByIdAndDelete(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Resale listing not found' });
    }
    res.json({ success: true, message: 'Resale listing deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
