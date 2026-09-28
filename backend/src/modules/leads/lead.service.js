const mongoose = require("mongoose");
const Lead = require("./lead.model");
const User = require("../auth/user.model");
require("../departments/department.model");
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
  if (currentUser && currentUser._id) {
    try {
      const dbUser = await User.findById(currentUser._id)
        .select("name email role customRoleId roleName brandId agencyId departmentId departmentName")
        .populate("departmentId", "name slug")
        .lean();
      if (dbUser) {
        if (!currentUser.name) currentUser.name = dbUser.name;
        if (!currentUser.email) currentUser.email = dbUser.email;
        if (!currentUser.role) currentUser.role = dbUser.role;
        if (currentUser.brandId === undefined) currentUser.brandId = dbUser.brandId;
        if (currentUser.agencyId === undefined) currentUser.agencyId = dbUser.agencyId;
        
        const deptName = dbUser.departmentName || dbUser.departmentId?.name || null;
        currentUser.departmentName = deptName;
        currentUser.departmentId = dbUser.departmentId?._id || dbUser.departmentId || null;

        if (dbUser.brandId) {
          currentUser.isClientRole = true;
          currentUser.clientUserId = dbUser.brandId;
        } else if (['client', 'agency_client', 'brand_super_admin', 'brand_manager'].includes(dbUser.role)) {
          currentUser.isClientRole = true;
          currentUser.clientUserId = dbUser._id;
        }
      }
    } catch (e) {
      console.error("Error fetching user data in lead service:", e);
    }
  }
};

const buildLeadAccessFilter = (companyId, currentUser) => {
  if (!currentUser) return companyId ? { companyId } : {};

  const userRole = String(currentUser.role || "").toLowerCase();

  // 1. Sub-users of Agency Client / Brand only see leads belonging to their client company that are assigned to them, their department, or owned by them
  if (userRole === "user" && (currentUser.brandId || currentUser.clientUserId)) {
    const effectiveClientId = currentUser.clientUserId || currentUser.brandId;
    const userName = String(currentUser.name || "").trim();
    const userEmail = String(currentUser.email || "").trim();
    const deptName = String(currentUser.departmentName || "").trim();
    const deptId = currentUser.departmentId;

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
    if (deptName) {
      userMatch.push(
        { assignedDepartment: deptName },
        { assignedDepartment: new RegExp(`^\\s*${escapeRegex(deptName)}\\s*$`, "i") }
      );
    }
    if (deptId) {
      userMatch.push({ assignedDepartmentId: deptId });
    }
    if (currentUser._id) {
      userMatch.push(
        { ownerId: currentUser._id },
        { createdBy: currentUser._id }
      );
    }

    return {
      clientId: effectiveClientId,
      $or: userMatch.length > 0 ? userMatch : [{ assignedTo: "__NO_ACCESS__" }],
    };
  }

  // 2. Client / Brand Admins and Managers see all leads belonging to their client company
  if (currentUser.isClientRole || ['client', 'agency_client', 'brand_super_admin', 'brand_manager'].includes(userRole)) {
    const effectiveClientId = currentUser.clientUserId || currentUser.brandId || currentUser._id;
    return {
      clientId: effectiveClientId,
    };
  }

  const baseFilter = companyId ? { companyId } : {};

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
  // They ONLY see leads assigned to them, their department, or created/owned by them
  const userName = String(currentUser.name || "").trim();
  const userEmail = String(currentUser.email || "").trim();
  const deptName = String(currentUser.departmentName || "").trim();
  const deptId = currentUser.departmentId;
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
  if (deptName) {
    userMatch.push(
      { assignedDepartment: deptName },
      { assignedDepartment: new RegExp(`^\\s*${escapeRegex(deptName)}\\s*$`, "i") }
    );
  }
  if (deptId) {
    userMatch.push({ assignedDepartmentId: deptId });
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

const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
};

const getLeadStats = async (companyId, currentUser, query = {}) => {
  await ensureCurrentUserData(currentUser);
  const accessFilter = buildLeadAccessFilter(companyId, currentUser);
  if (query.companyId || query.clientId) {
    delete accessFilter.isClientLead;
    accessFilter.clientId = toObjectId(query.companyId || query.clientId);
  } else if (accessFilter.clientId) {
    accessFilter.clientId = toObjectId(accessFilter.clientId);
  }
  if (accessFilter.companyId) {
    accessFilter.companyId = toObjectId(accessFilter.companyId);
  }

  const [aggregationResult] = await Lead.aggregate([
    { $match: accessFilter },
    {
      $facet: {
        total: [{ $count: "count" }],
        byStatus: [{ $group: { _id: { $toLower: "$status" }, count: { $sum: 1 } } }],
        bySource: [{ $group: { _id: "$source", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        byOwner: [{ $group: { _id: "$assignedTo", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        byDepartment: [{ $group: { _id: "$assignedDepartment", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        recent30Days: [
          { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
          { $count: "count" }
        ],
        contactReady: [
          {
            $match: {
              $or: [
                { phoneNumber: { $exists: true, $nin: ["", null] } },
                { email: { $exists: true, $nin: ["", null] } }
              ]
            }
          },
          { $count: "count" }
        ],
        phoneCount: [
          { $match: { phoneNumber: { $exists: true, $nin: ["", null] } } },
          { $count: "count" }
        ],
        emailCount: [
          { $match: { email: { $exists: true, $nin: ["", null] } } },
          { $count: "count" }
        ]
      }
    }
  ]);

  const total = aggregationResult?.total?.[0]?.count || 0;
  const statusMap = {};
  (aggregationResult?.byStatus || []).forEach((s) => {
    if (s._id) statusMap[s._id] = s.count;
  });

  const newCount = statusMap["new"] || 0;
  const contactedCount = statusMap["contacted"] || 0;
  const inProgressCount = statusMap["in_progress"] || 0;
  const followUpCount = statusMap["follow_up"] || 0;
  const convertedCount = statusMap["converted"] || 0;
  const lostCount = statusMap["lost"] || 0;
  const junkCount = statusMap["junk"] || 0;

  const activeCount = contactedCount + inProgressCount + followUpCount;
  
  let assignedCount = 0;
  let unassignedCount = 0;
  (aggregationResult?.byOwner || []).forEach((o) => {
    if (!o._id || o._id.trim() === "" || o._id.toLowerCase() === "unassigned") {
      unassignedCount += o.count;
    } else {
      assignedCount += o.count;
    }
  });

  return {
    totalLeads: total,
    newLeads: newCount,
    activeLeads: activeCount,
    assignedLeads: assignedCount,
    unassignedLeads: unassignedCount,
    convertedLeads: convertedCount,
    lostLeads: lostCount,
    junkLeads: junkCount,
    followUpLeads: followUpCount,
    contactReadyLeads: aggregationResult?.contactReady?.[0]?.count || 0,
    phoneAddedLeads: aggregationResult?.phoneCount?.[0]?.count || 0,
    emailAddedLeads: aggregationResult?.emailCount?.[0]?.count || 0,
    recent30DaysLeads: aggregationResult?.recent30Days?.[0]?.count || 0,
    statusBreakdown: aggregationResult?.byStatus || [],
    sourceBreakdown: aggregationResult?.bySource || [],
    ownerBreakdown: aggregationResult?.byOwner || [],
    departmentBreakdown: aggregationResult?.byDepartment || []
  };
};

const getLeads = async (companyId, currentUser, query = {}) => {
  await ensureCurrentUserData(currentUser);
  const accessFilter = buildLeadAccessFilter(companyId, currentUser);
  if (query.companyId || query.clientId) {
    // If a client is selected, remove the isClientLead restriction to see their leads
    delete accessFilter.isClientLead;
    accessFilter.clientId = query.companyId || query.clientId;
  }

  // Optional server-side filtering
  if (query.status && query.status !== "All") {
    accessFilter.status = new RegExp(`^${escapeRegex(query.status)}$`, "i");
  }
  if (query.source) {
    accessFilter.source = query.source;
  }
  if (query.department) {
    accessFilter.assignedDepartment = query.department;
  }
  if (query.formName) {
    const fnRegex = new RegExp(escapeRegex(query.formName), "i");
    accessFilter.$or = [
      ...(accessFilter.$or || []),
      { "customData.form_name": fnRegex },
      { "customData.formName": fnRegex },
      { formName: fnRegex }
    ];
  }
  if (query.startDate && query.endDate) {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);
    // Approximate by createdAt for server-side
    accessFilter.createdAt = { $gte: start, $lte: end };
  }
  if (query.search && query.search.trim()) {
    const sRegex = new RegExp(escapeRegex(query.search.trim()), "i");
    const searchOr = [
      { fullName: sRegex },
      { phoneNumber: sRegex },
      { email: sRegex },
      { companyName: sRegex }
    ];
    if (accessFilter.$or) {
      accessFilter.$and = [{ $or: accessFilter.$or }, { $or: searchOr }];
      delete accessFilter.$or;
    } else {
      accessFilter.$or = searchOr;
    }
  }

  // By default, exclude heavy subdocuments for high-speed listing
  let projection = "-activityLogs -leadNotes";
  if (query.full === "true" || query.includeDetails === "true") {
    projection = "";
  }

  let dbQuery = Lead.find(accessFilter).sort({ createdAt: -1 });
  if (projection) {
    dbQuery = dbQuery.select(projection);
  }

  if (query.limit && !isNaN(parseInt(query.limit))) {
    const limit = Math.max(1, parseInt(query.limit));
    const page = Math.max(1, parseInt(query.page) || 1);
    const skip = (page - 1) * limit;
    
    const [leads, total] = await Promise.all([
      dbQuery.skip(skip).limit(limit).lean(),
      Lead.countDocuments(accessFilter)
    ]);
    return { leads, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  return dbQuery.lean();
};

const getLeadById = async (leadId, companyId, currentUser) => {
  await ensureCurrentUserData(currentUser);
  const accessFilter = buildLeadAccessFilter(companyId, currentUser);
  if (accessFilter.companyId) {
    delete accessFilter.companyId;
  }
  return Lead.findOne({ _id: leadId, ...accessFilter }).lean();
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
    assignedDepartment,
    assignedDepartmentId,
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
    assignedDepartment: String(assignedDepartment || "").trim(),
    assignedDepartmentId: assignedDepartmentId || null,
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
    assignedDepartment,
    assignedDepartmentId,
    notes,
  } = updateData;

  if (fullName !== undefined) lead.fullName = String(fullName || "").trim();
  if (companyName !== undefined) lead.companyName = String(companyName || "").trim();
  if (phoneNumber !== undefined) lead.phoneNumber = String(phoneNumber || "").trim();
  if (email !== undefined) lead.email = String(email || "").trim();
  if (projectType !== undefined) lead.projectType = String(projectType || "").trim();
  if (source !== undefined) lead.source = String(source || "").trim();
  if (status !== undefined) lead.status = status || lead.status;
  
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

  if (assignedTo !== undefined) {
    lead.assignedTo = String(assignedTo || "").trim() || (isAgencyAdminOrManager ? lead.assignedTo : defaultAssignee);
  }
  if (assignedDepartment !== undefined) {
    lead.assignedDepartment = String(assignedDepartment || "").trim();
  }
  if (assignedDepartmentId !== undefined) {
    lead.assignedDepartmentId = assignedDepartmentId || null;
  }
  if (notes !== undefined) {
    lead.notes = String(notes || "").trim();
  }
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

  const reminderObj = {
    ...payload,
    remindTo: payload.remindTo || lead.assignedTo || currentUser?.name || currentUser?.username || 'Self',
    status: 'pending',
    notificationSent: false,
  };

  lead.reminders.push(reminderObj);
  lead.activityLogs.push({
    message: reminderObj.remindTo ? `Reminder added for ${reminderObj.remindTo}` : `Reminder added`,
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

const assignLeads = async (leadIds, assignData, companyId, currentUser) => {
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
  const leads = await Lead.find({
    _id: { $in: objectIds },
    ...accessFilter,
  });

  if (!leads.length) {
    throw new Error("No matching leads found for assignment");
  }

  const { assignedDepartment, assignedDepartmentId, assignedTo } = assignData;

  const updateFields = {};
  if (assignedDepartment !== undefined) {
    updateFields.assignedDepartment = String(assignedDepartment || "").trim();
  }
  if (assignedDepartmentId !== undefined) {
    updateFields.assignedDepartmentId = assignedDepartmentId || null;
  }
  if (assignedTo !== undefined) {
    updateFields.assignedTo = String(assignedTo || "").trim();
  }

  const parts = [];
  if (updateFields.assignedDepartment !== undefined) {
    parts.push(updateFields.assignedDepartment ? `Dept: ${updateFields.assignedDepartment}` : 'Dept: Cleared');
  }
  if (updateFields.assignedTo !== undefined) {
    parts.push(updateFields.assignedTo ? `User: ${updateFields.assignedTo}` : 'User: Unassigned');
  }
  const logMessage = `Lead assignment updated (${parts.join(', ')})`;

  const updatedLeads = [];
  for (const lead of leads) {
    if (updateFields.assignedDepartment !== undefined) {
      lead.assignedDepartment = updateFields.assignedDepartment;
    }
    if (updateFields.assignedDepartmentId !== undefined) {
      lead.assignedDepartmentId = updateFields.assignedDepartmentId;
    }
    if (updateFields.assignedTo !== undefined) {
      lead.assignedTo = updateFields.assignedTo;
    }
    lead.lastInteractionAt = new Date();
    lead.activityLogs = [
      {
        message: logMessage,
        createdAt: new Date(),
      },
      ...(lead.activityLogs || []),
    ];
    await lead.save();
    updatedLeads.push(lead);
  }

  return { updatedCount: updatedLeads.length, leads: updatedLeads };
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
  buildLeadsCsvExport,
  importLeadsFromCsvBuffer,
  bulkDeleteLeads,
};
