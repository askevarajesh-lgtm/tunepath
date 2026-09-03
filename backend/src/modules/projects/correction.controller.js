const Correction = require('./shimCorrectionModel');
const projectReviewService = require('./project-review.service');

exports.createCorrection = async (req, res, next) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project ID is required' });
    }

    const requestedByType = req.user.role === 'client' ? 'client' : (req.body.requestedByType || 'coordinator');
    const result = await projectReviewService.requestCorrection(
      projectId,
      req.body,
      req.user._id,
      requestedByType
    );

    res.status(201).json({
      success: true,
      message: 'Correction requested successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getCorrections = async (req, res, next) => {
  try {
    const filter = {};
    if (req.params.projectId) {
      filter.projectId = req.params.projectId;
    } else if (req.query.projectId) {
      filter.projectId = req.query.projectId;
    }
    const corrections = await Correction.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: corrections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    const correction = await Correction.findById(req.params.id);
    if (!correction) {
      return res.status(404).json({ success: false, message: 'Correction not found' });
    }
    if (!correction.messages) correction.messages = [];
    correction.messages.push({
      sender: req.user._id,
      text: message,
      createdAt: new Date()
    });
    await correction.save();
    res.status(200).json({ success: true, data: correction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const correction = await Correction.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' });
    if (!correction) {
      return res.status(404).json({ success: false, message: 'Correction not found' });
    }
    res.status(200).json({ success: true, data: correction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteCorrection = async (req, res, next) => {
  try {
    const correction = await Correction.findByIdAndDelete(req.params.id);
    if (!correction) {
      return res.status(404).json({ success: false, message: 'Correction not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
