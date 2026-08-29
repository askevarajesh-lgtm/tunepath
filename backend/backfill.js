const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tunepath').then(async () => {
  const Package = require('./src/modules/packages/package.model');
  const { SUPPORTED_INTEGRATIONS } = require('./src/utils/supportedIntegrations');
  
  await Package.updateMany(
    { $or: [{ integrations: { $exists: false } }, { integrations: { $size: 0 } }] },
    { $set: { integrations: SUPPORTED_INTEGRATIONS } }
  );
  
  console.log('Successfully backfilled packages with integrations.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
