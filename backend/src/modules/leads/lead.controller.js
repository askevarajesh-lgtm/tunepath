const { sendError, sendSuccess } = require("../../utils/response");
const leadService = require("./lead.service");
const { uploadAnyFileToCloudinary, uploadBufferToCloudinary } = require("../../utils/cloudinary");
const { validatePhoneNumber } = require("../../utils/phoneValidation");

const getLeadStats = async (req, res) => {
  try {
    const stats = await leadService.getLeadStats(
      req.companyId,
      req.user,
      req.query,
    );
    return sendSuccess(res, "Lead statistics retrieved successfully", stats);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getLeads = async (req, res) => {
  try {
    const result = await leadService.getLeads(
      req.companyId,
      req.user,
      req.query,
    );
    if (Array.isArray(result)) {
      return sendSuccess(res, "Leads retrieved successfully", { leads: result });
    }
    return sendSuccess(res, "Leads retrieved successfully", result);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getLeadById = async (req, res) => {
  try {
    const lead = await leadService.getLeadById(
      req.params.id,
      req.companyId,
      req.user,
    );
    if (!lead) {
      return sendError(res, 404, "Lead not found");
    }
    return sendSuccess(res, "Lead details retrieved successfully", { lead });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getAssignableBdeUsers = async (req, res) => {
  try {
    const users = await leadService.getAssignableBdeUsers(req.companyId);
    return sendSuccess(res, "Assignable BDE users retrieved successfully", {
      users,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const createLead = async (req, res) => {
  try {
    let {
      fullName,
      companyName,
      phoneNumber,
      projectType,
      source,
      status,
      assignedTo,
    } = req.body;

    status = (status && String(status).trim()) || "NEW";

    if (
      !String(fullName || "").trim() ||
      !String(phoneNumber || "").trim() ||
      !String(source || "").trim()
    ) {
      return sendError(
        res,
        400,
        "fullName, phoneNumber, and source are required",
      );
    }

    const leadData = { ...req.body };
    if (req.isClientRole) {
      leadData.clientId = req.clientUserId;
    }

    // Validate Phone Number
    if (leadData.phoneNumber) {
      const validation = validatePhoneNumber(leadData.phoneNumber, leadData.countryCode);
      if (!validation.isValid) {
        return sendError(res, 400, validation.message);
      }
    }

    const lead = await leadService.createLead(
      leadData,
      req.companyId,
      req.user._id,
      req.user,
    );
    return sendSuccess(res, "Lead added successfully", { lead });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const updateLead = async (req, res) => {
  try {
    let {
      fullName,
      companyName,
      phoneNumber,
      projectType,
      source,
      status,
      assignedTo,
    } = req.body;

    status = (status && String(status).trim()) || "NEW";

    if (
      !String(fullName || "").trim() ||
      !String(phoneNumber || "").trim() ||
      !String(source || "").trim()
    ) {
      return sendError(
        res,
        400,
        "fullName, phoneNumber, and source are required",
      );
    }

    const leadData = { ...req.body };
    if (req.isClientRole) {
      leadData.clientId = req.clientUserId;
    }

    // Validate Phone Number
    if (leadData.phoneNumber) {
      let cCode = leadData.countryCode;
      if (!cCode) {
        const Lead = require('./lead.model');
        const existingLead = await Lead.findById(req.params.id).select('countryCode');
        cCode = existingLead?.countryCode;
      }
      const validation = validatePhoneNumber(leadData.phoneNumber, cCode);
      if (!validation.isValid) {
        return sendError(res, 400, validation.message);
      }
    }

    const lead = await leadService.updateLead(
      req.params.id,
      leadData,
      req.companyId,
      req.user,
    );
    return sendSuccess(res, "Lead updated successfully", { lead });
  } catch (error) {
    if (error.message === "Lead not found") {
      return sendError(res, 404, error.message);
    }
    return sendError(res, 400, error.message);
  }
};

const deleteLead = async (req, res) => {
  try {
    await leadService.deleteLead(req.params.id, req.companyId, req.user);
    return sendSuccess(res, "Lead deleted successfully");
  } catch (error) {
    if (error.message === "Lead not found") {
      return sendError(res, 404, error.message);
    }
    return sendError(res, 400, error.message);
  }
};

const getLeadNotes = async (req, res) => {
  try {
    const notes = await leadService.getLeadNotes(
      req.params.id,
      req.companyId,
      req.user,
    );
    return sendSuccess(res, "Lead notes retrieved successfully", { notes });
  } catch (error) {
    if (error.message === "Lead not found") {
      return sendError(res, 404, error.message);
    }
    return sendError(res, 400, error.message);
  }
};

const addLeadNote = async (req, res) => {
  try {
    const noteType = String(req.body.noteType || "text").toLowerCase();
    let fileUrl = "";
    let fileName = "";
    let mimeType = "";

    if (req.file?.buffer) {
      const folder = `lead-notes/${noteType}`;
      const publicId = `lead-note-${req.params.id}-${Date.now()}`;
      const uploadResult = await uploadBufferToCloudinary(
        req.file.buffer,
        folder,
        publicId,
        { mimetype: req.file.mimetype }
      );
      fileUrl = uploadResult?.secure_url || "";
      fileName = req.file.originalname || "";
      mimeType = req.file.mimetype || "";
    }

    const note = await leadService.addLeadNote(
      req.params.id,
      req.companyId,
      req.user._id,
      {
        noteType,
        content: req.body.content,
        fileUrl,
        fileName,
        mimeType,
      },
      req.user,
    );
    return sendSuccess(res, "Lead note added successfully", { note });
  } catch (error) {
    if (error.message === "Lead not found") {
      return sendError(res, 404, error.message);
    }
    return sendError(res, 400, error.message);
  }
};

const deleteLeadNote = async (req, res) => {
  try {
    await leadService.deleteLeadNote(
      req.params.id,
      req.params.noteId,
      req.companyId,
      req.user,
    );
    return sendSuccess(res, "Lead note deleted successfully");
  } catch (error) {
    if (
      error.message === "Lead not found" ||
      error.message === "Lead note not found"
    ) {
      return sendError(res, 404, error.message);
    }
    return sendError(res, 400, error.message);
  }
};

const addLeadReminder = async (req, res) => {
  try {
    const reminder = await leadService.addLeadReminder(
      req.params.id,
      req.companyId,
      req.user,
      {
        description: req.body.description,
        remindAt: req.body.remindAt,
        remindTo: req.body.remindTo,
      }
    );
    return sendSuccess(res, "Reminder added successfully", { reminder });
  } catch (error) {
    if (error.message === "Lead not found") return sendError(res, 404, error.message);
    return sendError(res, 400, error.message);
  }
};

const exportLeadsCsv = async (req, res) => {
  try {
    const filter = req.query.filter === "reminder" ? "reminder" : "all";
    const idsParam = req.query.ids;
    const selectedIds =
      idsParam && String(idsParam).trim()
        ? String(idsParam)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const { filename, csv } = await leadService.buildLeadsCsvExport(
      req.companyId,
      filter,
      selectedIds,
      req.user,
      req.query,
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename.replace(/"/g, "")}"`,
    );
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const importLeadsCsv = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return sendError(
        res,
        400,
        'Upload a CSV file using the form field name "file".',
      );
    }
    const result = await leadService.importLeadsFromCsvBuffer(
      req.file.buffer,
      req.companyId,
      req.user._id,
      req.user,
    );
    return sendSuccess(res, "Import completed", result);
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const bulkDeleteLeads = async (req, res) => {
  try {
    const { leadIds } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return sendError(res, 400, "leadIds array is required");
    }
    const result = await leadService.bulkDeleteLeads(
      leadIds,
      req.companyId,
      req.user,
    );
    return sendSuccess(
      res,
      `${result.deletedCount} leads deleted successfully`,
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const assignLeads = async (req, res) => {
  try {
    const { leadIds, assignedDepartment, assignedDepartmentId, assignedTo } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return sendError(res, 400, "leadIds array is required");
    }
    const result = await leadService.assignLeads(
      leadIds,
      { assignedDepartment, assignedDepartmentId, assignedTo },
      req.companyId,
      req.user,
    );
    return sendSuccess(
      res,
      `${result.updatedCount} lead(s) assigned successfully`,
      result
    );
  } catch (error) {
    if (error.message === "No matching leads found for assignment") {
      return sendError(res, 404, error.message);
    }
    return sendError(res, 400, error.message);
  }
};

module.exports = {
  getLeads,
  getLeadStats,
  getLeadById,
  getAssignableBdeUsers,
  createLead,
  updateLead,
  assignLeads,
  deleteLead,
  getLeadNotes,
  addLeadNote,
  deleteLeadNote,
  addLeadReminder,
  exportLeadsCsv,
  importLeadsCsv,
  bulkDeleteLeads,
};
