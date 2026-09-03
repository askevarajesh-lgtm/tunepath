const TimelineEvent = require('./timeline.model');

exports.getTimelineEvents = async (req, res) => {
  try {
    const { entityType, entityId, page = 1, limit = 50 } = req.query;
    let filter = {};
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;

    const events = await TimelineEvent.find(filter)
      .populate('performedByUserId', 'name email role')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.status(200).json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTimelineEvent = async (req, res) => {
  try {
    const event = await TimelineEvent.create({
      ...req.body,
      performedByUserId: req.user._id
    });
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
