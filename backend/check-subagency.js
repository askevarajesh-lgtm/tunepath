const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/tunepath').then(async () => {
  const Project = require('./src/modules/projects/project.model');
  const projects = await Project.find({ subAgencyId: { $ne: null } }).select('name companyId subAgencyId status isActive').lean();
  console.log(projects);
  process.exit(0);
});
