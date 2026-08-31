const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://askevarajesh_db_user:8VdzZrQ8MwAtuZht@m1local.lp8xr7i.mongodb.net/bcc')
  .then(async () => {
    try {
      const Project = require('./src/modules/projects/project.model.js');
      const { reconcileProjectTaskCounts } = require('./src/modules/projects/project.service.js');

      // Reconcile all projects
      const projects = await Project.find({});
      for (const p of projects) {
        await reconcileProjectTaskCounts(p._id, p.companyId);
        console.log(`Reconciled project SLA: ${p.name}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      console.log('Done');
      process.exit(0);
    }
  });
