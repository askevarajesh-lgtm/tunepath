require('dotenv').config({ override: true });
const app = require('./src/app');
const connectDB = require('./src/config/db');
const startSlaScheduler = require('./src/modules/sla/sla.scheduler');
const startMosScheduler = require('./src/modules/mos/mos.scheduler');
const startReportScheduler = require('./src/modules/reports/report.scheduler');
const startCalendarScheduler = require('./src/modules/calendar/calendar.scheduler');
const seoCronService = require('./src/modules/seoIntelligence/services/cron.service');
const workspaceCronService = require('./src/modules/seoWorkspace/services/workspaceCron.service');
const { startInvoiceCron } = require('./src/modules/invoices/invoiceCron.service');
const semrushRefreshWorker = require('./src/modules/semrush/refresh.job');
const { startLeadSyncScheduler } = require('./src/modules/integrations/leadSync.scheduler');

const PORT = process.env.PORT || 5500;

// Connect to Database
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startSlaScheduler();
    startMosScheduler();
    startReportScheduler();
    startCalendarScheduler();
    const { startCampaignScheduler } = require('./src/modules/campaign-scheduled/campaignScheduled.service');
    startCampaignScheduler();
    seoCronService.start();
    workspaceCronService.start();
    startInvoiceCron();
    semrushRefreshWorker.startCron();
    startLeadSyncScheduler();
  });
});