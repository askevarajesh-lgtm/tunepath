const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const User = require('../auth/user.model');

router.use(authMiddleware);

// Get tax settings
router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: { settings: user.taxSettings || { gstPercentage: 18, gstEnabled: false } } });
  } catch (error) {
    next(error);
  }
});

// Update tax settings
router.put('/', async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const updateData = { taxSettings: req.body };

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({ success: true, data: { settings: user.taxSettings } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
