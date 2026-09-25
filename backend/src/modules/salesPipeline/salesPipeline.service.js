const Deal = require("./deal.model");
const mongoose = require("mongoose");

const createDeal = async (dealData, companyId, username) => {
  const repName = dealData.rep || "Unassigned";
  const repInitials = dealData.ownerInit || (dealData.rep ? dealData.rep.split(" ").map(n => n[0]).join("").toUpperCase() : "UN");

  const deal = new Deal({
    ...dealData,
    rep: repName,
    ownerInit: repInitials,
    companyId,
    activityLogs: [
      { action: "Deal Created", performedBy: username || "User", details: `Deal created with initial stage: ${dealData.stage || 'lead'}` }
    ]
  });
  return await deal.save();
};

const getAllDeals = async (companyId, query = {}) => {
  await Deal.deleteMany({ companyId, "activityLogs.action": "Deal Seeded" });
  const filter = { companyId };

  if (query.stage) filter.stage = query.stage;
  if (query.priority) filter.priority = query.priority;
  if (query.rep) filter.rep = { $regex: query.rep, $options: 'i' };
  
  if (query.search) {
    const searchRegex = new RegExp(query.search, 'i');
    filter.$or = [
      { name: searchRegex },
      { category: searchRegex },
      { rep: searchRegex }
    ];
  }
  
  const page = parseInt(query.page) || 1;
  const limit = query.limit ? parseInt(query.limit) : null;
  const skip = limit ? (page - 1) * limit : 0;
  
  const sortStage = query.sort ? query.sort : { createdAt: -1 };
  
  let dbQuery = Deal.find(filter).sort(sortStage);
  if (limit) {
    dbQuery = dbQuery.skip(skip).limit(limit);
  }
  
  const deals = await dbQuery.lean();
  
  if (limit) {
    const total = await Deal.countDocuments(filter);
    return {
      deals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  return { deals }; // Backward compatibility if limit not requested
};

const getDealById = async (id, companyId) => {
  const deal = await Deal.findOne({ _id: id, companyId });
  if (!deal) throw new Error("Deal not found");
  return deal;
};

const updateDeal = async (id, updateData, companyId, username) => {
  const deal = await Deal.findOne({ _id: id, companyId });
  if (!deal) throw new Error("Deal not found");

  const oldStage = deal.stage;
  Object.assign(deal, updateData);

  if (updateData.stage && updateData.stage !== oldStage) {
    deal.activityLogs.push({
      action: "Stage Changed",
      performedBy: username || "User",
      details: `Moved from '${oldStage}' to '${updateData.stage}'`
    });
  } else {
    deal.activityLogs.push({
      action: "Deal Updated",
      performedBy: username || "User",
      details: "Deal metadata modified"
    });
  }

  return await deal.save();
};

const deleteDeal = async (id, companyId) => {
  const res = await Deal.deleteOne({ _id: id, companyId });
  if (res.deletedCount === 0) throw new Error("Deal not found");
  return true;
};

const addDealNote = async (id, content, username, companyId) => {
  const deal = await Deal.findOne({ _id: id, companyId });
  if (!deal) throw new Error("Deal not found");

  deal.notes.push({ content, createdBy: username });
  deal.activityLogs.push({
    action: "Note Added",
    performedBy: username,
    details: content.substring(0, 60) + (content.length > 60 ? "..." : "")
  });

  return await deal.save();
};

const getPipelineAnalytics = async (companyId) => {
  await Deal.deleteMany({ companyId, "activityLogs.action": "Deal Seeded" });
  const openStages = ['lead', 'qualified', 'proposal', 'negotiation'];
  const funnelStages = ['lead', 'qualified', 'proposal', 'negotiation', 'won'];

  // KPIs
  const kpisAgg = await Deal.aggregate([
    { $match: { companyId } },
    {
      $group: {
        _id: null,
        totalPipelineValue: { $sum: { $cond: [{ $ne: ['$stage', 'lost'] }, '$value', 0] } },
        weightedPipelineValue: {
          $sum: {
            $cond: [
              { $ne: ['$stage', 'lost'] },
              {
                $cond: [
                  { $eq: ['$stage', 'won'] },
                  '$value',
                  { $multiply: ['$value', { $divide: [{ $ifNull: ['$probability', 20] }, 100] }] }
                ]
              },
              0
            ]
          }
        },
        dealsWon: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } },
        dealsLost: { $sum: { $cond: [{ $eq: ['$stage', 'lost'] }, 1, 0] } },
        totalValueAll: { $sum: '$value' },
        totalCountAll: { $sum: 1 },
        activeProspects: { $sum: { $cond: [{ $ne: ['$stage', 'lost'] }, 1, 0] } },
        proposalsSent: { $sum: { $cond: [{ $eq: ['$stage', 'proposal'] }, 1, 0] } }
      }
    },
    {
      $project: {
        totalPipelineValue: 1,
        weightedPipelineValue: 1,
        dealsWonThisMonth: '$dealsWon',
        dealsLostThisMonth: '$dealsLost',
        winRate: {
          $cond: [
            { $gt: [{ $add: ['$dealsWon', '$dealsLost'] }, 0] },
            { $round: [{ $multiply: [{ $divide: ['$dealsWon', { $add: ['$dealsWon', '$dealsLost'] }] }, 100] }] },
            0
          ]
        },
        avgDealSize: {
          $cond: [
            { $gt: ['$totalCountAll', 0] },
            { $round: [{ $divide: ['$totalValueAll', '$totalCountAll'] }] },
            0
          ]
        },
        activeProspects: 1,
        proposalsSent: 1
      }
    }
  ]);
  
  const kpis = kpisAgg.length > 0 ? kpisAgg[0] : {
    totalPipelineValue: 0,
    weightedPipelineValue: 0,
    winRate: 0,
    avgDealSize: 0,
    activeProspects: 0,
    proposalsSent: 0,
    dealsWonThisMonth: 0,
    dealsLostThisMonth: 0
  };
  delete kpis._id;

  // Funnel
  const funnelAgg = await Deal.aggregate([
    { $match: { companyId, stage: { $in: funnelStages } } },
    {
      $group: {
        _id: '$stage',
        count: { $sum: 1 },
        value: { $sum: '$value' }
      }
    }
  ]);
  
  const funnelMap = {};
  funnelAgg.forEach(f => funnelMap[f._id] = f);
  
  const funnel = funnelStages.map(stg => ({
    stage: stg.toUpperCase(),
    count: funnelMap[stg] ? funnelMap[stg].count : 0,
    value: funnelMap[stg] ? funnelMap[stg].value : 0
  }));

  // Leaderboard
  const leaderboardAgg = await Deal.aggregate([
    { $match: { companyId } },
    {
      $group: {
        _id: '$rep',
        ownerInit: { $first: '$ownerInit' },
        valueWon: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, '$value', 0] } },
        countWon: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } },
        pipelineVal: { $sum: { $cond: [{ $in: ['$stage', openStages] }, '$value', 0] } },
        totalCount: { $sum: 1 }
      }
    },
    {
      $project: {
        rep: '$_id',
        ownerInit: 1,
        valueWon: 1,
        countWon: 1,
        pipelineVal: 1,
        totalCount: 1,
        winRate: {
          $cond: [
            { $gt: ['$totalCount', 0] },
            { $round: [{ $multiply: [{ $divide: ['$countWon', '$totalCount'] }, 100] }] },
            0
          ]
        }
      }
    },
    { $sort: { valueWon: -1 } }
  ]);
  
  leaderboardAgg.forEach(l => delete l._id);

  // Stalled Deals
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const stalledDealsAgg = await Deal.aggregate([
    { 
      $match: { 
        companyId, 
        stage: { $in: openStages },
        $or: [
          { updatedAt: { $lt: oneDayAgo } },
          { updatedAt: { $exists: false } }
        ]
      } 
    },
    {
      $project: {
        _id: 1,
        name: 1,
        stage: 1,
        value: 1,
        rep: 1,
        companyName: 1,
        industry: 1,
        updatedAt: 1
      }
    }
  ]);

  return {
    kpis,
    funnel,
    leaderboard: leaderboardAgg,
    stalledDeals: stalledDealsAgg
  };
};

const convertDealToClient = async (dealId, email, password, phone, companyId, userRole, agencyId, userId) => {
  const deal = await Deal.findOne({ _id: dealId, companyId });
  if (!deal) throw new Error("Deal not found");
  if (deal.stage !== 'won') throw new Error("Deal must be in 'won' stage to convert");
  
  const User = require('../auth/user.model');
  const existingUser = await User.findOne({ email });
  if (existingUser) throw new Error("User with this email already exists");

  const isAdmin = ['supreme_super_admin', 'commander_admin', 'superadmin', 'admin'].includes(userRole);
  const isAgency = ['agency_super_admin', 'agency_manager', 'agency', 'user'].includes(userRole);

  if (!isAdmin && !isAgency) {
    throw new Error('Not authorized to convert deals to clients');
  }

  let finalAgencyId = null;
  let isDirect = false;
  let role = 'agency_client';

  if (isAgency) {
    finalAgencyId = agencyId;
  } else {
    isDirect = true;
    role = 'brand_super_admin';
  }

  const newClient = await User.create({
    name: deal.name,
    email,
    password: password || undefined,
    phone: phone || undefined,
    role,
    agencyId: finalAgencyId,
    companyName: deal.name,
    isDirect,
    mrr: deal.value || 0,
    createdBy: userId
  });

  newClient.brandId = newClient._id;
  await newClient.save();

  // Update deal with clientId to mark as converted
  deal.clientId = newClient._id;
  deal.activityLogs.push({
    action: "Converted to Client",
    performedBy: "System",
    details: `Converted deal to ${isDirect ? 'Direct Brand' : 'Client'} user`
  });
  await deal.save();

  return newClient;
};

module.exports = {
  createDeal,
  getAllDeals,
  getDealById,
  updateDeal,
  deleteDeal,
  addDealNote,
  getPipelineAnalytics,
  convertDealToClient
};
