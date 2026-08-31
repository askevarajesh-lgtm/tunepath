const Integration = require('./integration.model');
const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const META_APP_ID = process.env.META_APP_ID || 'dummy_app_id';
const META_APP_SECRET = process.env.META_SECRET || process.env.META_APP_SECRET || 'dummy_app_secret';
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:5500'}/api/facebook/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const getClientContext = (req) => {
  const companyId = req.companyId || (req.user && (req.user.agencyId || req.user.workspaceId || req.user.agency));
  let clientId = null;
  if (req.isClientRole && req.clientUserId) {
    clientId = req.clientUserId.toString();
  } else if (req.selectedClientId) {
    clientId = req.selectedClientId.toString();
  } else if (req.query && req.query.clientId) {
    clientId = req.query.clientId;
  } else if (req.body && req.body.clientId) {
    clientId = req.body.clientId;
  }
  return { companyId, clientId };
};

exports.generateAuthUrl = async (req, res, next) => {
  try {
    const { token, redirectPath, clientId: queryClientId } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Missing token in query parameters' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_12345');
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    let companyId = decoded.agencyId || decoded.brandId || decoded.workspaceId;
    let clientId = queryClientId || null;
    const isClientRole = ['client', 'agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user'].includes(decoded.role) || (decoded.role === 'user' && decoded.brandId);
    if (!clientId && isClientRole) {
      clientId = decoded.clientId || decoded.brandId || decoded._id;
    }

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID missing from user token' });
    }

    // Embed companyId, clientId, redirectPath, and userId in the state parameter
    const stateObj = { companyId, clientId, redirectPath, userId: decoded._id };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
    const scopes = ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'pages_manage_ads', 'leads_retrieval', 'ads_read', 'business_management', 'pages_read_user_content'].join(',');
    
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&state=${state}&scope=${scopes}`;
    
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
};

exports.handleCallback = async (req, res, next) => {
  let redirectPath = '/settings/integrations/website';
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      const separator = redirectPath.includes('?') ? '&' : '?';
      return res.redirect(`${FRONTEND_URL}${redirectPath}${separator}facebook_oauth=error&reason=Missing code or state`);
    }

    let stateObj;
    try {
      stateObj = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      if (stateObj.redirectPath) redirectPath = stateObj.redirectPath;
    } catch (e) {
      const separator = redirectPath.includes('?') ? '&' : '?';
      return res.redirect(`${FRONTEND_URL}${redirectPath}${separator}facebook_oauth=error&reason=Invalid state`);
    }

    const companyId = stateObj.companyId;
    const clientId = stateObj.clientId || null;
    const ownerId = stateObj.userId || null;

    // 1. Exchange code for short-lived token
    const tokenRes = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
      params: {
        client_id: META_APP_ID,
        redirect_uri: META_REDIRECT_URI,
        client_secret: META_APP_SECRET,
        code
      }
    });

    let accessToken = tokenRes.data.access_token;

    // 2. Exchange for long-lived token
    const longLivedRes = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: accessToken
      }
    });

    accessToken = longLivedRes.data.access_token;
    const expiresIn = longLivedRes.data.expires_in || 5184000;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 3. Get User ID and Pages
    const meRes = await axios.get(`https://graph.facebook.com/v18.0/me`, {
      params: { access_token: accessToken }
    });
    const userId = meRes.data.id;

    let discoveredPages = [];
    try {
      const accountsRes = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,access_token',
          limit: 100
        }
      });
      if (accountsRes.data && accountsRes.data.data) {
        discoveredPages = accountsRes.data.data.map(page => ({
          pageId: page.id,
          pageName: page.name,
          accessToken: page.access_token,
          selectedForms: [],
          lastSyncAt: null,
          autoSync: true
        }));
      }
    } catch (err) {
      console.error('Error fetching /me/accounts during callback:', err.message);
    }

    // Automatically subscribe discovered pages to webhook
    for (const p of discoveredPages) {
      try {
        await axios.post(
          `https://graph.facebook.com/v18.0/${p.pageId}/subscribed_apps`,
          null,
          {
            params: {
              access_token: p.accessToken || accessToken,
              subscribed_fields: 'leadgen'
            }
          }
        );
      } catch (e) {}
    }

    // 4. Determine pages claimed by other client integrations to avoid cross-client leakage
    const otherIntegrations = await Integration.find({
      companyId,
      type: 'facebook_leads',
      isActive: true,
      ...(clientId ? { clientId: { $ne: clientId } } : { clientId: { $ne: null } })
    }).lean();

    const claimedPageIds = new Set();
    otherIntegrations.forEach(intg => {
      const disconnected = intg.config?.disconnectedPages || [];
      const pages = intg.config?.pages || [];
      pages.forEach(p => {
        if (p.pageId && !disconnected.includes(p.pageId)) {
          claimedPageIds.add(p.pageId);
        }
      });
    });

    const clientPages = discoveredPages.filter(p => !claimedPageIds.has(p.pageId));

    const filter = { companyId, clientId: clientId || null, type: 'facebook_leads' };
    const existingIntegration = await Integration.findOne(filter);
    
    let mergedPages = clientPages;
    if (existingIntegration && existingIntegration.config?.pages && existingIntegration.config.pages.length > 0) {
      const existingPages = existingIntegration.config.pages;
      mergedPages = clientPages.map(dp => {
        const match = existingPages.find(ep => ep.pageId === dp.pageId);
        return {
          ...dp,
          selectedForms: match?.selectedForms || [],
          lastSyncAt: match?.lastSyncAt || null,
          autoSync: match?.autoSync !== false
        };
      });
    }

    await Integration.findOneAndUpdate(
      filter,
      {
        name: 'Facebook Leads Integration',
        isActive: true,
        ownerId,
        config: {
          accessToken,
          userId,
          pages: mergedPages,
          selectedForms: existingIntegration?.config?.selectedForms || [],
          expiresAt,
          disconnectedPages: existingIntegration?.config?.disconnectedPages || []
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    const separator = redirectPath.includes('?') ? '&' : '?';
    res.redirect(`${FRONTEND_URL}${redirectPath}${separator}facebook_oauth=success`);
  } catch (error) {
    console.error('Facebook Callback Error:', error.response?.data || error.message);
    const separator = redirectPath.includes('?') ? '&' : '?';
    res.redirect(`${FRONTEND_URL}${redirectPath}${separator}facebook_oauth=error`);
  }
};

exports.getIntegrations = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const query = { companyId, clientId: clientId || null, type: 'facebook_leads', isActive: true };
    
    const integration = await Integration.findOne(query).sort({ updatedAt: -1 });
    
    if (!integration || !integration.config || !integration.config.accessToken) {
      return res.status(200).json({ success: true, data: { isConnected: false, integrations: [] } });
    }

    const { accessToken } = integration.config;
    
    // Fetch live pages from Meta
    let activePages = [];
    try {
      const pagesRes = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,access_token',
          limit: 100
        }
      });
      activePages = pagesRes.data.data || [];
    } catch (err) {
      console.error('Error fetching /me/accounts, continuing with saved pages:', err.message);
    }

    // Determine pages claimed by other active client integrations
    const otherIntegrations = await Integration.find({
      companyId,
      type: 'facebook_leads',
      isActive: true,
      _id: { $ne: integration._id }
    }).lean();

    const claimedPageIds = new Set();
    otherIntegrations.forEach(intg => {
      const disconnected = intg.config?.disconnectedPages || [];
      const pages = intg.config?.pages || [];
      pages.forEach(p => {
        if (p.pageId && !disconnected.includes(p.pageId)) {
          claimedPageIds.add(p.pageId);
        }
      });
    });

    const disconnectedPages = integration.config.disconnectedPages || [];
    const savedPages = integration.config.pages || [];

    // Strictly prioritize pages saved specifically for this client integration
    let candidatePages = [];
    if (savedPages && savedPages.length > 0) {
      candidatePages = savedPages;
    } else {
      candidatePages = activePages.map(p => ({
        pageId: p.id,
        pageName: p.name,
        accessToken: p.access_token,
        selectedForms: [],
        lastSyncAt: null,
        autoSync: true
      }));
    }

    const integrations = candidatePages
      .filter(p => p.pageId && !disconnectedPages.includes(p.pageId) && !claimedPageIds.has(p.pageId))
      .map(p => {
        const liveMatch = activePages.find(ap => ap.id === p.pageId);
        return {
          pageId: p.pageId,
          pageName: p.pageName || liveMatch?.name || 'Facebook Page',
          integrationStatus: 'active',
          lastSyncAt: p.lastSyncAt || integration.updatedAt,
          selectedForms: p.selectedForms || integration.config.selectedForms || [],
          autoSync: p.autoSync !== false
        };
      });

    res.status(200).json({
      success: true,
      data: { isConnected: true, integrations }
    });
  } catch (error) {
    console.error('Fetch Facebook Pages Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Error fetching integrations" });
  }
};

exports.subscribePage = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const { pageId } = req.body;
    
    if (!pageId) return res.status(400).json({ success: false, message: 'pageId is required' });

    const integration = await Integration.findOne({ companyId, clientId: clientId || null, type: 'facebook_leads', isActive: true });
    if (!integration || !integration.config || !integration.config.accessToken) {
      return res.status(404).json({ success: false, message: 'Facebook integration not found' });
    }

    const { accessToken } = integration.config;
    
    let pageAccessToken = null;
    const manualPage = (integration.config.pages || []).find(p => p.pageId === pageId);
    
    if (manualPage && manualPage.accessToken && manualPage.accessToken !== accessToken) {
      pageAccessToken = manualPage.accessToken;
    } else {
      try {
        const pageRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
          params: { access_token: accessToken, fields: 'id,access_token' }
        });
        if (pageRes.data && pageRes.data.access_token) {
          pageAccessToken = pageRes.data.access_token;
        }
      } catch (e) {
        console.error('Error fetching page access token', e.message);
      }
    }
    
    if (!pageAccessToken) {
      pageAccessToken = accessToken;
    }

    // Subscribe page to webhook
    const subscribeRes = await axios.post(
      `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`,
      null,
      {
        params: {
          access_token: pageAccessToken,
          subscribed_fields: 'leadgen'
        }
      }
    );

    if (subscribeRes.data.success) {
      res.status(200).json({ success: true, message: 'Subscribed successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Failed to subscribe page', data: subscribeRes.data });
    }
  } catch (error) {
    console.error('Subscribe Page Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to subscribe page', error: error.response?.data || error.message });
  }
};

exports.unsubscribePage = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const { pageId } = req.body;
    
    if (!pageId) return res.status(400).json({ success: false, message: 'pageId is required' });

    const integration = await Integration.findOne({ companyId, clientId: clientId || null, type: 'facebook_leads', isActive: true });
    if (!integration || !integration.config || !integration.config.accessToken) {
      return res.status(404).json({ success: false, message: 'Facebook integration not found' });
    }

    const { accessToken } = integration.config;
    
    let pageAccessToken = accessToken;
    const manualPage = (integration.config.pages || []).find(p => p.pageId === pageId);
    if (manualPage && manualPage.accessToken) {
      pageAccessToken = manualPage.accessToken;
    } else {
      try {
        const pageRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
          params: { access_token: accessToken, fields: 'id,access_token' }
        });
        if (pageRes.data && pageRes.data.access_token) {
          pageAccessToken = pageRes.data.access_token;
        }
      } catch (e) {
        console.error('Error fetching page access token', e.message);
      }
    }

    // Unsubscribe page
    await axios.delete(
      `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`,
      {
        params: { access_token: pageAccessToken }
      }
    );

    res.status(200).json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Unsubscribe Page Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to unsubscribe page', error: error.response?.data || error.message });
  }
};

exports.disconnectPage = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const { pageId } = req.params;

    let integration = await Integration.findOne({ 
      companyId, 
      clientId: clientId || null, 
      type: 'facebook_leads'
    });

    if (!integration && pageId) {
      integration = await Integration.findOne({
        type: 'facebook_leads',
        'config.pages.pageId': pageId
      });
    }

    if (!integration && companyId) {
      integration = await Integration.findOne({
        companyId,
        type: 'facebook_leads'
      });
    }
    
    if (!integration) {
      // Already removed or disconnected, return success so UI refreshes cleanly
      return res.status(200).json({ success: true, message: 'Integration already disconnected and removed' });
    }

    // Unsubscribe webhook if possible
    if (pageId && pageId !== 'all') {
      try {
        const page = (integration.config?.pages || []).find(p => p.pageId === pageId);
        const token = page?.accessToken || integration.config?.accessToken;
        if (token) {
          await axios.delete(`https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`, {
            params: { access_token: token },
            timeout: 5000
          }).catch(() => {});
        }
      } catch (e) {}
    }

    const currentPages = integration.config?.pages || [];
    const remainingPages = currentPages.filter(p => p.pageId !== pageId);

    // If no pages remain, delete the integration completely from the database
    if (remainingPages.length === 0 || !pageId || pageId === 'all') {
      await Integration.findByIdAndDelete(integration._id);
      return res.status(200).json({ success: true, message: 'Facebook integration removed from database successfully' });
    } else {
      const disconnectedPages = integration.config?.disconnectedPages || [];
      if (!disconnectedPages.includes(pageId)) {
        disconnectedPages.push(pageId);
      }
      await Integration.findByIdAndUpdate(integration._id, {
        $set: { 
          'config.pages': remainingPages,
          'config.disconnectedPages': disconnectedPages 
        }
      });
      return res.status(200).json({ success: true, message: 'Page disconnected and removed successfully' });
    }
  } catch (error) {
    console.error('Disconnect Page Error:', error);
    next(error);
  }
};

exports.getLogs = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const { pageId } = req.params;

    if (!pageId) {
      return res.status(400).json({ success: false, message: 'pageId is required' });
    }

    const Lead = require('../leads/lead.model');
    
    const query = { companyId, source: 'Facebook Lead Ads', 'customData.pageId': pageId };
    if (clientId) query.clientId = clientId;
    
    const leads = await Lead.find(query).sort({ createdAt: -1 }).limit(50);

    const logs = leads.map(lead => ({
      status: 'success',
      message: `Successfully imported lead: ${lead.fullName || 'Facebook Lead'}`,
      leadgenId: lead.customData?.leadgenId || 'N/A',
      formName: lead.customData?.formName || 'Unknown Form',
      timestamp: lead.createdAt
    }));

    res.status(200).json({ success: true, data: { logs } });
  } catch (error) {
    console.error('Get Facebook Logs Error:', error);
    next(error);
  }
};

exports.syncLeads = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const { pageId, formIds } = req.body;
    
    if (!pageId) {
      return res.status(400).json({ success: false, message: 'pageId is required to sync leads' });
    }

    const query = { companyId, clientId: clientId || null, type: 'facebook_leads', isActive: true };
    const integration = await Integration.findOne(query).sort({ updatedAt: -1 });
    if (!integration || !integration.config || !integration.config.accessToken) {
      return res.status(404).json({ success: false, message: 'Facebook integration not found or disconnected' });
    }

    const targetAccessToken = await resolvePageAccessToken(integration, pageId);

    let forms = [];
    if (pageId) {
      try {
        const formsRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/leadgen_forms`, {
          params: { access_token: targetAccessToken, limit: 100, fields: 'id,name' },
          timeout: 15000
        });
        if (formsRes.data && formsRes.data.data) {
          forms = formsRes.data.data;
        }
      } catch (err) {
        if (targetAccessToken !== integration.config.accessToken) {
          try {
            const fallbackRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/leadgen_forms`, {
              params: { access_token: integration.config.accessToken, limit: 100, fields: 'id,name' },
              timeout: 15000
            });
            if (fallbackRes.data && fallbackRes.data.data) {
              forms = fallbackRes.data.data;
            }
          } catch (e) {}
        }
        if (forms.length === 0) {
          return res.status(400).json({ 
            success: false, 
            message: err.response?.data?.error?.message || 'Failed to fetch forms for the page', 
            meta: { error: err.response?.data || err.message } 
          });
        }
      }
    }

    if (formIds && Array.isArray(formIds) && formIds.length > 0) {
      forms = forms.filter(f => formIds.includes(f.id));
    }

    // Persist selected forms for automatic 5-minute recurring sync!
    const pages = integration.config.pages || [];
    let pageEntry = pages.find(p => p.pageId === pageId);
    if (pageEntry) {
      pageEntry.selectedForms = formIds || [];
      pageEntry.lastSyncAt = new Date();
      pageEntry.autoSync = true;
      if (targetAccessToken && targetAccessToken !== integration.config.accessToken) {
        pageEntry.accessToken = targetAccessToken;
      }
    } else {
      pages.push({
        pageId,
        accessToken: targetAccessToken,
        selectedForms: formIds || [],
        lastSyncAt: new Date(),
        autoSync: true
      });
    }
    integration.config.pages = pages;
    integration.config.selectedForms = formIds || [];
    integration.markModified('config');
    await integration.save();

    const Lead = require('../leads/lead.model');
    let formResults = [];
    let totalSynced = 0;
    let totalDuplicates = 0;

    for (const form of forms) {
      try {
        let hasNextPage = true;
        let url = `https://graph.facebook.com/v18.0/${form.id}/leads`;
        let leadsParams = { 
          access_token: targetAccessToken, 
          fields: 'id,created_time,ad_id,form_id,field_data,adset_id,campaign_id',
          limit: 500 
        };
        
        let syncedCount = 0;
        let duplicateCount = 0;

        while (hasNextPage) {
          const leadsRes = await axios.get(url, { params: leadsParams });
          
          if (leadsRes.data && leadsRes.data.data) {
            for (const fbLead of leadsRes.data.data) {
              const leadgenId = fbLead.id;
              
              const existing = await Lead.findOne({ 
                companyId, 
                'customData.leadgenId': leadgenId 
              });
              
              if (existing) {
                if (clientId && !existing.clientId) {
                  existing.clientId = clientId;
                  existing.isClientLead = true;
                  await existing.save();
                }
                duplicateCount++;
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
                clientId: clientId || null,
                isClientLead: !!clientId,
                ownerId: integration.ownerId || null,
                createdBy: req.user ? req.user._id : null,
                fullName: fullName || 'Unknown',
                email,
                phoneNumber,
                companyName,
                source: 'Facebook Lead Ads',
                status: 'new',
                customData: {
                  leadgenId,
                  formId: form.id,
                  formName: form.name || 'Unknown Form',
                  pageId: pageId,
                  adId: fbLead.ad_id,
                  adSetId: fbLead.adset_id,
                  campaignId: fbLead.campaign_id,
                  createdTime: fbLead.created_time
                },
                activityLogs: [{ message: 'Imported from Facebook Lead Ads' }]
              });
              
              syncedCount++;
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
        
        formResults.push({
          formId: form.id,
          formName: form.name || 'Unknown Form',
          status: 'success',
          syncedCount,
          duplicateCount
        });
        totalSynced += syncedCount;
        totalDuplicates += duplicateCount;
        
      } catch (formLeadsErr) {
        formResults.push({
          formId: form.id,
          status: 'error',
          error: formLeadsErr.response?.data || formLeadsErr.message
        });
      }
    }
    
    if (formIds && formIds.length > 0 && formResults.length > 0 && formResults.every(r => r.status === 'error')) {
      return res.status(400).json({
        success: false,
        message: 'Failed to retrieve leads',
        meta: {
          formIds,
          errors: formResults.map(r => r.error)
        }
      });
    }
    
    res.status(200).json({ 
      success: true, 
      data: { 
        syncedCount: totalSynced, 
        duplicateCount: totalDuplicates,
        forms: formResults
      } 
    });
  } catch (error) {
    console.error('Sync Leads Error:', error);
    next(error);
  }
};

// Asset Discovery Endpoints
exports.getAdAccounts = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const integration = await Integration.findOne({ companyId, clientId: clientId || null, type: 'facebook_leads', isActive: true });
    if (!integration) return res.status(404).json({ success: false, message: 'Integration not found' });

    const accountsRes = await axios.get(`https://graph.facebook.com/v18.0/me/adaccounts`, {
      params: { access_token: integration.config.accessToken, fields: 'id,name,account_id', limit: 100 }
    });
    res.status(200).json({ success: true, data: accountsRes.data.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch Ad Accounts', error: error.response?.data });
  }
};

exports.getCampaigns = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const { adAccountId } = req.query;
    if (!adAccountId) return res.status(400).json({ success: false, message: 'adAccountId is required' });
    
    const integration = await Integration.findOne({ companyId, clientId: clientId || null, type: 'facebook_leads', isActive: true });
    if (!integration) return res.status(404).json({ success: false, message: 'Integration not found' });

    const campaignsRes = await axios.get(`https://graph.facebook.com/v18.0/${adAccountId}/campaigns`, {
      params: { access_token: integration.config.accessToken, fields: 'id,name,status', limit: 100 }
    });
    res.status(200).json({ success: true, data: campaignsRes.data.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch Campaigns', error: error.response?.data });
  }
};

exports.getAdSets = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const { campaignId } = req.query;
    if (!campaignId) return res.status(400).json({ success: false, message: 'campaignId is required' });
    
    const integration = await Integration.findOne({ companyId, clientId: clientId || null, type: 'facebook_leads', isActive: true });
    if (!integration) return res.status(404).json({ success: false, message: 'Integration not found' });

    const adsetsRes = await axios.get(`https://graph.facebook.com/v18.0/${campaignId}/adsets`, {
      params: { access_token: integration.config.accessToken, fields: 'id,name,status', limit: 100 }
    });
    res.status(200).json({ success: true, data: adsetsRes.data.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch Ad Sets', error: error.response?.data });
  }
};

exports.getAds = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const { adSetId } = req.query;
    if (!adSetId) return res.status(400).json({ success: false, message: 'adSetId is required' });
    
    const integration = await Integration.findOne({ companyId, clientId: clientId || null, type: 'facebook_leads', isActive: true });
    if (!integration) return res.status(404).json({ success: false, message: 'Integration not found' });

    const adsRes = await axios.get(`https://graph.facebook.com/v18.0/${adSetId}/ads`, {
      params: { access_token: integration.config.accessToken, fields: 'id,name,status', limit: 100 }
    });
    res.status(200).json({ success: true, data: adsRes.data.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch Ads', error: error.response?.data });
  }
};

const resolvePageAccessToken = async (integration, pageId) => {
  const pages = integration.config?.pages || [];
  const page = pages.find(p => p.pageId === pageId);
  
  if (page && page.accessToken && page.accessToken.startsWith('EAA') && page.accessToken.length > 50) {
    return page.accessToken;
  }

  const userAccessToken = integration.config?.accessToken;
  if (!userAccessToken) return null;

  // Fetch /me/accounts with userAccessToken to obtain valid page access tokens
  try {
    const accountsRes = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
      params: {
        access_token: userAccessToken,
        fields: 'id,name,access_token',
        limit: 100
      },
      timeout: 10000
    });
    if (accountsRes.data && accountsRes.data.data) {
      const match = accountsRes.data.data.find(a => a.id === pageId);
      if (match && match.access_token) {
        if (page) {
          page.accessToken = match.access_token;
          integration.markModified('config');
          await integration.save().catch(() => {});
        }
        return match.access_token;
      }
    }
  } catch (err) {
    console.error('Error fetching /me/accounts for page access token:', err.response?.data?.error?.message || err.message);
  }

  return userAccessToken;
};

exports.getForms = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const { pageId } = req.query;
    if (!pageId) return res.status(400).json({ success: false, message: 'pageId is required' });
    
    const query = { companyId, clientId: clientId || null, type: 'facebook_leads', isActive: true };
    const integration = await Integration.findOne(query).sort({ updatedAt: -1 });
    if (!integration || !integration.config || !integration.config.accessToken) {
      return res.status(404).json({ success: false, message: 'Integration not found' });
    }

    const targetAccessToken = await resolvePageAccessToken(integration, pageId);

    try {
      const formsRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/leadgen_forms`, {
        params: { access_token: targetAccessToken, fields: 'id,name,status', limit: 100 },
        timeout: 15000
      });
      return res.status(200).json({ success: true, data: formsRes.data.data || [] });
    } catch (fbErr) {
      // If page token failed, try user token as fallback
      if (targetAccessToken !== integration.config.accessToken) {
        try {
          const fallbackRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/leadgen_forms`, {
            params: { access_token: integration.config.accessToken, fields: 'id,name,status', limit: 100 },
            timeout: 15000
          });
          return res.status(200).json({ success: true, data: fallbackRes.data.data || [] });
        } catch (e) {}
      }

      console.error('Get Forms FB Error:', fbErr.response?.data || fbErr.message);
      let errMsg = fbErr.response?.data?.error?.message || fbErr.message;
      if (fbErr.response?.data?.error?.code === 190 || errMsg.includes('permission') || errMsg.includes('impersonating')) {
        errMsg = 'Your Facebook account does not have admin permissions for this page. Please click Reconnect Facebook with the account that manages this page.';
      }
      return res.status(400).json({ 
        success: false, 
        message: errMsg, 
        error: fbErr.response?.data || errMsg 
      });
    }
  } catch (error) {
    console.error('Get Forms Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch Lead Forms', error: error.response?.data || error.message });
  }
};

// Webhook Handlers
exports.verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'bcc_seo_webhook_token_123';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
};

exports.handleWebhook = async (req, res) => {
  const body = req.body;
  
  if (body.object === 'page') {
    res.status(200).send('EVENT_RECEIVED');
    
    for (const entry of body.entry) {
      const pageId = entry.id;
      for (const change of entry.changes) {
        if (change.field === 'leadgen') {
          const leadgenId = change.value.leadgen_id;
          const formId = change.value.form_id;
          const createdTime = change.value.created_time;
          
          try {
            const integrations = await Integration.find({ type: 'facebook_leads', isActive: true });
            let validIntegration = null;
            let pageAccessToken = null;
            
            for (const intg of integrations) {
              const disconnectedPages = intg.config?.disconnectedPages || [];
              if (disconnectedPages.includes(pageId)) {
                continue;
              }

              try {
                const manualPage = (intg.config.pages || []).find(p => p.pageId === pageId);
                if (manualPage && manualPage.accessToken) {
                  validIntegration = intg;
                  pageAccessToken = manualPage.accessToken;
                  break;
                }

                const pageRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
                  params: { access_token: intg.config.accessToken, fields: 'id,access_token' }
                });
                if (pageRes.data && pageRes.data.access_token) {
                  validIntegration = intg;
                  pageAccessToken = pageRes.data.access_token;
                  break;
                }
              } catch(e) {}
            }
            
            if (!validIntegration || !pageAccessToken) {
              console.error('Webhook Leadgen: Could not find valid integration or page access token for page', pageId);
              continue;
            }
            
            const Lead = require('../leads/lead.model');
            const companyId = validIntegration.companyId;
            const clientId = validIntegration.clientId || null;
            
            const existing = await Lead.findOne({ companyId, 'customData.leadgenId': leadgenId });
            if (existing) {
              console.log('Webhook Leadgen: Duplicate lead skipped', leadgenId);
              continue;
            }
            
            const leadRes = await axios.get(`https://graph.facebook.com/v18.0/${leadgenId}`, {
              params: { access_token: pageAccessToken }
            });
            
            const fbLead = leadRes.data;
            let fullName = 'Facebook Lead (Webhook)';
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
              clientId,
              isClientLead: !!clientId,
              ownerId: validIntegration.ownerId || null,
              createdBy: validIntegration.companyId,
              fullName: fullName || 'Unknown',
              email,
              phoneNumber,
              companyName,
              source: 'Facebook Lead Ads',
              status: 'new',
              customData: {
                leadgenId,
                formId,
                pageId,
                adId: fbLead.ad_id,
                adSetId: fbLead.adset_id,
                campaignId: fbLead.campaign_id,
                createdTime: fbLead.created_time || createdTime
              },
              activityLogs: [{ message: 'Imported from Facebook Webhook' }]
            });
            
            console.log('Webhook Leadgen: Lead successfully created', leadgenId);
            
          } catch (error) {
            console.error('Webhook Leadgen Error:', error.response?.data || error.message);
          }
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
};

exports.connectManualPage = async (req, res, next) => {
  try {
    const { companyId, clientId } = getClientContext(req);
    const { pageId } = req.body;
    
    if (!pageId) return res.status(400).json({ success: false, message: 'pageId is required' });

    const integration = await Integration.findOne({ companyId, clientId: clientId || null, type: 'facebook_leads', isActive: true });
    if (!integration || !integration.config || !integration.config.accessToken) {
      return res.status(404).json({ success: false, message: 'Facebook integration not found' });
    }

    const { accessToken } = integration.config;
    
    // Verify the page ID with the user's token
    const manualPageRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,access_token'
      }
    });

    const page = manualPageRes.data;
    if (!page || !page.id) {
      return res.status(400).json({ success: false, message: 'Invalid Page ID or missing permissions' });
    }

    const pageAccessToken = page.access_token || accessToken;

    // Subscribe to webhooks automatically
    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${page.id}/subscribed_apps`,
        null,
        {
          params: {
            access_token: pageAccessToken,
            subscribed_fields: 'leadgen'
          }
        }
      );
    } catch (subErr) {
      console.error('Failed to automatically subscribe page to leadgen webhook:', subErr.response?.data || subErr.message);
    }

    // Add to config.pages
    const pages = integration.config.pages || [];
    const exists = pages.find(p => p.pageId === page.id);
    if (!exists) {
      pages.push({
        pageId: page.id,
        pageName: page.name,
        accessToken: pageAccessToken,
        selectedForms: [],
        lastSyncAt: null,
        autoSync: true,
        addedAt: new Date()
      });
      await Integration.findByIdAndUpdate(integration._id, {
        $set: { 'config.pages': pages }
      });
    }

    res.status(200).json({ success: true, message: 'Page connected successfully', data: page });
  } catch (error) {
    console.error('Connect Manual Page Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to connect page', error: error.response?.data || error.message });
  }
};
