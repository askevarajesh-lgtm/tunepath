const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tunepath').then(async () => {
  try {
    const db = mongoose.connection.db;
    const companies = await db.collection('companies').find({ 
      _id: { 
        $in: [
          new mongoose.Types.ObjectId('6a868ed040f17bb4cea55373'), 
          new mongoose.Types.ObjectId('6a86a2ac40f17bb4cea5537d')
        ] 
      } 
    }).toArray();
    console.log('Companies:', companies.map(c => ({ id: c._id, name: c.name, type: c.companyType, agencyId: c.agencyId })));
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
});
