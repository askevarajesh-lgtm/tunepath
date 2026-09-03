const TimelineEvent = require('./timeline.model');

module.exports = {
  createTimelineEvent: async (data) => {
    try {
      return await TimelineEvent.create(data);
    } catch (err) {
      console.error('Error creating timeline event:', err.message);
    }
  },
  getTimelineEvents: async (filter) => {
    try {
      return await TimelineEvent.find(filter).sort({ createdAt: -1 });
    } catch (err) {
      return [];
    }
  }
};
