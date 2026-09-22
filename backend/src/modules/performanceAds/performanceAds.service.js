const mongoose = require('mongoose');
const PerformanceAd = require('./performanceAds.model');
const Integration = require('../integrations/integration.model');
const axios = require('axios');

// Empty structure to replace mock data for future API integrations
const getEmptyData = () => {
  return {
    metrics: {
      adSpendMTD: 0,
      adSpendPercentage: 0,
      totalLeads: 0,
      leadsChange: '0%',
      costPerLead: 0,
      roas: 0,
      roasChange: '0',
      impressions: 0,
      impressionsChange: '0%'
    },
    activeCampaigns: [],
    dailyPerformance: [],
    spendByPlatform: [],
    cplByPlatform: []
  };
};

const getPerformanceAdsDashboard = async (agencyId) => {
  let dashboard = await PerformanceAd.findOne({ agency: agencyId });

  if (!dashboard) {
    // Perform initial initialization if not exists
    const data = getEmptyData();
    dashboard = new PerformanceAd({
      agency: agencyId,
      ...data
    });
    await dashboard.save();
  }

  return dashboard;
};

// Helper to accurately extract all leads from Meta Graph API actions array
const extractLeadsFromActions = (actions) => {
  if (!actions || !Array.isArray(actions) || actions.length === 0) return 0;

  // 1. Direct standard 'lead' aggregate action from Meta
  const directLead = actions.find(a => a.action_type === 'lead');
  if (directLead && !isNaN(parseInt(directLead.value, 10)) && parseInt(directLead.value, 10) > 0) {
    return parseInt(directLead.value, 10);
  }

  // 2. Direct total lead or lead_grouped action
  const groupedLead = actions.find(a => 
    a.action_type === 'onsite_conversion.total_lead' || 
    a.action_type === 'lead_grouped' ||
    a.action_type === 'onsite_conversion.lead_grouped'
  );
  if (groupedLead && !isNaN(parseInt(groupedLead.value, 10)) && parseInt(groupedLead.value, 10) > 0) {
    // Check if there are also website pixel leads or messaging leads
    const pixelLead = actions.find(a => a.action_type === 'offsite_conversion.fb_pixel_lead');
    const pixelVal = pixelLead && !isNaN(parseInt(pixelLead.value, 10)) ? parseInt(pixelLead.value, 10) : 0;
    return parseInt(groupedLead.value, 10) + pixelVal;
  }

  // 3. Granular sum across standard Meta lead action types without double counting
  let total = 0;
  let hasFound = false;

  actions.forEach(a => {
    const val = parseInt(a.value || 0, 10);
    if (isNaN(val) || val <= 0) return;

    if (
      a.action_type === 'offsite_conversion.fb_pixel_lead' ||
      a.action_type === 'leadgen_grouped' ||
      a.action_type === 'onsite_conversion.lead' ||
      a.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
      a.action_type === 'contact_total' ||
      a.action_type === 'submit_application_total' ||
      a.action_type === 'omni_complete_registration'
    ) {
      total += val;
      hasFound = true;
    }
  });

  if (hasFound && total > 0) return total;

  // 4. Fallback: Any action containing 'lead' or 'leadgen'
  let fallbackTotal = 0;
  actions.forEach(a => {
    const val = parseInt(a.value || 0, 10);
    if (val > 0 && typeof a.action_type === 'string' && (a.action_type.includes('lead') || a.action_type.includes('leadgen'))) {
      fallbackTotal += val;
    }
  });

  return fallbackTotal;
};

const syncPerformanceAds = async (agencyId) => {
  // 1. Check for Meta Integration
  const integration = await Integration.findOne({ companyId: agencyId, type: 'meta_ads', isActive: true });
  
  if (!integration || !integration.config || !integration.config.accessToken) {
    // If not connected, just return what we have (or empty)
    const data = getEmptyData();
    const dashboard = await PerformanceAd.findOneAndUpdate(
      { agency: agencyId },
      { ...data, lastSynced: new Date() },
      { returnDocument: 'after', upsert: true }
    );
    return dashboard;
  }

  const { accessToken, selectedAdAccounts } = integration.config;
  if (!selectedAdAccounts || selectedAdAccounts.length === 0) {
    return await PerformanceAd.findOne({ agency: agencyId }); // Need an ad account selected to fetch data
  }

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalLeads = 0;
  
  let liveCampaigns = [];
  let allDailyData = [];

  // Loop through selected Ad Accounts to fetch insights and campaigns
  try {
    for (const adAccount of selectedAdAccounts) {
      const actId = adAccount.id;

      // Fetch Insights (Last 30 Days)
      const insightsRes = await axios.get(`https://graph.facebook.com/v18.0/${actId}/insights`, {
        params: {
          access_token: accessToken,
          date_preset: 'last_30d',
          fields: 'spend,impressions,clicks,cpm,cpc,actions'
        }
      });

      const insights = insightsRes.data.data[0];
      if (insights) {
        totalSpend += parseFloat(insights.spend || 0);
        totalImpressions += parseInt(insights.impressions || 0, 10);
        totalClicks += parseInt(insights.clicks || 0, 10);
        totalLeads += extractLeadsFromActions(insights.actions);
      }

      // Fetch Daily Insights for Graph (Last 30 Days)
      const dailyInsightsRes = await axios.get(`https://graph.facebook.com/v18.0/${actId}/insights`, {
        params: {
          access_token: accessToken,
          date_preset: 'last_30d',
          time_increment: 1,
          fields: 'spend,clicks,cpc,actions'
        }
      });
      const dailyData = dailyInsightsRes.data.data || [];
      allDailyData = allDailyData.concat(dailyData);

      // Fetch Campaigns with AdSets and Ads (active and recently active with leads/spend)
      const campaignsRes = await axios.get(`https://graph.facebook.com/v18.0/${actId}/campaigns`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,insights{spend,cpc,cpm,ctr,reach,clicks,actions},adsets{id,name,status,daily_budget,lifetime_budget,insights{spend,cpc,cpm,ctr,reach,clicks,actions},ads{id,name,status,insights{spend,cpc,cpm,ctr,reach,clicks,actions}}}',
          limit: 100
        }
      });

      const campaigns = campaignsRes.data.data || [];
      campaigns.forEach(c => {
        const cInsights = c.insights && c.insights.data[0] ? c.insights.data[0] : null;
        const cLeads = extractLeadsFromActions(cInsights?.actions);

        const adSets = (c.adsets && c.adsets.data) ? c.adsets.data.map(adset => ({
          id: adset.id,
          name: adset.name,
          status: adset.status,
          budget: adset.daily_budget ? (parseInt(adset.daily_budget)/100) : (adset.lifetime_budget ? parseInt(adset.lifetime_budget)/100 : 0),
          insights: adset.insights && adset.insights.data[0] ? adset.insights.data[0] : null,
          ads: (adset.ads && adset.ads.data) ? adset.ads.data.map(ad => ({
            id: ad.id,
            name: ad.name,
            status: ad.status,
            insights: ad.insights && ad.insights.data[0] ? ad.insights.data[0] : null
          })) : []
        })) : [];

        const spendVal = cInsights ? parseFloat(cInsights.spend || 0) : 0;
        const cplVal = cLeads > 0 ? (spendVal / cLeads).toFixed(2) : (cInsights && cInsights.cpc ? cInsights.cpc : '0');

        liveCampaigns.push({
          id: c.id,
          campaign: c.name,
          platform: 'Meta',
          status: c.effective_status || c.status || 'ACTIVE',
          budget: c.daily_budget ? (parseInt(c.daily_budget)/100) : (c.lifetime_budget ? parseInt(c.lifetime_budget)/100 : 0),
          spend: spendVal,
          progress: 100,
          leads: cLeads,
          cpl: cplVal,
          roas: '-',
          ctr: cInsights && cInsights.ctr ? cInsights.ctr : '-',
          adAccount: adAccount.name,
          objective: c.objective,
          insights: cInsights,
          adSets
        });
      });
    }

    const data = getEmptyData();
    data.metrics.adSpendMTD = totalSpend;
    data.metrics.impressions = totalImpressions;
    data.metrics.totalLeads = totalLeads;
    data.metrics.costPerLead = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : 0;
    data.metrics.roas = 0; // Not fetching purchases for ROAS calculation yet
    data.activeCampaigns = liveCampaigns;
    
    if (totalSpend > 0) {
      data.spendByPlatform = [{ name: 'Meta', value: totalSpend, fill: '#1877F2' }];
    }

    if (allDailyData.length > 0) {
      const dailyMap = {};
      allDailyData.forEach(d => {
        if (!d.date_start) return;
        const dateStr = d.date_start;
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = { day: dateStr.split('-').slice(1).join('/'), leads: 0, roas: 0, spend: 0 };
        }
        dailyMap[dateStr].spend += parseFloat(d.spend || 0);
        dailyMap[dateStr].leads += extractLeadsFromActions(d.actions); 
      });
      data.dailyPerformance = Object.values(dailyMap).sort((a, b) => a.day.localeCompare(b.day));
    }

    const dashboard = await PerformanceAd.findOneAndUpdate(
      { agency: agencyId },
      { ...data, lastSynced: new Date() },
      { returnDocument: 'after', upsert: true }
    );
    return dashboard;
  } catch (error) {
    console.error("Meta Sync Error: ", error.response?.data || error.message);
    throw new Error('Failed to sync data from Meta');
  }
};

const addCampaign = async (agencyId, campaignData) => {
  let dashboard = await PerformanceAd.findOne({ agency: agencyId });
  if (!dashboard) {
    dashboard = new PerformanceAd({
      agency: agencyId,
      ...getEmptyData()
    });
  }

  const newCampaign = {
    id: new mongoose.Types.ObjectId().toString(),
    campaign: campaignData.campaign,
    platform: campaignData.platform,
    status: campaignData.status,
    budget: campaignData.budget,
    spend: '₹0',
    progress: 0,
    leads: 0,
    cpl: '₹0',
    roas: '-',
    ctr: '0%',
    adAccount: campaignData.adAccount,
    objective: campaignData.objective,
    specialAdCategory: campaignData.specialAdCategory,
    buyingType: campaignData.buyingType,
    budgetType: campaignData.budgetType
  };

  dashboard.activeCampaigns.push(newCampaign);
  await dashboard.save();
  return dashboard;
};

module.exports = {
  getPerformanceAdsDashboard,
  syncPerformanceAds,
  addCampaign
};
