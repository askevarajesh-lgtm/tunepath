const axios = require('axios');

/**
 * Normalizes phone numbers by stripping whitespace, hyphens, and non-numeric characters (except leading +).
 * E.g., "+91 98456-21730" -> "9845621730" / "919845621730"
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  const cleaned = String(rawPhone).replace(/[^\d+]/g, '');
  // If starts with +, remove + for standard numeric search
  return cleaned.startsWith('+') ? cleaned.substring(1) : cleaned;
}

/**
 * Resolves full playable recording URL from the Sollu recording field (filename or full URL).
 */
function resolveRecordingUrl(recordingField, customBaseUrl = '') {
  if (!recordingField || typeof recordingField !== 'string') return '';
  const trimmed = recordingField.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const baseUrl = (customBaseUrl || process.env.SOLLU_RECORDING_BASE_URL || 'https://app.sollu.in').replace(/\/+$/, '');
  if (baseUrl) {
    return `${baseUrl}/${trimmed.replace(/^\/+/, '')}`;
  }
  return trimmed;
}

/**
 * Formats phone number for Sollu Telephony API.
 * Ensures number is formatted (e.g. 0XXXXXXXXXX as required by Sollu).
 */
function formatSolluPhone(rawPhone) {
  if (!rawPhone) return '';
  const cleaned = String(rawPhone).replace(/[^\d]/g, '');
  if (cleaned.length === 10) {
    return `0${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `0${cleaned.substring(2)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return cleaned;
  }
  return cleaned;
}

/**
 * Initiates an Outbound Call via Sollu Telephony API.
 * 
 * Sollu API URL Format:
 * https://app.sollu.in/api/clicktocall?apikey=...&caller1=098849xxx&caller2=0988415xxxx&callback_url=https://...
 */
async function initiateOutboundCall({ customerPhone, agentPhone, did, leadId, ivrConfig = {}, metadata = {} }) {
  const baseUrl = (ivrConfig.baseUrl || process.env.SOLLU_API_BASE_URL || 'https://app.sollu.in').trim();
  const apiKey = (ivrConfig.apiKey || process.env.SOLLU_API_KEY || '').trim();
  const outboundEndpoint = (ivrConfig.outboundEndpoint || process.env.SOLLU_OUTBOUND_ENDPOINT || '/api/clicktocall').trim();
  const callerDid = did || ivrConfig.did || process.env.SOLLU_DID || '914443126059';

  // Resolve public webhook callback URL (ensuring full public URL is supplied to Sollu)
  let rawCallbackUrl = (ivrConfig.callbackUrl || process.env.SOLLU_CALLBACK_URL || 'https://varsity-unscrew-refusal.ngrok-free.dev/api/ivr/webhook').trim();
  if (!rawCallbackUrl.startsWith('http://') && !rawCallbackUrl.startsWith('https://')) {
    const publicHost = 'https://varsity-unscrew-refusal.ngrok-free.dev';
    if (rawCallbackUrl === 'outboundcallback' || rawCallbackUrl === 'callback' || rawCallbackUrl === 'webhook') {
      rawCallbackUrl = `${publicHost}/api/ivr/${rawCallbackUrl}`;
    } else {
      rawCallbackUrl = `${publicHost}/${rawCallbackUrl.replace(/^\/+/, '')}`;
    }
  }

  const formattedCustomerPhone = formatSolluPhone(customerPhone);
  const formattedAgentPhone = formatSolluPhone(agentPhone) || formatSolluPhone(callerDid);

  if (!formattedCustomerPhone) {
    throw new Error('Customer phone number is required');
  }

  // If live credentials are not yet supplied, operate in sandbox/simulated mode
  if (!apiKey) {
    console.warn('[Sollu IVR Service] Sollu API Key not configured in Integrations settings. Simulating outbound call in sandbox mode.');
    const mockCallId = `SIM-${Date.now().toString().slice(-6)}`;
    return {
      success: true,
      simulated: true,
      message: 'Call initiated in simulation mode (Configure Sollu API in Settings -> Integrations to dial live)',
      callId: mockCallId,
      customerPhone: formattedCustomerPhone,
      agentPhone: formattedAgentPhone,
      did: callerDid,
    };
  }

  // Build target URL: https://app.sollu.in/api/clicktocall
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanEndpoint = outboundEndpoint.replace(/^\/+/, '');
  const targetUrl = cleanEndpoint.startsWith('http') ? cleanEndpoint : `${cleanBase}/${cleanEndpoint}`;

  // Build Query Parameters matching Sollu API Specification
  const queryParams = {
    apikey: apiKey,
    caller1: formattedAgentPhone,
    caller2: formattedCustomerPhone,
    callback_url: rawCallbackUrl,
  };

  console.log(`[Sollu IVR Service] Initiating outbound call: caller1 (Agent)=${formattedAgentPhone}, caller2 (Lead)=${formattedCustomerPhone}, callback=${rawCallbackUrl} via ${targetUrl}`);

  try {
    const response = await axios.get(targetUrl, {
      params: queryParams,
      timeout: 15000,
    });

    const responseData = response.data || {};
    console.log('[Sollu IVR Service] Sollu API Response:', responseData);

    // Extract call identifier
    let callId = null;
    let message = 'Call initiated successfully via Sollu';

    if (typeof responseData === 'object') {
      callId =
        responseData.callid ||
        responseData.callId ||
        responseData.call_id ||
        responseData.id ||
        responseData.data?.callid ||
        responseData.data?.id ||
        responseData.sid ||
        `SOLLU-${Date.now()}`;
      if (responseData.message || responseData.msg || responseData.status) {
        message = responseData.message || responseData.msg || `Status: ${responseData.status}`;
      }
    } else if (typeof responseData === 'string') {
      message = responseData;
      callId = `SOLLU-${Date.now()}`;
    }

    return {
      success: true,
      simulated: false,
      message,
      callId,
      customerPhone: formattedCustomerPhone,
      agentPhone: formattedAgentPhone,
      rawResponse: responseData,
    };
  } catch (error) {
    console.error('[Sollu IVR Service] Outbound call error:', error.response?.data || error.message);
    const errorMessage =
      (error.response?.data && (error.response.data.message || error.response.data.msg || JSON.stringify(error.response.data))) ||
      error.message ||
      'Failed to initiate outbound call with Sollu IVR';
    throw new Error(errorMessage);
  }
}

/**
 * Validates incoming webhook signature/token if configured.
 */
function verifyWebhookRequest(req, secret = '') {
  const webhookSecret = secret || process.env.SOLLU_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Secret not set, pass through
    return true;
  }

  const incomingSecret =
    req.headers['x-webhook-secret'] ||
    req.headers['x-sollu-secret'] ||
    req.headers['authorization'] ||
    req.query.secret;

  if (!incomingSecret) {
    return false;
  }

  return incomingSecret === webhookSecret || incomingSecret === `Bearer ${webhookSecret}`;
}

module.exports = {
  normalizePhoneNumber,
  formatSolluPhone,
  resolveRecordingUrl,
  initiateOutboundCall,
  verifyWebhookRequest,
};

