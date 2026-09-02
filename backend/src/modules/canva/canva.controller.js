const crypto = require('crypto');
const axios = require('axios');
const qs = require('qs');
const Integration = require('../integrations/integration.model');

// In-memory store for PKCE verifiers to avoid cross-domain session cookie issues
// Maps state -> { codeVerifier, companyId, expiresAt }
const pkceStore = new Map();

// Helper functions for PKCE
function base64URLEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

exports.connectCanva = async (req, res) => {
  try {
    const clientId = process.env.CANVA_CLIENT_ID;
    const redirectUri = process.env.CANVA_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      return res.status(500).json({ success: false, error: "Canva credentials missing in server config" });
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = base64URLEncode(sha256(codeVerifier));
    const state = crypto.randomBytes(16).toString('hex');
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;

    // Store verifier in memory with 10 minute expiry
    pkceStore.set(state, {
      codeVerifier,
      companyId,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    // Construct Canva Auth URL
    const scopes = "asset:read design:meta:read design:content:read profile:read";
    const authUrl = new URL("https://www.canva.com/api/oauth/authorize");
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 's256');
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);

    res.json({ success: true, authUrl: authUrl.toString() });
  } catch (err) {
    console.error("Error starting Canva connection:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.canvaCallback = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect(`${frontendUrl}/agency/canva?canva_error=${error}`);
    }

    const sessionData = pkceStore.get(state);

    if (!sessionData || Date.now() > sessionData.expiresAt) {
      pkceStore.delete(state);
      return res.redirect(`${frontendUrl}/agency/canva?canva_error=invalid_session_or_state`);
    }

    const { codeVerifier, companyId } = sessionData;
    pkceStore.delete(state);

    const clientId = process.env.CANVA_CLIENT_ID;
    const clientSecret = process.env.CANVA_CLIENT_SECRET;
    const redirectUri = process.env.CANVA_REDIRECT_URI;
    
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await axios.post('https://api.canva.com/rest/v1/oauth/token', 
      qs.stringify({
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
        code,
        redirect_uri: redirectUri
      }), 
      {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    let userProfile = { displayName: 'Canva Account' };
    try {
      const profileResponse = await axios.get('https://api.canva.com/rest/v1/users/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });
      userProfile = profileResponse.data?.user || userProfile;
    } catch(profileErr) {
      console.warn("Could not fetch user profile from Canva", profileErr.message);
    }

    // Upsert the integration
    await Integration.findOneAndUpdate(
      { companyId: companyId, type: 'canva' },
      {
        name: 'Canva Workspace',
        isActive: true,
        config: {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: new Date(Date.now() + (expires_in || 14400) * 1000),
          displayName: userProfile?.displayName || 'Canva Account',
        }
      },
      { upsert: true, new: true }
    );

    res.redirect(`${frontendUrl}/agency/canva?canva_connected=true`);
  } catch (err) {
    console.error("Error in Canva callback:", err.response?.data || err.message);
    res.redirect(`${frontendUrl}/agency/canva?canva_error=auth_failed`);
  }
};

exports.getCanvaStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;
    const integration = await Integration.findOne({ companyId, type: 'canva', isActive: true });
    
    if (!integration) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      account: {
        displayName: integration.config.displayName || 'Canva Account',
        tokenExpiry: integration.config.expiresAt,
      }
    });
  } catch (err) {
    console.error("Error getting Canva status:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.disconnectCanva = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;
    await Integration.findOneAndDelete({ companyId, type: 'canva' });
    res.json({ success: true, message: 'Canva disconnected successfully' });
  } catch (err) {
    console.error("Error disconnecting Canva:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const refreshCanvaToken = async (integration) => {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenResponse = await axios.post('https://api.canva.com/rest/v1/oauth/token', 
    qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: integration.config.refreshToken
    }), 
    {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  const { access_token, refresh_token, expires_in } = tokenResponse.data;

  integration.config.accessToken = access_token;
  if (refresh_token) {
    integration.config.refreshToken = refresh_token;
  }
  integration.config.expiresAt = new Date(Date.now() + (expires_in || 14400) * 1000);
  
  // markModified is required for Mixed types
  integration.markModified('config');
  await integration.save();

  return integration;
};

exports.getCanvaDesigns = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user.agencyId || req.user._id;
    let integration = await Integration.findOne({ companyId, type: 'canva', isActive: true });
    
    if (!integration) {
      return res.status(401).json({ success: false, error: 'Canva account not connected' });
    }

    // Refresh token if expired (with 5 minute buffer)
    if (new Date(integration.config.expiresAt).getTime() < Date.now() + 5 * 60 * 1000) {
      try {
        integration = await refreshCanvaToken(integration);
      } catch (refreshErr) {
        console.error("Canva token refresh failed:", refreshErr.response?.data || refreshErr.message);
        // Do not throw here, allow the user to see they are disconnected
        integration.isActive = false;
        await integration.save();
        return res.status(401).json({ success: false, error: 'Canva session expired. Please reconnect.' });
      }
    }

    const { query } = req.query;

    const designsResponse = await axios.get('https://api.canva.com/rest/v1/designs', {
      headers: {
        'Authorization': `Bearer ${integration.config.accessToken}`
      },
      params: query ? { query } : {}
    });

    const mappedDesigns = (designsResponse.data.items || []).map(item => ({
      canvaDesignId: item.id,
      _id: item.id,
      title: item.title,
      thumbnailUrl: item.thumbnail?.url,
      editUrl: item.urls?.edit_url,
      viewUrl: item.urls?.view_url,
      updatedAt: item.updated_at ? new Date(item.updated_at * 1000).toISOString() : null
    }));

    res.json({
      success: true,
      designs: mappedDesigns
    });
  } catch (err) {
    console.error("Error fetching Canva designs:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
