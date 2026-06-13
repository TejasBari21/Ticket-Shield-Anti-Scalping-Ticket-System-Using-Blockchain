import express from 'express';
import { KYC } from '../models/KYC.js';

const router = express.Router();

// GET all KYC submissions
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    const kyc = await KYC.find(filter).select('-__v');
    res.json(kyc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET KYC by ID
router.get('/:id', async (req, res) => {
  try {
    const kyc = await KYC.findById(req.params.id).select('-__v');
    if (!kyc) {
      return res.status(404).json({ error: 'KYC submission not found' });
    }
    res.json(kyc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET KYC by user ID
router.get('/user/:userId', async (req, res) => {
  try {
    const kyc = await KYC.findOne({ user_id: req.params.userId }).select('-__v');
    if (!kyc) {
      return res.status(404).json({ error: 'KYC submission not found' });
    }
    res.json(kyc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST submit KYC
router.post('/', async (req, res) => {
  try {
    const { user_id, wallet_address, full_name, date_of_birth, country, id_type } = req.body;

    if (!user_id || !wallet_address || !full_name || !date_of_birth || !country || !id_type) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, wallet_address, full_name, date_of_birth, country, id_type',
      });
    }

    // Check if KYC already exists for this user
    const existingKYC = await KYC.findOne({ user_id });
    if (existingKYC) {
      return res.status(409).json({ error: 'KYC submission already exists for this user' });
    }

    const kyc = new KYC({
      user_id,
      wallet_address,
      full_name,
      date_of_birth,
      country,
      id_type,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    await kyc.save();
    res.status(201).json(kyc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update KYC status (admin)
router.put('/:id/status', async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;

    if (!['unverified', 'pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const update = {
      status,
      reviewed_at: new Date(),
    };

    if (status === 'rejected' && rejection_reason) {
      update.rejection_reason = rejection_reason;
      update.rejection_date = new Date();
    }

    const kyc = await KYC.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).select('-__v');

    if (!kyc) {
      return res.status(404).json({ error: 'KYC submission not found' });
    }

    res.json(kyc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT bulk update KYC status (admin)
router.put('/bulk/update-status', async (req, res) => {
  try {
    const { ids, status, rejection_reason } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids' });
    }

    const update = {
      status,
      reviewed_at: new Date(),
    };

    if (status === 'rejected' && rejection_reason) {
      update.rejection_reason = rejection_reason;
      update.rejection_date = new Date();
    }

    const result = await KYC.updateMany({ _id: { $in: ids } }, update);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE KYC
router.delete('/:id', async (req, res) => {
  try {
    const kyc = await KYC.findByIdAndDelete(req.params.id);
    if (!kyc) {
      return res.status(404).json({ error: 'KYC submission not found' });
    }
    res.json({ success: true, message: 'KYC submission deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
