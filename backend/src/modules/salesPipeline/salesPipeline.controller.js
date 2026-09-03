const salesPipelineService = require("./salesPipeline.service");
const { sendSuccess, sendError } = require("../tasks/shimResponse");

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
  if (userDoc.customRoleId && userDoc.customRoleId.permissions) {
    const p = userDoc.customRoleId.permissions;
    const spPerm = p['Agency Ops-Sales Pipeline'] || p['Sales Pipeline'] || p['salespipeline'] || p['Agency Ops'];

    if (!spPerm) return false;

    if (typeof spPerm === 'boolean') return spPerm;
    if (Array.isArray(spPerm)) return spPerm.includes('Sales Pipeline') || spPerm.includes('salespipeline');
    if (typeof spPerm === 'object') {
      return Boolean(spPerm.View || spPerm.Create || spPerm.Edit || spPerm.All || spPerm['Sales Pipeline'] || spPerm.canView || spPerm.canAdd);
    }
    return false;
  }

  if (userDoc.permissions) {
    const p = userDoc.permissions;
    const spPerm = p['Agency Ops-Sales Pipeline'] || p['Sales Pipeline'] || p['salespipeline'] || p['Agency Ops'];
    if (spPerm) {
      if (typeof spPerm === 'boolean') return spPerm;
      if (Array.isArray(spPerm)) return spPerm.includes('Sales Pipeline');
      if (typeof spPerm === 'object') {
        return Boolean(spPerm.View || spPerm.Create || spPerm.Edit || spPerm.All || spPerm['Sales Pipeline'] || spPerm.canView || spPerm.canAdd);
      }
    }
  }

  return true;
};

const getSalesReps = async (req, res) => {
  try {
    const agencyId = req.user?.agencyId || req.companyId || req.user?._id;
    
    // Fetch ONLY sub-users (role: 'user') belonging to this agency.
    // Explicitly exclude clients (brand_super_admin, brand_manager, agency_client, client)
    // and agency admins / agency managers.
    const users = await User.find({
      $or: [
        { agencyId: agencyId },
        { companyId: agencyId },
        { adminId: agencyId }
      ],
      role: 'user'
    }).populate('customRoleId').select('_id name email role customRoleId permissions');

    // Filter users who have Sales Pipeline enabled in Role Configuration
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
