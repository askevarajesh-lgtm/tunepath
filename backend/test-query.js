const mongoose = require('mongoose');
const { resolveProjectListQueryOptions } = require('./src/modules/projects/project.service.js');
async function test() {
  const q = await resolveProjectListQueryOptions(
    new mongoose.Types.ObjectId('60d0fe4f5311236168a10000'), 
    { subAgencyId: new mongoose.Types.ObjectId('60d0fe4f5311236168a20000') },
    'sub_agency_super_admin',
    new mongoose.Types.ObjectId('60d0fe4f5311236168a30000')
  );
  console.log(JSON.stringify(q.queryOptions, null, 2));
  process.exit(0);
}
test();
