const cron = require('node-cron');
const axios = require('axios');
const Integration = require('./integration.model');
const Lead = require('../leads/lead.model');

/**
 * Lead Sync Scheduler
 * Runs every 5 minutes (cron: every 5 min)
 * For every active facebook_leads integration that has selected forms configured,
 * it fetches new leads from Facebook and inserts them into the CRM with full client isolation.
 */
const syncFacebookIntegrationLeads = async (integration) => {
  try {
    const { companyId, clientId, ownerId } = integration;
    const config = integration.config || {};
    const { accessToken, pages = [] } = config;

    if (!accessToken) return;

    for (const page of pages) {
      const selectedForms = page.selectedForms || [];
      if (!selectedForms || selectedForms.length === 0) continue;

      let targetAccessToken = page.accessToken;
      if (!targetAccessToken || !targetAccessToken.startsWith('EAA') || targetAccessToken.length < 50) {
        try {
          const accountsRes = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
            params: { access_token: accessToken, fields: 'id,access_token' },
            timeout: 10000
          });
          if (accountsRes.data && accountsRes.data.data) {
            const match = accountsRes.data.data.find(a => a.id === page.pageId);
            if (match && match.access_token) {
              targetAccessToken = match.access_token;
              page.accessToken = match.access_token;
            }
          }
        } catch (tokenErr) {}
      }
      if (!targetAccessToken) {
        targetAccessToken = accessToken;
      }

      for (const formId of selectedForms) {
        try {
          // Fetch form details if needed to get form name
          let formName = 'Facebook Lead Form';
          try {
            const formDetailRes = await axios.get(`https://graph.facebook.com/v18.0/${formId}`, {
              params: { access_token: targetAccessToken, fields: 'id,name' },
              timeout: 10000
            });
            if (formDetailRes.data && formDetailRes.data.name) {
              formName = formDetailRes.data.name;
            }
          } catch (e) {}

          let hasNextPage = true;
          let url = `https://graph.facebook.com/v18.0/${formId}/leads`;
          // Only fetch leads from the last 7 days to prevent fetching thousands of old leads and timing out.
          // If we have a lastSyncAt, we fetch from 12 hours before that to ensure we catch any missed leads.
          let sinceUnix = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
          if (page.lastSyncAt) {
            let lastSync = Math.floor(new Date(page.lastSyncAt).getTime() / 1000) - (12 * 60 * 60);
            if (lastSync > sinceUnix) {
              sinceUnix = lastSync;
            }
          }

          let leadsParams = {
            access_token: targetAccessToken,
            fields: 'id,created_time,ad_id,form_id,field_data,adset_id,campaign_id',
            limit: 100,
            since: sinceUnix
          };

          let newLeadsCount = 0;

          while (hasNextPage) {
            const leadsRes = await axios.get(url, { params: leadsParams, timeout: 15000 });

            if (leadsRes.data && leadsRes.data.data && leadsRes.data.data.length > 0) {
              for (const fbLead of leadsRes.data.data) {
                const leadgenId = fbLead.id;

                const existingLead = await Lead.findOne({
                  companyId,
                  'customData.leadgenId': leadgenId
                });

                if (existingLead) {
                  // Ensure client binding if not set
                  if (clientId && !existingLead.clientId) {
                    existingLead.clientId = clientId;
                    existingLead.isClientLead = true;
                    await existingLead.save();
                  }
                  continue;
                }

                let fullName = 'Facebook Lead';
                let email = '';
                let phoneNumber = '';
                let companyName = '';

                if (Array.isArray(fbLead.field_data)) {
                  fbLead.field_data.forEach(field => {
                    const name = (field.name || '').toLowerCase();
                    const val = field.values && field.values.length > 0 ? field.values[0] : '';

                    if (name === 'full_name' || name === 'name' || name === 'first_name') fullName = val;
                    else if (name === 'email') email = val;
                    else if (name === 'phone_number' || name === 'phone') phoneNumber = val;
                    else if (name === 'company_name' || name === 'company') companyName = val;
                  });
                }

                await Lead.create({
                  companyId,
                  createdBy: companyId,
                  clientId: clientId || null,
                  isClientLead: !!clientId,
                  ownerId: ownerId || null,
                  fullName: fullName || 'Unknown',
                  email,
                  phoneNumber,
                  companyName,
                  source: 'Facebook Lead Ads',
                  status: 'new',
                  createdAt: fbLead.created_time ? new Date(fbLead.created_time) : Date.now(),
                  customData: {
                    leadgenId,
                    formId,
                    formName,
                    pageId: page.pageId,
                    adId: fbLead.ad_id,
                    adSetId: fbLead.adset_id,
                    campaignId: fbLead.campaign_id,
                    createdTime: fbLead.created_time
                  },
                  activityLogs: [{ message: 'Imported via 5-Minute Facebook Auto-Sync' }]
                });

                newLeadsCount++;
              }

              if (leadsRes.data.paging && leadsRes.data.paging.next) {
                url = leadsRes.data.paging.next;
                leadsParams = {};
              } else {
                hasNextPage = false;
              }
            } else {
              hasNextPage = false;
            }
          }

          if (newLeadsCount > 0) {
            console.log(`[Lead AutoSync] Successfully imported ${newLeadsCount} new leads for form ${formName} (${formId}) - Page: ${page.pageName || page.pageId}`);
          }
        } catch (formErr) {
          console.error(`[Lead AutoSync] Error syncing form ${formId}:`, formErr.response?.data?.error?.message || formErr.message);
        }
      }

      page.lastSyncAt = new Date();
    }

    integration.markModified('config');
    await integration.save();
  } catch (err) {
    console.error(`[Lead AutoSync] Error processing integration ${integration._id}:`, err.message);
  }
};

const runLeadSyncJob = async () => {
  try {
    const activeIntegrations = await Integration.find({
      type: 'facebook_leads',
      isActive: true
    });

    if (!activeIntegrations || activeIntegrations.length === 0) return;

    for (const integration of activeIntegrations) {
      await syncFacebookIntegrationLeads(integration);
    }
  } catch (error) {
    console.error('[Lead AutoSync] Scheduler execution error:', error.message);
  }
};

const startLeadSyncScheduler = () => {
  // Run every 1 minute
  cron.schedule('*/1 * * * *', async () => {
    console.log('[Lead AutoSync] Starting 1-minute recurring lead sync check...');
    await runLeadSyncJob();
  });
  console.log('[Lead AutoSync] 1-minute Facebook Lead Sync Scheduler initialized.');
};

module.exports = {
  startLeadSyncScheduler,
  runLeadSyncJob,
  syncFacebookIntegrationLeads
};
