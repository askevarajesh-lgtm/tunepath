const mongoose = require("mongoose");
const Lead = require("./lead.model");
const User = require("../auth/user.model");
const {
  parseCsv,
  leadsToCsv,
  buildHeaderIndexMap,
  cellAt,
  normalizeStatus,
} = require("./leadCsv.util");

const escapeRegex = (string) => {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
};

const ensureCurrentUserData = async (currentUser) => {
  if (currentUser && (!currentUser.name || !currentUser.role) && currentUser._id) {
    try {
      const dbUser = await User.findById(currentUser._id).select("name email role customRoleId roleName brandId agencyId").lean();
      if (dbUser) {
        if (!currentUser.name) currentUser.name = dbUser.name;
        if (!currentUser.email) currentUser.email = dbUser.email;
        if (!currentUser.role) currentUser.role = dbUser.role;
        if (currentUser.brandId === undefined) currentUser.brandId = dbUser.brandId;
        if (currentUser.agencyId === undefined) currentUser.agencyId = dbUser.agencyId;
      }
    } catch (e) {
      console.error("Error fetching user data in lead service:", e);
    }
  }
};

const buildLeadAccessFilter = (companyId, currentUser) => {
  const baseFilter = { companyId };
  if (!currentUser) return baseFilter;

  const userRole = String(currentUser.role || "").toLowerCase();

  // 1. Sub-users of Agency Client / Brand only see leads specifically assigned to them or owned by them
  if (userRole === "user" && currentUser.brandId) {
    const userName = String(currentUser.name || "").trim();
    const userEmail = String(currentUser.email || "").trim();
    const userMatch = [];
    if (userName) {
      userMatch.push(
        { assignedTo: userName },
        { assignedTo: new RegExp(`^\\s*${escapeRegex(userName)}\\s*$`, "i") }
      );
    }
    if (userEmail) {
      userMatch.push(
        { assignedTo: userEmail },
        { assignedTo: new RegExp(`^\\s*${escapeRegex(userEmail)}\\s*$`, "i") }
      );
    }
    if (currentUser._id) {
      userMatch.push(
        { ownerId: currentUser._id },
        { createdBy: currentUser._id }
      );
    }

    return {
      ...baseFilter,
      isClientLead: true,
      clientId: currentUser.clientUserId,
      $or: userMatch.length > 0 ? userMatch : [{ assignedTo: "__NO_ACCESS__" }],
    };
  }

  // 2. Client / Brand Admins and Managers see only leads belonging to their client company
  if (currentUser.isClientRole) {
    return {
      ...baseFilter,
      isClientLead: true,
      clientId: currentUser.clientUserId,
    };
  }

  // 3. Platform & Agency Management roles (commander_admin, supreme_super_admin, agency_super_admin, agency_manager, agency)
  // They see all agency prospecting leads by default (or client leads if query.companyId is passed)
  const isAgencyAdminOrManager = [
    "supreme_super_admin",
    "commander_admin",
    "agency_super_admin",
    "agency_manager",
    "agency",
  ].includes(userRole);

  if (isAgencyAdminOrManager) {
    return { ...baseFilter, isClientLead: { $ne: true } };
  }

  // 4. Agency Employees / Team Members (e.g. role === "user" without brandId, role === "bde", or any custom role like Video Editor, Designer, etc.)
  // They ONLY see leads assigned to them or created/owned by them
  const userName = String(currentUser.name || "").trim();
  const userEmail = String(currentUser.email || "").trim();
  const userMatch = [];
  if (userName) {
    userMatch.push(
      { assignedTo: userName },
      { assignedTo: new RegExp(`^\\s*${escapeRegex(userName)}\\s*$`, "i") }
    );
  }
  if (userEmail) {
    userMatch.push(
      { assignedTo: userEmail },
      { assignedTo: new RegExp(`^\\s*${escapeRegex(userEmail)}\\s*$`, "i") }
    );
  }
  if (currentUser._id) {
    userMatch.push(
      { ownerId: currentUser._id },
      { createdBy: currentUser._id }
    );
  }

  return {
    ...baseFilter,
    $or: userMatch.length > 0 ? userMatch : [{ assignedTo: "__NO_ACCESS__" }],
  };
};

const getLeads = async (companyId, currentUser, query = {}) => {
  await ensureCurrentUserData(currentUser);
  const accessFilter = buildLeadAccessFilter(companyId, currentUser);
  if (query.companyId) {
    // If a client is selected, remove the isClientLead restriction to see their leads
    delete accessFilter.isClientLead;
    accessFilter.clientId = query.companyId;
  }
  console.log("getLeads accessFilter:", JSON.stringify(accessFilter), "for user:", currentUser?.role, currentUser?.name);
  return Lead.find(accessFilter).sort({ createdAt: -1 }).lean();
};

/** Active BDE users in the tenant company (for lead assignment dropdown). */
const getAssignableBdeUsers = async (companyId) => {
  if (!companyId) return [];
  return User.find({
    $or: [{ agencyId: companyId }, { brandId: companyId }, { companyId }],
    role: "bde",
    isActive: true,
  })
    .select("name _id")
    .sort({ name: 1 })
    .lean();
};

const createLead = async (leadData, companyId, userId, currentUser) => {
  await ensureCurrentUserData(currentUser);
  const {
    fullName,
    companyName,
    phoneNumber,
    email,
    projectType,
    source,
    status,
    assignedTo,
    notes,
    customData,
  } = leadData;

  const userRole = String(currentUser?.role || "").toLowerCase();
  const isAgencyAdminOrManager = [
    "supreme_super_admin",
    "commander_admin",
    "agency_super_admin",
    "agency_manager",
    "agency",
  ].includes(userRole);

  const defaultAssignee = !isAgencyAdminOrManager
    ? String(currentUser?.name || "").trim()
    : "";
  const assignedToValue = String(assignedTo || "").trim() || defaultAssignee;

  const isClientLead = leadData.isClientLead || currentUser?.isClientRole;

  const lead = await Lead.create({
    companyId,
    clientId: leadData.clientId || null,
    createdBy: userId,
    isClientLead,
    fullName: String(fullName || "").trim(),
    companyName: String(companyName || "").trim(),
    phoneNumber: String(phoneNumber || "").trim(),
    email: String(email || "").trim(),
    projectType: String(projectType || "").trim(),
    source: String(source || "").trim(),
    status: status || "new",
    assignedTo: assignedToValue,
    ownerId: (userRole === "user" && currentUser?.brandId) ? currentUser._id : null,
    notes: String(notes || "").trim(),
    customData: customData || {},
    activityLogs: [{ message: "Lead created" }],
  });

  return lead;
};

const updateLead = async (leadId, updateData, companyId, currentUser) => {
  await ensureCurrentUserData(currentUser);
  const lead = await Lead.findOne({
    _id: leadId,
    ...buildLeadAccessFilter(companyId, currentUser),
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  const {
    fullName,
    companyName,
    phoneNumber,
    email,
    projectType,
    source,
    status,
    assignedTo,
    notes,
  } = updateData;

  lead.fullName = String(fullName || "").trim();
  lead.companyName = String(companyName || "").trim();
  lead.phoneNumber = String(phoneNumber || "").trim();
  lead.email = String(email || "").trim();
  lead.projectType = String(projectType || "").trim();
  lead.source = String(source || "").trim();
  lead.status = status || lead.status;
  
  const userRole = String(currentUser?.role || "").toLowerCase();
  const isAgencyAdminOrManager = [
    "supreme_super_admin",
    "commander_admin",
    "agency_super_admin",
    "agency_manager",
    "agency",
  ].includes(userRole);
  const defaultAssignee = !isAgencyAdminOrManager
    ? String(currentUser?.name || "").trim()
    : "";

  lead.assignedTo = String(assignedTo || "").trim() || (isAgencyAdminOrManager ? lead.assignedTo : defaultAssignee);
  lead.notes = String(notes || "").trim();
  lead.lastInteractionAt = new Date();

  lead.activityLogs = [
    {
      message: "Lead updated",
      createdAt: new Date(),
    },
    ...(lead.activityLogs || []),
  ];

  await lead.save();
  return lead;
};

const deleteLead = async (leadId, companyId, currentUser) => {
  await ensureCurrentUserData(currentUser);
  const lead = await Lead.findOneAndDelete({
    _id: leadId,
    ...buildLeadAccessFilter(companyId, currentUser),
  });
  if (!lead) {
    throw new Error("Lead not found");
  }
  return lead;
};

const getLeadNotes = async (leadId, companyId, currentUser) => {
  await ensureCurrentUserData(currentUser);
  const lead = await Lead.findOne({
    _id: leadId,
    ...buildLeadAccessFilter(companyId, currentUser),
  })
    .populate("leadNotes.createdBy", "name email")
    .lean();
  if (!lead) {
    throw new Error("Lead not found");
  }
  const notes = (lead.leadNotes || []).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
  return notes;
};

const addLeadNote = async (
  leadId,
  companyId,
  userId,
  noteData,
  currentUser,
) => {
  await ensureCurrentUserData(currentUser);
  const lead = await Lead.findOne({
    _id: leadId,
    ...buildLeadAccessFilter(companyId, currentUser),
  });
  if (!lead) {
    throw new Error("Lead not found");
  }

  const noteType = String(noteData.noteType || "text").toLowerCase();
  const content = String(noteData.content || "").trim();
  const fileUrl = String(noteData.fileUrl || "").trim();
  const fileName = String(noteData.fileName || "").trim();
  const mimeType = String(noteData.mimeType || "").trim();

  if (noteType === "text" && !content) {
    throw new Error("Text note content is required");
  }
  if (noteType !== "text" && !fileUrl) {
    throw new Error("A file is required for this note type");
  }

  lead.leadNotes = [
    {
      noteType,
      content,
      fileUrl,
      fileName,
      mimeType,
      createdBy: userId,
      createdAt: new Date(),
    },
    ...(lead.leadNotes || []),
  ];
  lead.activityLogs = [
    {
      message: `Lead note added (${noteType})`,
      createdAt: new Date(),
    },
    ...(lead.activityLogs || []),
  ];
  lead.lastInteractionAt = new Date();
  await lead.save();

  const updatedLead = await Lead.findById(lead._id)
    .populate("leadNotes.createdBy", "name email")
    .lean();
  return updatedLead?.leadNotes?.[0] || null;
};

const deleteLeadNote = async (leadId, noteId, companyId, currentUser) => {
  await ensureCurrentUserData(currentUser);
  const lead = await Lead.findOne({
    _id: leadId,
    ...buildLeadAccessFilter(companyId, currentUser),
  });
  if (!lead) {
    throw new Error("Lead not found");
  }

  const beforeCount = (lead.leadNotes || []).length;
  lead.leadNotes = (lead.leadNotes || []).filter(
    (note) => String(note._id) !== String(noteId),
  );

  if (lead.leadNotes.length === beforeCount) {
    throw new Error("Lead note not found");
  }

  lead.activityLogs = [
    {
      message: "Lead note deleted",
      createdAt: new Date(),
    },
    ...(lead.activityLogs || []),
  ];
  lead.lastInteractionAt = new Date();
  await lead.save();
  return true;
};

const getLeadsForExport = async (
  companyId,
  filter,
  currentUser,
  query = {},
) => {
  await ensureCurrentUserData(currentUser);
  const accessFilter = buildLeadAccessFilter(companyId, currentUser);
  if (query.companyId) {
    // If a client is selected, remove the isClientLead restriction to see their leads
    delete accessFilter.isClientLead;
    accessFilter.clientId = query.companyId;
  }
  const leads = await Lead.find(accessFilter).sort({ createdAt: -1 }).lean();
  let filteredLeads = leads;
  
  if (filter === "reminder") {
    filteredLeads = filteredLeads.filter((l) => (l.reminders || []).length > 0);
  }

  if (query.startDate && query.endDate) {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    filteredLeads = filteredLeads.filter((lead) => {
      const customDate =
        lead?.customData?.created_time ||
        lead?.customData?.createdTime ||
        lead?.customData?.createdtime;
      const leadDate = customDate ? new Date(customDate) : new Date(lead.createdAt);
      return leadDate >= start && leadDate <= end;
    });
  }

  if (query.formName) {
    const fnFilter = query.formName.toLowerCase();
    filteredLeads = filteredLeads.filter((lead) => {
      const formName = (
        lead?.customData?.form_name ||
        lead?.customData?.formName ||
        lead?.formName ||
        ""
      ).toLowerCase();
      return formName.includes(fnFilter);
    });
  }

  return filteredLeads;
};

const addLeadReminder = async (leadId, companyId, currentUser, payload) => {
  await ensureCurrentUserData(currentUser);
  const lead = await Lead.findOne({
    _id: leadId,
    ...buildLeadAccessFilter(companyId, currentUser),
  });
  if (!lead) throw new Error("Lead not found");

  lead.reminders.push(payload);
  lead.activityLogs.push({
    message: `Reminder added for ${payload.remindTo}`,
    createdAt: new Date(),
  });
  await lead.save();
  return lead.reminders[lead.reminders.length - 1];
};

const buildLeadsCsvExport = async (
  companyId,
  filter,
  selectedIds = [],
  currentUser,
  query = {},
) => {
  await ensureCurrentUserData(currentUser);
  let leads;
  let filename;

  if (selectedIds && selectedIds.length) {
    const objectIds = [...new Set(selectedIds)]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (!objectIds.length) {
      throw new Error("No valid lead ids provided for export");
    }
    const accessFilter = buildLeadAccessFilter(companyId, currentUser);
    if (query.companyId) {
      // If a client is selected, remove the isClientLead restriction to see their leads
      delete accessFilter.isClientLead;
      accessFilter.clientId = query.companyId;
    }
    leads = await Lead.find({
      ...accessFilter,
      _id: { $in: objectIds },
    }).lean();
    if (!leads.length) {
      throw new Error("No matching leads to export for the selected ids");
    }
    const orderIndex = new Map(objectIds.map((id, i) => [String(id), i]));
    leads.sort(
      (a, b) =>
        (orderIndex.get(String(a._id)) ?? 0) -
        (orderIndex.get(String(b._id)) ?? 0),
    );
    filename = `leads-export-selected-${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    leads = await getLeadsForExport(companyId, filter, currentUser, query);
    const safeFilter = filter === "reminder" ? "reminder" : "all";
    filename = `leads-export-${safeFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
  }

  const csv = leadsToCsv(leads);
  return { filename, csv };
};

const bulkDeleteLeads = async (leadIds, companyId, currentUser) => {
  await ensureCurrentUserData(currentUser);
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    throw new Error("No lead IDs provided");
  }

  const objectIds = leadIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (objectIds.length === 0) {
    throw new Error("No valid lead IDs provided");
  }

  const accessFilter = buildLeadAccessFilter(companyId, currentUser);

  const result = await Lead.deleteMany({
    _id: { $in: objectIds },
    ...accessFilter,
  });

  return { deletedCount: result.deletedCount };
};

const importLeadsFromCsvBuffer = async (buffer, companyId, userId) => {
  const text = buffer.toString("utf8");
  const rows = parseCsv(text);
  if (!rows.length) {
    throw new Error("CSV file is empty");
  }
  const headerMap = buildHeaderIndexMap(rows[0]);
  const requiredCols = [
    "fullName",
    "companyName",
    "phoneNumber",
    "projectType",
    "assignedTo",
  ];
  const missing = requiredCols.filter((k) => headerMap[k] === undefined);
  if (missing.length) {
    throw new Error(
      `Missing required column(s): ${missing.join(", ")}. Expected headers like Name, Company Name, Phone Number, Project Type, Assigned To (Lead Source column is optional; imports use source "Import"). Optional: Email, Status, Notes.`,
    );
  }

  const created = [];
  const failed = [];
  const dataRows = rows.slice(1);

  for (let i = 0; i < dataRows.length; i += 1) {
    const row = dataRows[i];
    const rowNum = i + 2;
    if (!row || !row.some((c) => String(c || "").trim())) {
      continue;
    }

    const fullName = cellAt(row, headerMap, "fullName", true);
    const companyName = cellAt(row, headerMap, "companyName", true);
    const phoneNumber = cellAt(row, headerMap, "phoneNumber", true);
    const email = cellAt(row, headerMap, "email", false) || "";
    const projectType = cellAt(row, headerMap, "projectType", true);
    const assignedTo = cellAt(row, headerMap, "assignedTo", true);
    const notes = cellAt(row, headerMap, "notes", false) || "";
    const statusRaw = cellAt(row, headerMap, "status", false);
    const status = normalizeStatus(statusRaw) || "new";

    if (
      !fullName ||
      !companyName ||
      !phoneNumber ||
      !projectType ||
      !assignedTo
    ) {
      failed.push({
        row: rowNum,
        message:
          "Missing required value (name, company, phone, project type, and assigned to are required)",
      });
      continue;
    }

    try {
      const lead = await createLead(
        {
          fullName,
          companyName,
          phoneNumber,
          email,
          projectType,
          source: "Import",
          status,
          assignedTo,
          notes,
        },
        companyId,
        userId,
      );
      created.push(lead._id.toString());
    } catch (err) {
      failed.push({
        row: rowNum,
        message: err.message || "Failed to create lead",
      });
    }
  }

  return {
    createdCount: created.length,
    failedCount: failed.length,
    failed,
  };
};

module.exports = {
  getLeads,
  getAssignableBdeUsers,
  createLead,
  updateLead,
  deleteLead,
  getLeadNotes,
  addLeadNote,
  deleteLeadNote,
  addLeadReminder,
  buildLeadsCsvExport,
  importLeadsFromCsvBuffer,
  bulkDeleteLeads,
};
