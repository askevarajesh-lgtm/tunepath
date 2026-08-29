const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const User = require('../auth/user.model');

router.use(authMiddleware);

// Get current agency profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Update current agency profile
router.put('/profile', async (req, res) => {
  try {
    const { companyName, name, email, logo, logoDark, invoiceSignature, taxSettings } = req.body;
    const userId = req.user._id || req.user.id;
    
    const updateData = { companyName, name, email, logo, logoDark, invoiceSignature };
    if (taxSettings !== undefined) {
      updateData.taxSettings = taxSettings;
    }
    if (req.body.theme !== undefined) {
      updateData.theme = req.body.theme;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;
