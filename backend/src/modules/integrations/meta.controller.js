const Integration = require('./integration.model');
const axios = require('axios');
const mongoose = require('mongoose');

const META_APP_ID = process.env.META_APP_ID || 'dummy_app_id';
const META_APP_SECRET = process.env.META_SECRET || process.env.META_APP_SECRET || 'dummy_app_secret';
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:5500'}/api/integrations/meta/callback`;

const getAgencyId = (req) => {
  let clientId = req.query.clientId;
  if (clientId === 'null' || clientId === 'undefined') {
    clientId = null;
  }
  return (req.isClientRole && req.clientUserId) ? req.clientUserId : (clientId || req.companyId || (req.user && (req.user.agencyId || req.user.workspaceId || req.user.agency)));
};

exports.generateAuthUrl = async (req, res, next) => {
  try {
    const agencyId = getAgencyId(req);
    if (!agencyId) {
      return res.status(400).json({ success: false, message: 'Agency ID missing from user token' });
    }

    const { returnUrl } = req.query;
    const stateObj = { 
        agencyId: agencyId.toString(), 
        returnUrl: returnUrl || '/agency/performance-ads' 
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
    const scopes = ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'pages_manage_ads', 'leads_retrieval', 'ads_read', 'business_management', 'pages_read_user_content'].join(',');
    
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&state=${state}&scope=${scopes}`;
    
    res.status(200).json({ success: true, url: authUrl });
  } catch (error) {
    next(error);
  }
};

exports.handleCallback = async (req, res, next) => {
  try {
    const { code, state: stateStr } = req.query;
    
    if (!code || !stateStr) {
      return res.status(400).json({ success: false, message: 'Missing code or state from Meta callback' });
    }

    let agencyId, returnUrl;
    try {
        const stateObj = JSON.parse(Buffer.from(stateStr, 'base64').toString('utf8'));
        
        // If state contains redirectPath and companyId, it's actually from the Facebook Leads integration
        // Redirect to the correct handler internally since both use the same META_REDIRECT_URI
        if (stateObj.redirectPath && stateObj.companyId) {
            return res.redirect(`/api/facebook/callback?code=${code}&state=${stateStr}`);
        }

        agencyId = stateObj.agencyId;
        returnUrl = stateObj.returnUrl;
    } catch (e) {
        agencyId = stateStr;
        returnUrl = '/agency/performance-ads';
    }

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

    // 2. Exchange for long-lived token (60 days)
    const longLivedRes = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: accessToken
      }
    });

    accessToken = longLivedRes.data.access_token;
    const expiresIn = longLivedRes.data.expires_in || 5184000; // 60 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 3. Get User ID
    const meRes = await axios.get(`https://graph.facebook.com/v18.0/me`, {
      params: { access_token: accessToken }
    });
    const userId = meRes.data.id;

    // 4. Save to Database
    await Integration.findOneAndUpdate(
      { companyId: agencyId, type: 'meta_ads' },
      {
        name: 'Meta Ads Integration',
        isActive: true,
        config: {
          accessToken,
          userId,
          selectedAdAccounts: [],
          expiresAt
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Redirect back to frontend settings or performance ads dashboard
    // In production, this should be the frontend URL. For now, redirecting to root or settings
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}${returnUrl}`);
  } catch (error) {
    const errDetail = error.response?.data || error.message;
    console.error('Meta Callback Error:', JSON.stringify(errDetail));
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    let fallbackReturnUrl = '/agency/performance-ads';
    if (req.query.state) {
        try {
            const stateObj = JSON.parse(Buffer.from(req.query.state, 'base64').toString('utf8'));
            if (stateObj.returnUrl) fallbackReturnUrl = stateObj.returnUrl;
        } catch (e) {}
    }
    
    res.redirect(`${frontendUrl}${fallbackReturnUrl}?meta_error=${encodeURIComponent(JSON.stringify(errDetail))}`);
  }
};

exports.getAdAccounts = async (req, res, next) => {
  try {
    const agencyId = getAgencyId(req);
    const integration = await Integration.findOne({ companyId: agencyId, type: 'meta_ads', isActive: true });
    
    if (!integration || !integration.config || !integration.config.accessToken) {
      return res.status(404).json({ success: false, message: 'Meta Ads integration not found or disconnected' });
    }

    const { accessToken, userId } = integration.config;
    
    // Fetch Personal/Direct Ad Accounts
    const accountsRes = await axios.get(`https://graph.facebook.com/v18.0/${userId}/adaccounts`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,account_status,currency,timezone_name,balance,amount_spent,funding_source_details'
      }
    });

    let allAccounts = [...(accountsRes.data.data || [])];
    let allPages = [];
    let allBusinesses = [];

    // Fetch Pages
    try {
      const pagesRes = await axios.get(`https://graph.facebook.com/v18.0/${userId}/accounts`, {
        params: { access_token: accessToken, fields: 'id,name,category' }
      });
      allPages = pagesRes.data.data || [];
    } catch (pagesErr) {
      console.error('Failed to fetch pages:', pagesErr.response?.data || pagesErr.message);
    }

    // Fetch Business Ad Accounts
    try {
      const bizRes = await axios.get(`https://graph.facebook.com/v18.0/${userId}/businesses`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,owned_ad_accounts{id,name,account_status,currency,timezone_name,balance,amount_spent,funding_source_details},client_ad_accounts{id,name,account_status,currency,timezone_name,balance,amount_spent,funding_source_details}'
        }
      });
      
      const businesses = bizRes.data.data || [];
      allBusinesses = businesses.map(b => ({ id: b.id, name: b.name }));
      
      businesses.forEach(biz => {
        if (biz.owned_ad_accounts && biz.owned_ad_accounts.data) {
          biz.owned_ad_accounts.data.forEach(acc => {
            if (!allAccounts.find(a => a.id === acc.id)) {
              allAccounts.push({ ...acc, business_name: biz.name });
            }
          });
        }
        if (biz.client_ad_accounts && biz.client_ad_accounts.data) {
          biz.client_ad_accounts.data.forEach(acc => {
            if (!allAccounts.find(a => a.id === acc.id)) {
              allAccounts.push({ ...acc, business_name: biz.name });
            }
          });
        }
      });
    } catch (bizErr) {
      console.error('Failed to fetch business ad accounts:', bizErr.response?.data || bizErr.message);
    }

    res.status(200).json({
      success: true,
      data: {
        adAccounts: allAccounts,
        pages: allPages,
        businesses: allBusinesses
      }
    });
  } catch (error) {
    const errorData = error.response?.data;
    console.error('Fetch Ad Accounts Error:', errorData || error.message);
    
    if (error.response && error.response.status === 403) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied (403). Your Meta App is missing the "ads_read" or "ads_management" permission. Please go to your Meta App Dashboard -> App Review -> Permissions and Features, and add them with at least Standard Access.'
      });
    }
    
    next(error);
  }
};

exports.saveSelectedAdAccounts = async (req, res, next) => {
  try {
    const agencyId = getAgencyId(req);
    const { selectedAdAccounts } = req.body; // array of { id, name }

    if (!Array.isArray(selectedAdAccounts)) {
      return res.status(400).json({ success: false, message: 'selectedAdAccounts must be an array' });
    }

    const integration = await Integration.findOne({ companyId: agencyId, type: 'meta_ads' });
    if (!integration) {
      return res.status(404).json({ success: false, message: 'Meta Ads integration not found' });
    }

    integration.config = {
      ...integration.config,
      selectedAdAccounts
    };
    
    await integration.save();

    res.status(200).json({
      success: true,
      message: 'Ad accounts saved successfully',
      data: integration
    });
  } catch (error) {
    next(error);
  }
};

exports.createCampaign = async (req, res, next) => {
  try {
    const agencyId = getAgencyId(req);
    const integration = await Integration.findOne({ companyId: agencyId, type: 'meta_ads', isActive: true });
    
    if (!integration || !integration.config || !integration.config.accessToken) {
      return res.status(404).json({ success: false, message: 'Meta Ads integration not found or disconnected' });
    }

    const { accessToken } = integration.config;
    const { 
      adAccountId, 
      campaignName, 
      objective, 
      status = 'PAUSED', 
      specialAdCategories = [],
      adSetName,
      dailyBudget, // in rupees/dollars, needs to be multiplied by 100
      billingEvent = 'IMPRESSIONS',
      optimizationGoal = 'REACH',
      targeting = { geo_locations: { countries: ['IN'] } },
      adName,
      pageId,
      creativeLink,
      creativeMessage,
      creativeImageUrl
    } = req.body;

    if (!adAccountId) return res.status(400).json({ success: false, message: 'adAccountId is required' });

    // 1. Create Campaign
    const campaignRes = await axios.post(`https://graph.facebook.com/v18.0/${adAccountId}/campaigns`, null, {
      params: {
        access_token: accessToken,
        name: campaignName,
        objective: objective,
        status: status,
        special_ad_categories: JSON.stringify(specialAdCategories)
      }
    });
    const campaignId = campaignRes.data.id;

    // 2. Create Ad Set
    const adSetRes = await axios.post(`https://graph.facebook.com/v18.0/${adAccountId}/adsets`, null, {
      params: {
        access_token: accessToken,
        name: adSetName,
        campaign_id: campaignId,
        daily_budget: dailyBudget * 100, // cents/paise
        billing_event: billingEvent,
        optimization_goal: optimizationGoal,
        targeting: JSON.stringify(targeting),
        status: status,
        promoted_object: JSON.stringify({ page_id: pageId })
      }
    });
    const adSetId = adSetRes.data.id;

    // 3. Create Ad Creative (assuming standard link ad with image)
    const creativeRes = await axios.post(`https://graph.facebook.com/v18.0/${adAccountId}/adcreatives`, null, {
      params: {
        access_token: accessToken,
        name: `Creative - ${adName}`,
        object_story_spec: JSON.stringify({
          page_id: pageId,
          link_data: {
            image_url: creativeImageUrl,
            link: creativeLink,
            message: creativeMessage
          }
        }),
        degrees_of_freedom_spec: JSON.stringify({ creative_features_spec: { standard_enhancements: { enrollment_status: 'OPT_OUT' } } })
      }
    });
    const creativeId = creativeRes.data.id;

    // 4. Create Ad
    const adRes = await axios.post(`https://graph.facebook.com/v18.0/${adAccountId}/ads`, null, {
      params: {
        access_token: accessToken,
        name: adName,
        adset_id: adSetId,
        creative: JSON.stringify({ creative_id: creativeId }),
        status: status
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Campaign created successfully',
      data: {
        campaignId,
        adSetId,
        adId: adRes.data.id
      }
    });

  } catch (error) {
    console.error('Meta Campaign Creation Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to create campaign', error: error.response?.data || error.message });
  }
};

exports.disconnectMeta = async (req, res, next) => {
  try {
    const agencyId = getAgencyId(req);
    
    await Integration.findOneAndDelete({ companyId: agencyId, type: 'meta_ads' });
    res.status(200).json({ success: true, message: 'Meta Ads disconnected successfully' });
  } catch (error) {
    next(error);
  }

};

exports.getMetaIntegrationStatus = async (req, res, next) => {
  try {
    const agencyId = getAgencyId(req);
    const integration = await Integration.findOne({ companyId: agencyId, type: 'meta_ads', isActive: true });
    
    if (!integration) {
      return res.status(200).json({ success: true, isConnected: false });
    }

    res.status(200).json({
      success: true,
      isConnected: true,
      data: integration
    });
  } catch (error) {
    next(error);
  }
};


