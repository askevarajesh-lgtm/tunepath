const mongoose = require('mongoose');
const Lead = require('./src/modules/leads/lead.model');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const leads = await Lead.find({ 'customData.createdTime': { $exists: true } });
  let count = 0;
  for (let lead of leads) {
    if (lead.customData.createdTime) {
      const actualTime = new Date(lead.customData.createdTime);
      if (!isNaN(actualTime.getTime())) {
        await Lead.updateOne({ _id: lead._id }, { $set: { createdAt: actualTime } });
        count++;
      }
    }
  }
  console.log(`Successfully backfilled createdAt for ${count} leads.`);
  process.exit(0);
  
  process.exit(0);
}

run();
