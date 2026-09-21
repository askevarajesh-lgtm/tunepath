const { Campaign, CampaignRecharge } = require("./campaign.model");
const Notification = require("../tasks/notification.model");
const User = require("../auth/user.model");
const { createTimelineEvent } = require("../projects/shimTimelineHelper");
const logger = require("../tasks/dummyLogger");
const {
  buildQuery,
  executePaginatedQuery,
} = require("../../utils/pagination.helper");
const {
  buildDropdownQuery,
  executeDropdownQuery,
} = require("../projects/shimDropdown");

/**
 * Sync campaign status based on start and end dates
 * @param {Object} campaign - Campaign document
 * @returns {String} The calculated status
 */
const calculateStatusByDate = (startDate, endDate, currentStatus) => {
  // Respect manual overrides
  if (["paused", "cancelled"].includes(currentStatus)) {
    return currentStatus;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (today < start) {
    return "planned";
  } else if (today >= start && today <= end) {
    return "active";
  } else {
    // today > end
    return "completed";
  }
};

/**
 * Sync campaign status and save if changed
 * @param {Object} campaign - Campaign document (may be lean or Mongoose document)
 */
const syncCampaignStatus = async (campaign) => {
  const newStatus = calculateStatusByDate(
    campaign.startDate,
    campaign.endDate,
    campaign.status,
  );

  if (newStatus !== campaign.status) {
    const oldStatus = campaign.status;
    campaign.status = newStatus;

    try {
      if (typeof campaign.save === "function") {
        await campaign.save();
      } else {
        const { Campaign } = require("./campaign.model");
        await Campaign.updateOne({ _id: campaign._id }, { status: newStatus });
      }
    } catch (error) {
      console.error(
        `Failed to sync status for campaign ${campaign._id}:`,
        error,
      );
      // Revert in-memory change if DB update failed?
      // Actually, better to just log and continue to avoid crashing the whole list
    }
  }
};

const getAllCampaigns = async (
  companyId,
  reqQuery = {},
  userRole = null,
  userId = null,
) => {
  // Support both clientId (legacy) and clientCompanyId
  const clientCompanyId = reqQuery.clientCompanyId || reqQuery.clientId;

  const additionalFilters = {
    companyId,
    // Additional filters from query params
    ...(clientCompanyId && { clientCompanyId }),
    ...(reqQuery.projectId && { projectId: reqQuery.projectId }),
    ...(reqQuery.status && { status: reqQuery.status }),
    ...(reqQuery.platform && { platform: reqQuery.platform }),
  };

  // Apply role-based data filtering
  // Client role sees only their own campaigns
  if (userRole === "client" && userId) {
    const user = await User.findById(userId).select("clientId");
    if (user && user.clientId) {
      additionalFilters.clientCompanyId = user.clientId;
      // Also check legacy clientId if it exists in model (service uses $or sometimes)
      additionalFilters.$or = [
        { clientCompanyId: user.clientId },
        { clientId: user.clientId },
      ];
    } else {
      additionalFilters._id = null;
    }
  }
  // Sales roles only see campaigns for their assigned clients
  else if (
    userRole &&
    ["salesperson", "sales_executive", "bde"].includes(userRole) &&
    userId
  ) {
    const User = require("../auth/user.model");
    const user = await User.findById(userId).select("assignedClients");
    if (user && user.assignedClients && user.assignedClients.length > 0) {
      additionalFilters.clientCompanyId = { $in: user.assignedClients };
      // Also support legacy clientId
      additionalFilters.$or = [
        { clientCompanyId: { $in: user.assignedClients } },
        { clientId: { $in: user.assignedClients } },
      ];
    } else {
      // No assigned clients, return empty result
      additionalFilters._id = null; // This will return no results
    }
  }

  // Build query with pagination, search, and sort
  const queryOptions = buildQuery(reqQuery, {
    searchFields: ["platform"],
    defaultSortField: "startDate",
    defaultSortOrder: "desc",
    additionalFilters,
  });

  // Execute paginated query with populate
  const result = await executePaginatedQuery(Campaign, queryOptions, [
    { path: "clientCompanyId", select: "name email phone address" },
    { path: "projectId", select: "name status invoiceId" },
    { path: "createdBy", select: "name email" },
    { path: "managedBy", select: "name email" },
    { path: "rechargeHistory.clientCompanyIds", select: "name email" },
    { path: "rechargeHistory.clientCompanyId", select: "name email" },
    { path: "rechargeHistory.rechargedBy", select: "name email" },
  ]);

  // Sync statuses for all campaigns in the result
  if (result.data && result.data.length > 0) {
    // Ensure clientId legacy field is available for backward compatibility
    result.data.forEach((campaign) => {
      if (!campaign.clientId && campaign.clientCompanyId) {
        campaign.clientId = campaign.clientCompanyId;
      }
    });

    await Promise.all(
      result.data.map((campaign) => syncCampaignStatus(campaign)),
    );
  }

  return result;
};

// Dropdown query for campaigns
const getCampaignsDropdown = async (
  companyId,
  reqQuery = {},
  userRole = null,
  userId = null,
) => {
  const clientCompanyId = reqQuery.clientCompanyId || reqQuery.clientId;

  const additionalFilters = {
    companyId,
    ...(clientCompanyId && { clientCompanyId }),
    ...(reqQuery.status && { status: reqQuery.status }),
  };

  // Apply role-based data filtering
  if (userRole === "client" && userId) {
    const user = await User.findById(userId).select("clientId");
    if (user && user.clientId) {
      additionalFilters.$or = [
        { clientCompanyId: user.clientId },
        { clientId: user.clientId },
      ];
    } else {
      additionalFilters._id = null;
    }
  }

  const queryOptions = buildDropdownQuery(reqQuery, {
    searchFields: ["platform"],
    defaultSortField: "startDate",
    defaultSortOrder: "desc",
    additionalFilters,
  });

  return await executeDropdownQuery(
    Campaign,
    queryOptions,
    [
      { path: "clientCompanyId", select: "name email phone" },
      { path: "clientId", select: "name email phone" },
      { path: "projectId", select: "name status departments invoiceId" },
    ],
    "platform startDate endDate status clientCompanyId clientId projectId dailyBudget campaignDays totalCampaignValue campaignAmount",
  );
};
const getCampaignById = async (
  campaignId,
  companyId,
  userRole = null,
  userId = null,
) => {
  const filter = {
    _id: campaignId,
    companyId,
  };

  // Apply role-based data filtering
  if (userRole === "client" && userId) {
    const user = await User.findById(userId).select("clientId");
    if (user && user.clientId) {
      filter.$or = [
        { clientCompanyId: user.clientId },
        { clientId: user.clientId },
      ];
    } else {
      return null;
    }
  }

  let campaign = await Campaign.findOne(filter)
    .populate({
      path: "clientCompanyId",
      select: "name email phone address",
    })
    .populate({
      path: "projectId",
      select: "name status invoiceId",
    })
    .populate({
      path: "createdBy",
      select: "name email",
    })
    .populate({
      path: "managedBy",
      select: "name email",
    })
    .populate({
      path: "rechargeHistory.clientCompanyIds",
      select: "name email",
    })
    .populate({
      path: "rechargeHistory.clientCompanyId",
      select: "name email",
    })
    .populate({
      path: "rechargeHistory.rechargedBy",
      select: "name email",
    });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Ensure clientId legacy field is also available for backward compatibility
  if (!campaign.clientId && campaign.clientCompanyId) {
    campaign.clientId = campaign.clientCompanyId;
  }

  // Sync status before returning
  await syncCampaignStatus(campaign);

  return campaign;
};

const createCampaign = async (campaignData, companyId, performedByUserId) => {
  // Map clientId to clientCompanyId if provided
  if (campaignData.clientId && !campaignData.clientCompanyId) {
    campaignData.clientCompanyId = campaignData.clientId;
  }

  campaignData.companyId = companyId;
  campaignData.createdBy = performedByUserId;

  // Set initial status based on dates
  campaignData.status = calculateStatusByDate(
    campaignData.startDate,
    campaignData.endDate,
    "planned",
  );

  const campaign = await Campaign.create(campaignData);

  await createTimelineEvent({
    eventType: "campaign_created",
    entityType: "Campaign",
    entityId: campaign._id,
    performedByUserId,
    description: `Campaign created for ${campaign.platform}`,
    metadata: {
      platform: campaign.platform,
      clientCompanyId:
        campaign.clientCompanyId?.toString() || campaign.clientCompanyId,
    },
    companyId,
  });

  return await getCampaignById(campaign._id, companyId);
};

const addDailyData = async (
  campaignId,
  dailyData,
  companyId,
  performedByUserId,
) => {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    companyId,
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  campaign.dailyData.push(dailyData);
  campaign.calculateActualSpend();
  await campaign.save();

  await createTimelineEvent({
    eventType: "campaign_daily_data_added",
    entityType: "campaign",
    entityId: campaign._id,
    performedByUserId,
    description: `Daily campaign data added for ${new Date(dailyData.date).toLocaleDateString()}`,
    metadata: {
      date: dailyData.date,
      spend: dailyData.spend,
    },
    companyId,
  });

  return await getCampaignById(campaign._id, companyId);
};

/**
 * Update campaign payment details
 * @param {String} campaignId - Campaign ID
 * @param {Object} paymentData - Payment data (amountPaidByClient, paymentStatus, paidDate, gstAmount)
 * @param {String} companyId - Tenant company ID
 * @param {String} performedByUserId - User ID performing the action
 */
const updatePayment = async (
  campaignId,
  paymentData,
  companyId,
  performedByUserId,
) => {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    companyId,
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Update payment fields
  if (paymentData.amountPaidByClient !== undefined) {
    campaign.amountPaidByClient = paymentData.amountPaidByClient;
  }
  if (paymentData.paymentStatus) {
    campaign.paymentStatus = paymentData.paymentStatus;
  }
  if (paymentData.paidDate) {
    campaign.paidDate = new Date(paymentData.paidDate);
  } else if (paymentData.paymentStatus === "paid" && !campaign.paidDate) {
    campaign.paidDate = new Date();
  }
  if (paymentData.gstAmount !== undefined) {
    campaign.gstAmount = paymentData.gstAmount;
  }

  await campaign.save();

  await createTimelineEvent({
    eventType: "campaign_payment_updated",
    entityType: "Campaign",
    entityId: campaign._id,
    performedByUserId,
    description: `Campaign payment updated: ${paymentData.paymentStatus || campaign.paymentStatus}`,
    metadata: {
      paymentStatus: campaign.paymentStatus,
      amountPaidByClient: campaign.amountPaidByClient,
      gstAmount: campaign.gstAmount,
      paidDate: campaign.paidDate,
    },
    companyId,
  });

  return await getCampaignById(campaign._id, companyId);
};

/**
 * Reconcile campaign payment
 * @param {String} campaignId - Campaign ID
 * @param {Object} reconciliationData - Reconciliation data (type, notes, discrepancyAmount)
 * @param {String} companyId - Tenant company ID
 * @param {String} performedByUserId - User ID performing the action
 */
const reconcilePayment = async (
  campaignId,
  reconciliationData,
  companyId,
  performedByUserId,
) => {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    companyId,
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Update reconciliation
  campaign.paymentReconciliation.type = reconciliationData.type || "reconciled";
  campaign.paymentReconciliation.reconciledAt = new Date();
  campaign.paymentReconciliation.reconciledBy = performedByUserId;
  if (reconciliationData.notes) {
    campaign.paymentReconciliation.notes = reconciliationData.notes;
  }
  if (reconciliationData.discrepancyAmount !== undefined) {
    campaign.paymentReconciliation.discrepancyAmount =
      reconciliationData.discrepancyAmount;
  }

  await campaign.save();

  await createTimelineEvent({
    eventType: "campaign_payment_reconciled",
    entityType: "Campaign",
    entityId: campaign._id,
    performedByUserId,
    description: `Campaign payment reconciled: ${reconciliationData.type}`,
    metadata: {
      reconciliationType: campaign.paymentReconciliation.type,
      discrepancyAmount: campaign.paymentReconciliation.discrepancyAmount,
      notes: campaign.paymentReconciliation.notes,
    },
    companyId,
  });

  return await getCampaignById(campaign._id, companyId);
};

/**
 * Add campaign recharge
 * @param {String} campaignId - Campaign ID
 * @param {Object} rechargeData - Recharge data (clientCompanyId, clientAmount, rechargeAmount, notes)
 * @param {String} companyId - Tenant company ID
 * @param {String} performedByUserId - User ID performing the action
 */
const addRecharge = async (
  campaignId,
  rechargeData,
  companyId,
  performedByUserId,
  userRole = null,
) => {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    companyId,
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Validate recharge data
  if (!rechargeData.clientCompanyId) {
    throw new Error("Client company ID is required");
  }
  if (!rechargeData.rechargeAmount || rechargeData.rechargeAmount <= 0) {
    throw new Error("Recharge amount must be greater than 0");
  }

  // Only Admin can fill clientAmount
  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const clientAmount = isAdmin ? rechargeData.clientAmount || 0 : 0;

  // Create recharge record
  const rechargeRecord = {
    platform: rechargeData.platform,
    rechargeDate: rechargeData.rechargeDate
      ? new Date(rechargeData.rechargeDate)
      : new Date(),
    activeCampaignsCount: rechargeData.activeCampaignsCount || 0,
    clientCompanyIds: rechargeData.clientCompanyIds || [],
    clientCompanyId: rechargeData.clientCompanyId, // Supporting legacy if provided
    dailyAmountSpent: rechargeData.dailyAmountSpent || 0,
    dailyBudget: rechargeData.dailyBudget || 0,
    clientAmount: clientAmount,
    rechargeAmount: rechargeData.rechargeAmount,
    rechargedBy: performedByUserId,
    rechargedAt: new Date(),
    notes: rechargeData.notes || "",
  };

  // Add to recharge history
  campaign.rechargeHistory.push(rechargeRecord);
  await campaign.save();

  await createTimelineEvent({
    eventType: "campaign_recharge_added",
    entityType: "Campaign",
    entityId: campaign._id,
    performedByUserId,
    description: `Campaign recharge added for ${rechargeRecord.platform || campaign.platform}: ₹${rechargeData.rechargeAmount}`,
    metadata: {
      platform: rechargeRecord.platform,
      rechargeDate: rechargeRecord.rechargeDate,
      rechargeAmount: rechargeData.rechargeAmount,
      notes: rechargeData.notes,
    },
    companyId,
  });

  // Notify Admins if recharge was added by a non-admin
  if (userRole !== "admin" && userRole !== "super_admin") {
    const performer = await User.findById(performedByUserId).select("name");
    await notifyAdminsOfRecharge(
      companyId,
      rechargeRecord,
      performer?.name || "A user",
    );
  }

  return await getCampaignById(campaign._id, companyId);
};

const updateCampaign = async (
  campaignId,
  campaignData,
  companyId,
  performedByUserId,
) => {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    companyId,
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Allowed updates
  const allowedUpdates = [
    "platform",
    "startDate",
    "endDate",
    "campaignDays",
    "dailyBudget",
    "campaignAmount",
    "totalCampaignValue",
    "status",
    "notes",
    "managedBy",
    "projectId",
  ];

  const changes = [];
  allowedUpdates.forEach((field) => {
    if (campaignData[field] !== undefined) {
      if (
        JSON.stringify(campaign[field]) !== JSON.stringify(campaignData[field])
      ) {
        changes.push(field);
        campaign[field] = campaignData[field];
      }
    }
  });

  if (changes.length > 0) {
    // If dates changed, recalculate status
    if (changes.includes("startDate") || changes.includes("endDate")) {
      campaign.status = calculateStatusByDate(
        campaign.startDate,
        campaign.endDate,
        campaign.status,
      );
    }
    await campaign.save();

    await createTimelineEvent({
      eventType: "campaign_updated",
      entityType: "Campaign",
      entityId: campaign._id,
      performedByUserId,
      description: `Campaign for ${campaign.platform} updated`,
      metadata: {
        platform: campaign.platform,
        fieldsChanged: changes,
      },
      companyId,
    });
  }

  return await getCampaignById(campaign._id, companyId);
};

const deleteCampaign = async (campaignId, companyId, performedByUserId) => {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    companyId,
  });

  if (!campaign) {
    throw new Error("Campaign not found or already deleted");
  }

  // Store campaign data for timeline event before deletion
  const campaignData = {
    _id: campaign._id,
    platform: campaign.platform,
  };

  // Hard delete
  await Campaign.findByIdAndDelete(campaignId);

  await createTimelineEvent({
    eventType: "campaign_deleted",
    entityType: "Campaign",
    entityId: campaignData._id,
    performedByUserId,
    description: `Campaign for ${campaignData.platform} deleted`,
    metadata: {
      platform: campaignData.platform,
      campaignId: campaignData._id.toString(),
    },
    companyId,
  });

  return { message: "Campaign deleted successfully" };
};

/**
 * Add global campaign recharge (not linked to a specific campaign instance)
 * @param {Object} rechargeData - Recharge data
 * @param {String} companyId - Tenant company ID
 * @param {String} performedByUserId - User ID performing the action
 */
const addGlobalRecharge = async (
  rechargeData,
  companyId,
  performedByUserId,
  userRole = null,
) => {
  // Handle batch details if provided
  const clientRecharges = [];
  let totalSpent = 0;
  let totalBudget = 0;
  let totalRecharge = 0;

  if (rechargeData.clientDetails && rechargeData.clientCompanyIds) {
    rechargeData.clientCompanyIds.forEach((clientId) => {
      const details = rechargeData.clientDetails[clientId] || {};
      const spent = Number(details.dailyAmountSpent || 0);
      const budget = Number(details.dailyBudget || 0);
      const recharge = Number(details.rechargeAmount || 0);

      clientRecharges.push({
        clientId,
        dailyAmountSpent: spent,
        dailyBudget: budget,
        rechargeAmount: recharge,
      });

      totalSpent += spent;
      totalBudget += budget;
      totalRecharge += recharge;
    });
  } else {
    // Legacy or single entry support
    totalSpent = rechargeData.dailyAmountSpent || 0;
    totalBudget = rechargeData.dailyBudget || 0;
    totalRecharge = rechargeData.rechargeAmount || 0;

    if (
      rechargeData.clientCompanyId ||
      (rechargeData.clientCompanyIds &&
        rechargeData.clientCompanyIds.length === 1)
    ) {
      const cId =
        rechargeData.clientCompanyId || rechargeData.clientCompanyIds[0];
      clientRecharges.push({
        clientId: cId,
        dailyAmountSpent: totalSpent,
        dailyBudget: totalBudget,
        rechargeAmount: totalRecharge,
      });
    }
  }

  // Create recharge record
  const rechargeRecord = new CampaignRecharge({
    companyId,
    platform: rechargeData.platform,
    rechargeDate: rechargeData.rechargeDate
      ? new Date(rechargeData.rechargeDate)
      : new Date(),
    activeCampaignsCount: rechargeData.activeCampaignsCount || 0,
    clientCompanyIds: rechargeData.clientCompanyIds || [],
    clientRecharges: clientRecharges,
    clientCompanyId: rechargeData.clientCompanyId, // Supporting legacy if provided
    dailyAmountSpent: Number(totalSpent.toFixed(2)),
    dailyBudget: Number(totalBudget.toFixed(2)),
    rechargeAmount: Number(totalRecharge.toFixed(2)),
    rechargedBy: performedByUserId,
    rechargedAt: new Date(),
    notes: rechargeData.notes || "",
  });

  await rechargeRecord.save();

  await createTimelineEvent({
    eventType: "campaign_recharge_added",
    entityType: "GlobalRecharge",
    entityId: rechargeRecord._id,
    performedByUserId,
    description: `Global campaign recharge added for ${rechargeRecord.platform}: ₹${rechargeData.rechargeAmount}`,
    metadata: {
      platform: rechargeRecord.platform,
      rechargeDate: rechargeRecord.rechargeDate,
      rechargeAmount: rechargeData.rechargeAmount,
      notes: rechargeData.notes,
    },
    companyId,
  });

  // Notify Admins if recharge was added by a non-admin
  if (userRole !== "admin" && userRole !== "super_admin") {
    const performer = await User.findById(performedByUserId).select("name");
    await notifyAdminsOfRecharge(
      companyId,
      rechargeRecord,
      performer?.name || "A user",
    );
  }

  return await CampaignRecharge.findById(rechargeRecord._id)
    .populate("clientCompanyIds", "name email")
    .populate("clientCompanyId", "name email")
    .populate("rechargedBy", "name email");
};

/**
 * Notify all admins about a new campaign recharge
 * @param {String} companyId - Tenant company ID
 * @param {Object} rechargeData - The recharge data
 * @param {String} performerName - Name of the person who added the recharge
 */
const notifyAdminsOfRecharge = async (
  companyId,
  rechargeData,
  performerName,
) => {
  try {
    // Find all admins and super admins for this company
    const admins = await User.find({
      companyId,
      role: { $in: ["admin", "super_admin"] },
      isActive: true,
    }).select("_id");

    if (!admins || admins.length === 0) return;

    const platform =
      rechargeData.platform?.replace("_", " ").toUpperCase() ||
      "Unknown Platform";
    const amount = (rechargeData.rechargeAmount || 0).toLocaleString("en-IN");
    const title = "New Campaign Recharge Added";
    const message = `${performerName} added a recharge of ₹${amount} for ${platform}.`;

    const socketIO = require("../tasks/shimSocket");

    for (const admin of admins) {
      try {
        const notification = await Notification.create({
          userId: admin._id,
          type: "campaign_recharge_added",
          title,
          message,
          metadata: {
            rechargeAmount: rechargeData.rechargeAmount,
            platform: rechargeData.platform,
          },
        });

        // Emit via Socket.IO
        socketIO.emitNotification(admin._id.toString(), notification);
      } catch (err) {
        logger.error(`Failed to notify admin ${admin._id}:`, err);
      }
    }
  } catch (error) {
    logger.error("Error in notifyAdminsOfRecharge:", error);
  }
};

/**
 * Get all global recharges for a company
 * @param {String} companyId - Tenant company ID
 * @param {Object} reqQuery - Query parameters for pagination/filtering
 */
const getAllRecharges = async (
  companyId,
  reqQuery = {},
  userRole = null,
  userId = null,
) => {
  const clientCompanyId = reqQuery.clientCompanyId || reqQuery.clientId;
  const additionalFilters = { companyId };

  // Apply filter from query params if provided (for admins using client selector)
  if (clientCompanyId) {
    additionalFilters.$or = [
      { clientCompanyIds: clientCompanyId },
      { clientCompanyId: clientCompanyId },
    ];
  }

  if (reqQuery.platform) {
    additionalFilters.platform = reqQuery.platform;
  }

  // Apply role-based data filtering
  if (userRole === "client" && userId) {
    const user = await User.findById(userId).select("clientId");
    if (user && user.clientId) {
      additionalFilters.$or = [
        { clientCompanyIds: user.clientId },
        { clientCompanyId: user.clientId },
      ];
    } else {
      additionalFilters._id = null;
    }
  }

  const queryOptions = buildQuery(reqQuery, {
    searchFields: ["platform"],
    defaultSortField: "rechargeDate",
    defaultSortOrder: "desc",
    additionalFilters,
  });

  return await executePaginatedQuery(CampaignRecharge, queryOptions, [
    { path: "clientCompanyIds", select: "name email" },
    { path: "clientCompanyId", select: "name email" },
    { path: "rechargedBy", select: "name email" },
  ]);
};

/**
 * Update global campaign recharge
 * @param {String} rechargeId - Recharge ID
 * @param {Object} updateData - Data to update
 * @param {String} companyId - Tenant company ID
 * @param {String} performedByUserId - User ID performing the action
 * @param {String} userRole - User role
 */
const updateGlobalRecharge = async (
  rechargeId,
  updateData,
  companyId,
  performedByUserId,
  userRole = null,
) => {
  const recharge = await CampaignRecharge.findOne({
    _id: rechargeId,
    companyId,
  });

  if (!recharge) {
    throw new Error("Recharge record not found");
  }

  // Fields allowed to be updated
  const allowedUpdates = [
    "platform",
    "rechargeDate",
    "activeCampaignsCount",
    "clientCompanyIds",
    "clientCompanyId",
    "dailyAmountSpent",
    "dailyBudget",
    "rechargeAmount",
    "notes",
  ];

  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const changes = [];

  // Handle clientRecharges breakdown and aggregation if clientDetails is provided
  if (updateData.clientDetails && updateData.clientCompanyIds) {
    const clientRecharges = [];
    let totalSpent = 0;
    let totalBudget = 0;
    let totalRecharge = 0;

    updateData.clientCompanyIds.forEach((clientId) => {
      const details = updateData.clientDetails[clientId] || {};
      const spent = Number(details.dailyAmountSpent || 0);
      const budget = Number(details.dailyBudget || 0);
      const recharge = Number(details.rechargeAmount || 0);

      clientRecharges.push({
        clientId,
        dailyAmountSpent: spent,
        dailyBudget: budget,
        rechargeAmount: recharge,
      });

      totalSpent += spent;
      totalBudget += budget;
      totalRecharge += recharge;
    });

    recharge.clientRecharges = clientRecharges;
    recharge.dailyAmountSpent = Number(totalSpent.toFixed(2));
    recharge.dailyBudget = Number(totalBudget.toFixed(2));
    recharge.rechargeAmount = Number(totalRecharge.toFixed(2));
    changes.push(
      "clientRecharges",
      "dailyAmountSpent",
      "dailyBudget",
      "rechargeAmount",
    );
  }

  allowedUpdates.forEach((field) => {
    // If field was already handled by aggregation, skip
    if (
      ["dailyAmountSpent", "dailyBudget", "rechargeAmount"].includes(field) &&
      updateData.clientDetails
    ) {
      return;
    }

    if (updateData[field] !== undefined) {
      if (
        JSON.stringify(recharge[field]) !== JSON.stringify(updateData[field])
      ) {
        changes.push(field);
        recharge[field] = updateData[field];
      }
    }
  });

  if (changes.length > 0) {
    await recharge.save();

    await createTimelineEvent({
      eventType: "campaign_recharge_updated",
      entityType: "GlobalRecharge",
      entityId: recharge._id,
      performedByUserId,
      description: `Global campaign recharge for ${recharge.platform} updated`,
      metadata: {
        platform: recharge.platform,
        fieldsChanged: changes,
      },
      companyId,
    });
  }

  return await CampaignRecharge.findById(recharge._id)
    .populate("clientCompanyIds", "name email")
    .populate("clientCompanyId", "name email")
    .populate("rechargedBy", "name email");
};

/**
 * Delete global campaign recharge
 * @param {String} rechargeId - Recharge ID
 * @param {String} companyId - Tenant company ID
 */
const deleteGlobalRecharge = async (rechargeId, companyId) => {
  const result = await CampaignRecharge.deleteOne({
    _id: rechargeId,
    companyId,
  });

  if (result.deletedCount === 0) {
    throw new Error("Recharge record not found");
  }

  return { message: "Recharge record deleted successfully" };
};

/**
 * Update campaign recharge (single campaign)
 * @param {String} campaignId - Campaign ID
 * @param {String} rechargeId - Recharge ID
 * @param {Object} updateData - Data to update
 * @param {String} companyId - Tenant company ID
 * @param {String} performedByUserId - User ID performing the action
 * @param {String} userRole - User role
 */
const updateRecharge = async (
  campaignId,
  rechargeId,
  updateData,
  companyId,
  performedByUserId,
  userRole = null,
) => {
  const campaign = await Campaign.findOne({
    _id: campaignId,
    companyId,
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const rechargeIndex = campaign.rechargeHistory.findIndex(
    (r) => r._id.toString() === rechargeId,
  );

  if (rechargeIndex === -1) {
    throw new Error("Recharge record not found");
  }

  const recharge = campaign.rechargeHistory[rechargeIndex];
  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const changes = [];

  const allowedUpdates = [
    "platform",
    "rechargeDate",
    "activeCampaignsCount",
    "clientCompanyIds",
    "clientCompanyId",
    "dailyAmountSpent",
    "dailyBudget",
    "clientAmount",
    "rechargeAmount",
    "notes",
  ];

  allowedUpdates.forEach((field) => {
    if (updateData[field] !== undefined) {
      if (field === "clientAmount" && !isAdmin) {
        return;
      }

      if (
        JSON.stringify(recharge[field]) !== JSON.stringify(updateData[field])
      ) {
        changes.push(field);
        recharge[field] = updateData[field];
      }
    }
  });

  if (changes.length > 0) {
    await campaign.save();

    await createTimelineEvent({
      eventType: "campaign_recharge_updated",
      entityType: "Campaign",
      entityId: campaign._id,
      performedByUserId,
      description: `Campaign recharge updated for ${campaign.platform}`,
      metadata: {
        rechargeId,
        fieldsChanged: changes,
      },
      companyId,
    });
  }

  return await getCampaignById(campaign._id, companyId);
};

/**
 * Get campaign summary for a specific client
 * Returns total campaign value and total recharged amount
 */
const getClientCampaignSummary = async (clientId, companyId) => {
  // 1. Get all campaigns for this client
  const campaigns = await Campaign.find({
    $or: [{ clientId: clientId }, { clientCompanyId: clientId }],
    ...(companyId ? { companyId } : {}),
    status: { $ne: "cancelled" },
  });

  const totalCampaignValue = campaigns.reduce(
    (sum, c) =>
      sum +
      (c.totalCampaignValue ||
        c.campaignAmount ||
        (c.dailyBudget && c.campaignDays ? c.dailyBudget * c.campaignDays : 0) ||
        0),
    0,
  );

  // 2. Get all recharges for this client from GlobalRecharges
  const globalRecharges = await CampaignRecharge.find({
    $or: [
      { clientCompanyId: clientId },
      { clientCompanyIds: clientId },
      { "clientRecharges.clientId": clientId },
    ],
    ...(companyId ? { companyId } : {}),
  });

  const totalGlobalRechargeAmount = globalRecharges.reduce((sum, r) => {
    // If it has clientRecharges breakdown, use the specific amount for this client
    if (r.clientRecharges && r.clientRecharges.length > 0) {
      const clientEntry = r.clientRecharges.find(
        (cr) => cr.clientId?.toString() === clientId.toString(),
      );
      if (clientEntry) {
        return sum + (clientEntry.rechargeAmount || 0);
      }
    }

    // Fallback: If this record ONLY contains this client, use the total recharge amount
    const isSingleClientMatch =
      r.clientCompanyId?.toString() === clientId.toString() ||
      (r.clientCompanyIds?.length === 1 &&
        r.clientCompanyIds[0]?.toString() === clientId.toString());

    if (isSingleClientMatch) {
      return sum + (r.rechargeAmount || 0);
    }

    return sum;
  }, 0);

  // 3. Get all recharges from nested rechargeHistory in Campaign model
  const nestedRechargeAmount = campaigns.reduce((sum, c) => {
    const campaignRecharges = c.rechargeHistory || [];
    return (
      sum + campaignRecharges.reduce((s, r) => s + (r.rechargeAmount || 0), 0)
    );
  }, 0);

  const totalRechargeAmount = totalGlobalRechargeAmount + nestedRechargeAmount;

  return {
    clientId,
    totalCampaignValue,
    totalRechargeAmount,
    remainingBalance: Number(
      (totalCampaignValue - totalRechargeAmount).toFixed(2),
    ),
  };
};

module.exports = {
  getAllCampaigns,
  getCampaignsDropdown,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  addDailyData,
  updatePayment,
  reconcilePayment,
  addRecharge,
  updateRecharge,
  addGlobalRecharge,
  updateGlobalRecharge,
  deleteGlobalRecharge,
  getAllRecharges,
  getClientCampaignSummary,
  syncAllCampaignStatuses: async () => {
    const campaigns = await Campaign.find({
      status: { $nin: ["cancelled"] }, // Don't bother with cancelled campaigns
    });
    let updatedCount = 0;
    for (const campaign of campaigns) {
      const oldStatus = campaign.status;
      const newStatus = calculateStatusByDate(
        campaign.startDate,
        campaign.endDate,
        campaign.status,
      );
      if (oldStatus !== newStatus) {
        campaign.status = newStatus;
        await campaign.save();
        updatedCount++;
      }
    }
    return updatedCount;
  },
};
