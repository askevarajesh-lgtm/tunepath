const mongoose = require('mongoose');
const SlaRecord = require('./src/modules/sla/sla.model');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tunepath').then(async () => {
  try {
    const result = await SlaRecord.deleteMany({
      entityType: 'Task',
      status: 'Resolved'
    });
    console.log(`Deleted ${result.deletedCount} resolved Task SLAs.`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
