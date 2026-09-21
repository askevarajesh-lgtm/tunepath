const { validationResult } = require('express-validator');
const deliverablesService = require('./deliverables.service');
const { sendSuccess, sendError, sendValidationError } = require('../tasks/shimResponse');

const createDeliverable = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }
    const deliverable = await deliverablesService.createDeliverable(req.body, req.companyId, req.user._id);
    return sendSuccess(res, 'Deliverable created successfully', { deliverable });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const getAllDeliverables = async (req, res) => {
  try {
    const deliverables = await deliverablesService.getAllDeliverables(
      req.companyId,
      req.query,
      req.user?.role,
      req.user?._id,
      req.user
    );
    return sendSuccess(res, 'Deliverables retrieved successfully', { deliverables });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getDeliverableById = async (req, res) => {
  try {
    const result = await deliverablesService.getDeliverableById(
      req.params.id,
      req.companyId,
      req.user?.role,
      req.user?._id,
      req.user
    );
    return sendSuccess(res, 'Deliverable details retrieved successfully', result);
  } catch (error) {
    return sendError(res, 404, error.message);
  }
};

const updateDeliverable = async (req, res) => {
  try {
    const deliverable = await deliverablesService.updateDeliverable(
      req.params.id,
      req.body,
      req.companyId,
      req.user?._id
    );
    return sendSuccess(res, 'Deliverable updated successfully', { deliverable });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const deleteDeliverable = async (req, res) => {
  try {
    await deliverablesService.deleteDeliverable(req.params.id, req.companyId);
    return sendSuccess(res, 'Deliverable deleted successfully');
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const submitForApproval = async (req, res) => {
  try {
    const { remarks } = req.body;
    const deliverable = await deliverablesService.submitForApproval(
      req.params.id,
      remarks,
      req.companyId,
      req.user?._id
    );
    return sendSuccess(res, 'Deliverable submitted for approval successfully', { deliverable });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const approveDeliverable = async (req, res) => {
  try {
    const { remarks } = req.body;
    const deliverable = await deliverablesService.approveDeliverable(
      req.params.id,
      remarks,
      req.companyId,
      req.user?._id
    );
    return sendSuccess(res, 'Deliverable approved successfully', { deliverable });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const requestRevision = async (req, res) => {
  try {
    const { remarks } = req.body;
    const deliverable = await deliverablesService.requestRevision(
      req.params.id,
      remarks,
      req.companyId,
      req.user?._id
    );
    return sendSuccess(res, 'Revisions requested successfully', { deliverable });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const uploadDeliverableFile = async (req, res) => {
  try {
    const file = await deliverablesService.uploadDeliverableFile(
      req.params.id,
      req.body,
      req.companyId,
      req.user?._id
    );
    return sendSuccess(res, 'File attached successfully', { file });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const addDeliverableComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return sendError(res, 400, 'Comment content is required');
    }
    const comment = await deliverablesService.addDeliverableComment(
      req.params.id,
      content,
      req.companyId,
      req.user?._id
    );
    return sendSuccess(res, 'Comment posted successfully', { comment });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const getDeliverableAnalytics = async (req, res) => {
  try {
    const analytics = await deliverablesService.getDeliverableAnalytics(
      req.companyId,
      req.user?.role,
      req.user?._id
    );
    return sendSuccess(res, 'Deliverable analytics retrieved successfully', { analytics });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  createDeliverable,
  getAllDeliverables,
  getDeliverableById,
  updateDeliverable,
  deleteDeliverable,
  submitForApproval,
  approveDeliverable,
  requestRevision,
  uploadDeliverableFile,
  addDeliverableComment,
  getDeliverableAnalytics
};
