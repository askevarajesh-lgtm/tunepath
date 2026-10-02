const salesPipelineService = require("./salesPipeline.service");
const { sendSuccess, sendError } = require("../tasks/shimResponse");
const User = require("../auth/user.model");

const createDeal = async (req, res) => {
  try {
    const deal = await salesPipelineService.createDeal(req.body, req.companyId, req.user?.name || req.user?.email);
    return sendSuccess(res, "Deal created successfully", { deal });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const getAllDeals = async (req, res) => {
  try {
    const deals = await salesPipelineService.getAllDeals(req.companyId, req.query);
    return sendSuccess(res, "Deals retrieved successfully", { deals });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getDealById = async (req, res) => {
  try {
    const deal = await salesPipelineService.getDealById(req.params.id, req.companyId);
    return sendSuccess(res, "Deal retrieved successfully", { deal });
  } catch (error) {
    return sendError(res, 404, error.message);
  }
};

const updateDeal = async (req, res) => {
  try {
    const deal = await salesPipelineService.updateDeal(
      req.params.id,
      req.body,
      req.companyId,
      req.user?.name || req.user?.email
    );
    return sendSuccess(res, "Deal updated successfully", { deal });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const deleteDeal = async (req, res) => {
  try {
    await salesPipelineService.deleteDeal(req.params.id, req.companyId);
    return sendSuccess(res, "Deal deleted successfully");
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const addDealNote = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return sendError(res, 400, "Note content is required");
    }
    const deal = await salesPipelineService.addDealNote(
      req.params.id,
      content,
      req.user?.name || req.user?.email || "Anonymous",
      req.companyId
    );
    return sendSuccess(res, "Note added successfully", { deal });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const getPipelineAnalytics = async (req, res) => {
  try {
    const analytics = await salesPipelineService.getPipelineAnalytics(req.companyId);
    return sendSuccess(res, "Pipeline analytics retrieved successfully", { analytics });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const convertDealToClient = async (req, res) => {
  try {
    const { email, password, phone } = req.body;
    if (!email) return sendError(res, 400, "Email is required to create a client");
    
    const client = await salesPipelineService.convertDealToClient(
      req.params.id,
      email,
      password,
      phone,
      req.companyId,
      req.user.role,
      req.user.agencyId,
      req.user._id
    );
    return sendSuccess(res, "Deal converted successfully", { client });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const hasSalesPipelineEnabled = (userDoc) => {
  // Exclude client team members belonging to a client/brand
  if (userDoc.brandId) return false;

  const perms = userDoc.customRoleId?.permissions || userDoc.permissions || {};
  
  for (const [key, val] of Object.entries(perms)) {
    const cleanKey = String(key).toLowerCase().replace(/[-_\s]/g, '');

    // 1. Direct key match (e.g. 'Sales Pipeline', 'salespipeline', 'Agency Ops-Sales Pipeline')
    if (cleanKey.includes('salespipeline') || cleanKey === 'sales') {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val === 1;
      if (typeof val === 'string') return val === 'true' || val === '1';
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === 'object' && val !== null) {
        return Object.values(val).some(v => v === true || v === 'true' || v === 1);
      }
    }

    // 2. Group key match (e.g. key = 'Agency Ops' where val is array of strings or object of modules)
    if (cleanKey.includes('agencyops')) {
      if (Array.isArray(val)) {
        const hasSp = val.some(item => String(item).toLowerCase().replace(/[-_\s]/g, '').includes('salespipeline'));
        if (hasSp) return true;
      } else if (typeof val === 'object' && val !== null) {
        for (const [subKey, subVal] of Object.entries(val)) {
          const cleanSubKey = String(subKey).toLowerCase().replace(/[-_\s]/g, '');
          if (cleanSubKey.includes('salespipeline') || cleanSubKey === 'sales') {
            if (typeof subVal === 'boolean') return subVal;
            if (typeof subVal === 'number') return subVal === 1;
            if (typeof subVal === 'string') return subVal === 'true' || subVal === '1';
            if (typeof subVal === 'object' && subVal !== null) {
              return Object.values(subVal).some(v => v === true || v === 'true' || v === 1);
            }
          }
        }
      }
    }
  }

  // Check role name / key as fallback for explicit sales roles
  const roleName = String(userDoc.customRoleId?.roleName || userDoc.roleName || userDoc.customRoleId?.roleKey || '').toLowerCase();
  if (roleName.includes('sales') || roleName.includes('business development') || roleName.includes('bde') || roleName.includes('bdm')) {
    return true;
  }

  return false;
};

const getSalesReps = async (req, res) => {
  try {
    const agencyId = req.user?.agencyId || req.companyId || req.user?._id;
    
    // Fetch ONLY internal agency users (brandId is null or undefined)
    // and exclude external client roles
    const users = await User.find({
      $or: [
        { agencyId: agencyId },
        { companyId: agencyId },
        { adminId: agencyId }
      ],
      brandId: { $in: [null, undefined] },
      role: { $nin: ['supreme_super_admin', 'commander_admin', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'agency_client', 'client'] },
      status: { $ne: 'inactive' },
      isActive: { $ne: false }
    })
    .populate('customRoleId')
    .select('_id name email role roleName brandId customRoleId permissions')
    .lean();

    // Filter users who strictly have Sales Pipeline enabled in Role Configuration
    const reps = users.filter(hasSalesPipelineEnabled);

    return sendSuccess(res, "Reps retrieved successfully", {
      reps: reps.map(r => ({
        _id: r._id,
        name: r.name || r.email,
        email: r.email,
        role: r.role
      }))
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  createDeal,
  getAllDeals,
  getDealById,
  updateDeal,
  deleteDeal,
  addDealNote,
  getPipelineAnalytics,
  convertDealToClient,
  getSalesReps
};
