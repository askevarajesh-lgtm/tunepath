const mongoose = require('mongoose');
const CallLog = require('./callLog.model');
const Lead = require('../leads/lead.model');
const User = require('../auth/user.model');
const Integration = require('../integrations/integration.model');
const solluService = require('./sollu.service');

const PLATFORM_ADMIN_ROLES = ['supreme_super_admin', 'commander_admin', 'super_admin'];

/**
 * Helper to find a Lead in the database matching a phone number.
 */
async function findLeadByPhone(rawPhone, companyId = null) {
  if (!rawPhone) return null;
  const normalized = solluService.normalizePhoneNumber(rawPhone);
  if (!normalized) return null;

  const last10 = normalized.slice(-10);

  const query = {
    $or: [
      { phoneNumber: { $regex: `${last10}$`, $options: 'i' } },
      { mobile: { $regex: `${last10}$`, $options: 'i' } },
    ],
  };

  if (companyId) {
    query.companyId = companyId;
  }

  // Prioritize the lead that was most recently interacted with or updated
  return await Lead.findOne(query).sort({ lastInteractionAt: -1, updatedAt: -1, createdAt: -1 });
}

/**
 * Helper to find a CRM User / Agent matching an agent phone number.
 */
async function findAgentByPhone(rawPhone) {
  if (!rawPhone) return null;
  const normalized = solluService.normalizePhoneNumber(rawPhone);
  if (!normalized) return null;

  const last10 = normalized.slice(-10);
  return await User.findOne({
    phone: { $regex: `${last10}$`, $options: 'i' },
  });
}

/**
 * Helper to get the active IVR Integration for a company/client
 */
async function getActiveIvrIntegration(companyId, clientId = null) {
  const query = {
    type: 'ivr',
    isActive: true,
  };

  const orConditions = [{ companyId: null }];
  if (companyId) {
    orConditions.push({ companyId });
  }
  if (clientId) {
    orConditions.push({ clientId });
  }
  query.$or = orConditions;

  // Prioritize client-specific, then company-specific, then platform-level
  const integrations = await Integration.find(query).sort({ clientId: -1, companyId: -1 }).lean();
  return integrations[0] || null;
}

/**
 * Initiate an Outbound Call from CRM
 * POST /api/ivr/outbound-call
 */
exports.initiateOutboundCall = async (req, res) => {
  try {
    const { leadId, customerPhone, agentPhone, did } = req.body;
    const userId = req.user?._id || req.user?.id;
    const userRole = req.user?.role;
    const userPhone = req.user?.phone || '';
    const companyId = req.companyId || req.user?.agencyId || req.user?.brandId || null;
    const isPlatformAdmin = PLATFORM_ADMIN_ROLES.includes(userRole);

    // 1. Package Entitlement Check:
    // Check if user or their assigned package is entitled to 'ivr'
    const userIntegrations = req.user?.integrations || [];
    const isEntitled = isPlatformAdmin || userIntegrations.includes('ivr');

    if (!isEntitled) {
      return res.status(403).json({
        success: false,
        message: 'IVR Telephony is not included in your current package. Please upgrade or contact support.',
      });
    }

    let targetCustomerPhone = customerPhone;
    let targetLead = null;

    if (leadId) {
      targetLead = await Lead.findById(leadId);
      if (!targetLead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }
      targetCustomerPhone = targetLead.phoneNumber || targetLead.mobile || customerPhone;
    }

    if (!targetCustomerPhone) {
      return res.status(400).json({
        success: false,
        message: 'A valid customer phone number is required to initiate a call',
      });
    }

    const targetAgentPhone = agentPhone || userPhone;

    // 2. Resolve configured IVR integration settings from MongoDB
    const effectiveCompanyId = companyId || targetLead?.companyId;
    const effectiveClientId = targetLead?.clientId;
    const ivrIntegration = await getActiveIvrIntegration(effectiveCompanyId, effectiveClientId);
    const ivrConfig = ivrIntegration?.config || {};

    // 3. Call Sollu telephony service with dynamic configuration
    const solluResult = await solluService.initiateOutboundCall({
      customerPhone: targetCustomerPhone,
      agentPhone: targetAgentPhone,
      did: did || ivrConfig.did,
      leadId: targetLead?._id,
      agentId: userId,
      ivrConfig,
      metadata: {
        initiatedBy: req.user?.name || 'CRM User',
        companyId: effectiveCompanyId,
      },
    });

    const callId = solluResult.callId;

    // 4. Create or update initial CallLog record
    const callLog = await CallLog.findOneAndUpdate(
      { callId },
      {
        $set: {
          callId,
          customerPhone: solluService.normalizePhoneNumber(targetCustomerPhone),
          agentPhone: solluService.normalizePhoneNumber(targetAgentPhone),
          leadId: targetLead?._id || null,
          agentId: userId || null,
          companyId: effectiveCompanyId || null,
          clientId: effectiveClientId || null,
          status: 'Initiated',
          direction: 'outbound',
          did: solluResult.did || did || ivrConfig.did || '',
          rawPayload: solluResult.rawResponse || {},
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Append activity log to Lead if linked
    if (targetLead) {
      const agentName = req.user?.name || 'Agent';
      targetLead.activityLogs.push({
        message: `Outbound call initiated to ${targetCustomerPhone} by ${agentName} (Call ID: ${callId})`,
        createdAt: new Date(),
      });
      targetLead.lastInteractionAt = new Date();
      await targetLead.save();
    }

    return res.status(200).json({
      success: true,
      message: solluResult.message || 'Outbound call initiated successfully',
      callId,
      simulated: !!solluResult.simulated,
      data: callLog,
    });
  } catch (error) {
    console.error('[IVR Controller] Initiate Outbound Call Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate outbound call',
    });
  }
};

/**
 * Handle Sollu Webhook / Call Log Delivery
 * POST /api/ivr/webhook
 */
exports.handleSolluWebhook = async (req, res) => {
  try {
    const payload = { ...(req.query || {}), ...(req.body || {}) };
    console.log('[IVR Webhook] Received Sollu webhook payload:', JSON.stringify(payload));

    const externalCallId =
      payload.callid ||
      payload.callId ||
      payload.call_id ||
      payload.id ||
      payload.sid ||
      payload.CallSid ||
      payload.uniqueid ||
      `SOLLU-WH-${Date.now()}`;

    const rawCustomerPhone =
      payload.customer_phone ||
      payload.customerPhone ||
      payload.caller2 ||
      payload.CustomerNumber ||
      payload.called ||
      payload.phone ||
      payload.mobile ||
      '';

    const rawAgentPhone =
      payload.agent_phone ||
      payload.agentPhone ||
      payload.caller1 ||
      payload.AgentNumber ||
      '';

    const normalizedCustomerPhone = solluService.normalizePhoneNumber(rawCustomerPhone);
    const normalizedAgentPhone = solluService.normalizePhoneNumber(rawAgentPhone);

    const direction = (payload.Direction || payload.direction || 'outbound').toLowerCase();
    
    // Normalize status into consistent CRM labels
    let rawStatus = payload.status || payload.CallStatus || payload.dialstatus || payload.call_status || '';
    let normalizedStatus = 'Answered';
    const statusUpper = String(rawStatus).toUpperCase();
    if (
      statusUpper === 'ANSWER' ||
      statusUpper === 'ANSWERED' ||
      statusUpper === 'COMPLETED' ||
      statusUpper === 'SUCCESS'
    ) {
      normalizedStatus = 'Answered';
    } else if (statusUpper.includes('BUSY')) {
      normalizedStatus = 'Busy';
    } else if (statusUpper.includes('NOANSWER') || statusUpper.includes('NO ANSWER')) {
      normalizedStatus = 'No Answer';
    } else if (statusUpper.includes('CANCEL')) {
      normalizedStatus = 'Cancelled';
    } else if (statusUpper.includes('FAIL') || statusUpper.includes('CONGESTION')) {
      normalizedStatus = 'Failed';
    } else if (rawStatus) {
      normalizedStatus = rawStatus;
    }

    const date = payload.date || payload.call_date || '';
    const time = payload.time || payload.call_time || '';
    const callDuration = parseInt(payload.call_duration || payload.callDuration || payload.duration || payload.CallDuration || 0, 10) || 0;
    const totalCallDuration = parseInt(payload.total_call_duration || payload.totalCallDuration || payload.total_duration || 0, 10) || callDuration;
    const did = payload.did || payload.virtual_number || payload.VirtualNumber || payload.exophone || '';
    const callRecording = payload.call_recording || payload.callRecording || payload.recording_url || payload.recordingurl || payload.audio_url || payload.RecordingUrl || '';

    const calledAgents = Array.isArray(payload.calledAgents)
      ? payload.calledAgents.map((a) => ({
          agentName: a.agentName || a.name || '',
          agentNumber: a.agentNumber || a.number || a.phone || '',
        }))
      : [];

    // 1. Check if a call log already exists:
    // First, search by exact externalCallId
    let callLog = await CallLog.findOne({ callId: externalCallId });

    // If not found by externalCallId, look for an 'Initiated' call log for this customer phone created in last 15 minutes
    if (!callLog && normalizedCustomerPhone) {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      const last10 = normalizedCustomerPhone.slice(-10);
      callLog = await CallLog.findOne({
        customerPhone: { $regex: `${last10}$`, $options: 'i' },
        status: { $regex: /^initiated$/i },
        createdAt: { $gte: fifteenMinsAgo },
      }).sort({ createdAt: -1 });
    }

    let matchedLead = null;
    let matchedAgent = null;

    if (callLog && callLog.leadId) {
      matchedLead = await Lead.findById(callLog.leadId);
    } else {
      matchedLead = await findLeadByPhone(rawCustomerPhone);
    }

    if (callLog && callLog.agentId) {
      matchedAgent = await User.findById(callLog.agentId);
    } else {
      matchedAgent = await findAgentByPhone(rawAgentPhone || (calledAgents[0] && calledAgents[0].agentNumber));
    }

    const effectiveCompanyId = matchedLead?.companyId || callLog?.companyId || null;
    const ivrIntegration = await getActiveIvrIntegration(effectiveCompanyId, matchedLead?.clientId);
    const ivrConfig = ivrIntegration?.config || {};

    // Verify webhook signature if configured in IVR integration
    if (ivrConfig.webhookSecret && !solluService.verifyWebhookRequest(req, ivrConfig.webhookSecret)) {
      console.warn('[IVR Webhook] Unauthorized webhook attempt rejected for callId:', externalCallId);
      return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
    }

    const callRecordingUrl = solluService.resolveRecordingUrl(callRecording, ivrConfig.recordingBaseUrl);

    // Target callId to update (preserve existing initiated callId to avoid duplicate records, or use externalCallId)
    const targetCallId = callLog ? callLog.callId : externalCallId;

    // 2. Upsert CallLog idempotently
    const updateData = {
      callId: targetCallId,
      customerPhone: normalizedCustomerPhone || (callLog ? callLog.customerPhone : ''),
      agentPhone: normalizedAgentPhone || (callLog ? callLog.agentPhone : ''),
      status: normalizedStatus,
      direction: direction === 'inbound' ? 'inbound' : 'outbound',
      date: date || (callLog ? callLog.date : ''),
      time: time || (callLog ? callLog.time : ''),
      callDuration: callDuration || (callLog ? callLog.callDuration : 0),
      totalCallDuration: totalCallDuration || (callLog ? callLog.totalCallDuration : callDuration),
      did: did || (callLog ? callLog.did : ''),
      callRecording: callRecording || (callLog ? callLog.callRecording : ''),
      callRecordingUrl: callRecordingUrl || (callLog ? callLog.callRecordingUrl : ''),
      calledAgents: calledAgents.length > 0 ? calledAgents : (callLog?.calledAgents || []),
      rawPayload: payload,
    };

    if (matchedLead) {
      updateData.leadId = matchedLead._id;
      updateData.companyId = matchedLead.companyId || null;
      updateData.clientId = matchedLead.clientId || null;
    }

    if (matchedAgent) {
      updateData.agentId = matchedAgent._id;
    }

    callLog = await CallLog.findOneAndUpdate(
      { callId: targetCallId },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 3. Update Lead Activity Log
    if (matchedLead) {
      const durationMsg = callDuration > 0 ? ` (Duration: ${callDuration}s)` : '';
      const agentLabel = matchedAgent ? ` with ${matchedAgent.name}` : (calledAgents[0]?.agentName ? ` with ${calledAgents[0].agentName}` : '');
      const recMsg = callRecordingUrl ? ' [Recording Available]' : '';

      matchedLead.activityLogs.push({
        message: `Call [${direction.toUpperCase()}] ${status}${agentLabel}${durationMsg}${recMsg} (Call ID: ${externalCallId})`,
        createdAt: new Date(),
      });
      matchedLead.lastInteractionAt = new Date();
      await matchedLead.save();
    }

    console.log(`[IVR Webhook] Successfully processed call ${externalCallId} for phone ${normalizedCustomerPhone}`);

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      callId: externalCallId,
      data: callLog,
    });
  } catch (error) {
    console.error('[IVR Webhook] Processing Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while processing webhook',
    });
  }
};

/**
 * Get Call History for a specific Lead
 * GET /api/ivr/leads/:leadId/calls
 */
exports.getLeadCallLogs = async (req, res) => {
  try {
    const { leadId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({ success: false, message: 'Invalid lead ID format' });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const normalizedPhone = solluService.normalizePhoneNumber(lead.phoneNumber || lead.mobile);
    const last10 = normalizedPhone ? normalizedPhone.slice(-10) : '';

    const query = {
      $or: [
        { leadId: new mongoose.Types.ObjectId(leadId) },
        ...(last10 ? [{ customerPhone: { $regex: `${last10}$`, $options: 'i' } }] : []),
      ],
    };

    const callLogs = await CallLog.find(query)
      .populate('agentId', 'name email phone avatar')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: callLogs,
    });
  } catch (error) {
    console.error('[IVR Controller] Get Lead Call Logs Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch lead call logs',
    });
  }
};

/**
 * Get Paginated Call Logs (Agency/Brand Level)
 * GET /api/ivr/calls
 */
exports.getAllCallLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, direction, search, startDate, endDate } = req.query;
    const companyId = req.companyId || req.user?.agencyId || req.user?.brandId || null;

    const query = {};
    if (companyId) {
      query.companyId = companyId;
    }

    if (status) {
      query.status = status;
    }

    if (direction) {
      query.direction = direction;
    }

    if (search) {
      const searchNormalized = solluService.normalizePhoneNumber(search);
      query.$or = [
        { customerPhone: { $regex: searchNormalized || search, $options: 'i' } },
        { agentPhone: { $regex: searchNormalized || search, $options: 'i' } },
        { callId: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await CallLog.countDocuments(query);
    const calls = await CallLog.find(query)
      .populate('leadId', 'fullName companyName phoneNumber email')
      .populate('agentId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
    return res.status(200).json({
      success: true,
      data: {
        calls,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    console.error('[IVR Controller] Get All Call Logs Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch call logs',
    });
  }
};

/**
 * Get Status of a specific call by callId (with optional leadId / customerPhone fallback)
 * GET /api/ivr/calls/status/:callId
 */
exports.getCallStatus = async (req, res) => {
  try {
    const { callId } = req.params;
    const { leadId, customerPhone } = req.query;

    let callLog = null;
    if (callId && callId !== 'undefined' && callId !== 'null') {
      callLog = await CallLog.findOne({ callId }).lean();
    }

    if (!callLog && leadId && mongoose.Types.ObjectId.isValid(leadId)) {
      // Find the most recent call log created in the last 15 minutes for this lead
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      callLog = await CallLog.findOne({
        leadId,
        createdAt: { $gte: fifteenMinsAgo },
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    if (!callLog && customerPhone) {
      const normalized = solluService.normalizePhoneNumber(customerPhone);
      const last10 = normalized ? normalized.slice(-10) : '';
      if (last10) {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        callLog = await CallLog.findOne({
          customerPhone: { $regex: `${last10}$`, $options: 'i' },
          createdAt: { $gte: fifteenMinsAgo },
        })
          .sort({ createdAt: -1 })
          .lean();
      }
    }

    if (!callLog) {
      return res.status(200).json({
        success: true,
        data: {
          callId,
          status: 'Initiated',
          isEnded: false,
          callDuration: 0,
        },
      });
    }

    const statusUpper = (callLog.status || '').toUpperCase();
    const isEnded =
      [
        'COMPLETED',
        'ENDED',
        'DISCONNECTED',
        'FAILED',
        'BUSY',
        'NOANSWER',
        'NO ANSWER',
        'CANCEL',
        'CANCELLED',
        'MISSED',
        'ANSWER',
        'ANSWERED',
      ].includes(statusUpper) ||
      (callLog.callDuration > 0 &&
        !['INITIATED', 'RINGING', 'IN_PROGRESS', 'IN PROGRESS', 'ACTIVE'].includes(statusUpper));

    return res.status(200).json({
      success: true,
      data: {
        callId: callLog.callId,
        status: callLog.status,
        isEnded: !!isEnded,
        callDuration: callLog.callDuration || 0,
        totalCallDuration: callLog.totalCallDuration || 0,
        callRecordingUrl: callLog.callRecordingUrl || '',
      },
    });
  } catch (error) {
    console.error('[IVR Controller] Get Call Status Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

