const mongoose = require('mongoose');
const SlaRecord = require('./src/modules/sla/sla.model');
const Project = require('./src/modules/projects/project.model');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tunepath').then(async () => {
  try {
    const slas = await SlaRecord.find({ entityType: 'Project' });
    let updatedCount = 0;
    
    for (const sla of slas) {
      const project = await Project.findById(sla.entityId);
      if (project) {
        let updated = false;
        
        // Correct the clientId and agencyId mappings
        if (String(sla.clientId) !== String(project.clientId)) {
          sla.clientId = project.clientId;
          updated = true;
        }
        if (String(sla.agencyId) !== String(project.companyId)) {
          sla.agencyId = project.companyId;
          updated = true;
        }
        
        if (updated) {
          await sla.save();
          updatedCount++;
        }
      }
    }
    console.log(`Updated ${updatedCount} Project SLA records.`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
