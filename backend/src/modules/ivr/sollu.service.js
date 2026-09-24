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
  const baseUrl = (customBaseUrl || process.env.SOLLU_RECORDING_BASE_URL || '').replace(/\/+$/, '');
  if (baseUrl) {
    return `${baseUrl}/${trimmed.replace(/^\/+/, '')}`;
  }
  return trimmed;
}

/**
 * Initiates an Outbound Call via Sollu Telephony API.
 * 
 * Uses dynamic configuration from company Integration settings in MongoDB.
 */
async function initiateOutboundCall({ customerPhone, agentPhone, did, leadId, ivrConfig = {}, metadata = {} }) {
  const baseUrl = ivrConfig.baseUrl || process.env.SOLLU_API_BASE_URL;
  const apiKey = ivrConfig.apiKey || process.env.SOLLU_API_KEY;
  const bearerToken = ivrConfig.bearerToken || process.env.SOLLU_BEARER_TOKEN;
  const outboundEndpoint = ivrConfig.outboundEndpoint || process.env.SOLLU_OUTBOUND_ENDPOINT || '/calls/outbound';
  const callerDid = did || ivrConfig.did || process.env.SOLLU_DID || '914443126059';

  const normalizedCustomerPhone = normalizePhoneNumber(customerPhone);
  const normalizedAgentPhone = normalizePhoneNumber(agentPhone);

  if (!normalizedCustomerPhone) {
    throw new Error('Customer phone number is required');
  }

  // If live credentials are not yet supplied, operate in sandbox/simulated mode
  if (!baseUrl || (!apiKey && !bearerToken)) {
    console.warn('[Sollu IVR Service] Sollu API credentials not configured in Integrations settings. Simulating outbound call in sandbox mode.');
    const mockCallId = `SIM-${Date.now().toString().slice(-6)}`;
    return {
      success: true,
      simulated: true,
      message: 'Call initiated in simulation mode (Configure Sollu API in Settings -> Integrations to dial live)',
      callId: mockCallId,
      customerPhone: normalizedCustomerPhone,
      agentPhone: normalizedAgentPhone,
      did: callerDid,
    };
  }

  // Construct request headers
  const headers = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['x-api-key'] = apiKey;
    headers['Authorization'] = `ApiKey ${apiKey}`;
  } else if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  }

  const requestPayload = {
    customer_phone: normalizedCustomerPhone,
    agent_phone: normalizedAgentPhone,
    did: callerDid,
    custom_data: {
      leadId,
      ...metadata,
    },
  };

  const targetUrl = `${baseUrl.replace(/\/+$/, '')}/${outboundEndpoint.replace(/^\/+/, '')}`;

  console.log(`[Sollu IVR Service] Initiating outbound call to ${normalizedCustomerPhone} via ${targetUrl}`);

  try {
    const response = await axios.post(targetUrl, requestPayload, {
      headers,
      timeout: 15000,
    });

    const responseData = response.data || {};
    const callId = responseData.callid || responseData.callId || responseData.id || responseData.data?.callid || `SOLLU-${Date.now()}`;

    return {
      success: true,
      simulated: false,
      message: responseData.message || 'Call initiated successfully via Sollu',
      callId,
      rawResponse: responseData,
    };
  } catch (error) {
    console.error('[Sollu IVR Service] Outbound call error:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.message || error.message || 'Failed to initiate outbound call with Sollu IVR';
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
  resolveRecordingUrl,
  initiateOutboundCall,
  verifyWebhookRequest,
};
