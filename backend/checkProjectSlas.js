const mongoose = require('mongoose');
const SlaRecord = require('./src/modules/sla/sla.model');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tunepath').then(async () => {
  try {
    const slas = await SlaRecord.find({ entityType: 'Project' }).populate('clientId', 'name companyName').populate('agencyId', 'name companyName').limit(5);
    console.log(JSON.stringify(slas, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
