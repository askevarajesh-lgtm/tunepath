const TimeEntry = require('./timeTracking.model');
const User = require('../auth/user.model');
const Task = require('../tasks/task.model');
const Department = require('../departments/department.model');
const mongoose = require('mongoose');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXCLUDED_SYSTEM_ROLES = [
  'supreme_super_admin',
  'superadmin',
  'super_admin',
  'commander_admin',
  'admin',
  'agency_super_admin',
  'agency_manager',
  'brand_super_admin',
  'brand_manager',
  'brand_admin',
  'manager',
  'agency_client',
  'client'
];

/** Roles that are considered clients */
const CLIENT_ROLES = ['brand_super_admin', 'brand_manager', 'brand_admin', 'agency_client', 'client'];

async function getCompanyIdList(req, tenantObjectId) {
  const ids = [
    tenantObjectId,
    req.companyId,
    req.user?.companyId,
    req.user?.brandId,
    req.user?.agencyId,
    req.user?.clientId,
    req.user?._id
  ]
    .filter(Boolean)
    .map(id => id.toString());

  const agencyId = req.user?.agencyId || req.companyId;
  if (agencyId) {
    try {
      const clients = await User.find({ agencyId: new mongoose.Types.ObjectId(agencyId) }).select('_id').lean();
      clients.forEach(c => ids.push(c._id.toString()));
    } catch (err) {
      console.error('Error fetching agency clients in getCompanyIdList:', err);
    }
  }

  return Array.from(new Set(ids)).map(id => new mongoose.Types.ObjectId(id));
}

async function getEligibleUsers(req, companyIdList) {
  let query = {};
  
  if (req?.user?.role === 'commander_admin') {
    query = {
      adminId: req.user._id,
      agencyId: null,
      brandId: null,
      role: { $nin: EXCLUDED_SYSTEM_ROLES }
    };
  } else if (['brand_super_admin', 'brand_manager', 'brand_admin', 'agency_client'].includes(req?.user?.role) || (req?.user?.role === 'user' && req?.user?.brandId) || (req?.companyId && req?.user?.role?.startsWith('brand'))) {
    const brandId = req.user.brandId || req.companyId || (['brand_super_admin', 'brand_manager', 'brand_admin', 'agency_client'].includes(req.user.role) ? req.user._id : null);
    query = {
      brandId: brandId ? new mongoose.Types.ObjectId(brandId) : { $in: companyIdList },
      _id: { $ne: brandId ? new mongoose.Types.ObjectId(brandId) : req.user._id },
      $and: [
        {
          $or: [
            { customRoleId: { $ne: null } },
            { role: { $nin: EXCLUDED_SYSTEM_ROLES } }
          ]
        },
        { role: { $nin: ['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_client', 'brand_super_admin'] } }
      ]
    };
  } else {
    const agencyId = req?.companyId || req?.user?.agencyId || req?.user?._id;
    query = {
      agencyId: agencyId ? new mongoose.Types.ObjectId(agencyId) : { $in: companyIdList },
      brandId: null,
      $or: [
        { customRoleId: { $ne: null } },
        { role: { $nin: EXCLUDED_SYSTEM_ROLES } }
      ],
      role: { $nin: ['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_manager', 'agency_client', 'brand_super_admin', 'brand_manager', 'brand_admin', 'client'] }
    };
  }

  return await User.find(query)
    .select('_id name role customRoleId roleName departmentId departmentName')
    .sort({ name: 1 })
    .lean();
}

async function getDepartments(companyIdList) {
  return await Department.find({
    $or: [
      { agencyId: { $in: companyIdList } },
      { companyId: { $in: companyIdList } },
      { brandId: { $in: companyIdList } },
      { tenantCompanyId: { $in: companyIdList } }
    ]
  }).select('_id name slug status').lean();
}

/**
 * Compute week boundaries (Mon–Sun) from a date.
 */
function getWeekRange(dateParam) {
  const d = new Date(dateParam);
  const day = d.getDay() || 7;
  const startOfWeek = new Date(d);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(d.getDate() - day + 1);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return { startOfWeek, endOfWeek };
}

// ─── POST / — logTime ────────────────────────────────────────────────────────

exports.logTime = async (req, res) => {
  try {
    if (!req.companyId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: company context missing' });
    }

    const { employee, client, task, department, moduleName, description, date, hours, isBillable, source = 'manual' } = req.body;
    const tenantCompanyId = req.companyId;
    const parsedHours = Number(hours);

    if (!parsedHours || parsedHours <= 0) {
      return res.status(400).json({ success: false, message: 'Hours must be greater than 0' });
    }

    const tenantObjectId = new mongoose.Types.ObjectId(tenantCompanyId);

    // Validate employee belongs to this tenant (using agencyId — the correct field)
    if (employee) {
      const employeeExists = await User.exists({ _id: employee, agencyId: tenantObjectId });
      if (!employeeExists) return res.status(403).json({ success: false, message: 'Invalid employee reference' });
    }

    // Validate client belongs to this tenant
    if (client) {
      const clientExists = await User.exists({ _id: client, agencyId: tenantObjectId });
      if (!clientExists) return res.status(403).json({ success: false, message: 'Invalid client reference' });
    }

    // Validate task belongs to this tenant
    if (task) {
      const taskExists = await Task.exists({
        _id: task,
        $or: [{ tenantCompanyId: tenantObjectId }, { companyId: tenantObjectId }]
      });
      if (!taskExists) return res.status(403).json({ success: false, message: 'Invalid task reference' });
    }

    const newEntry = new TimeEntry({
      employee,
      client,
      task,
      department,
      moduleName,
      description,
      date,
      hours: parsedHours,
      isBillable,
      tenantCompanyId,
      source,
      createdBy: req.user._id
    });

    await newEntry.save();

    if (task) {
      await Task.findByIdAndUpdate(task, { $inc: { timeSpent: parsedHours } });
    }

    res.status(201).json({ success: true, message: 'Time logged successfully', data: newEntry });
  } catch (error) {
    console.error('Error logging time:', error);
    res.status(500).json({ success: false, message: 'Failed to log time', error: error.message });
  }
};

// ─── PUT /:id — updateTimeEntry ───────────────────────────────────────────────

exports.updateTimeEntry = async (req, res) => {
  try {
    if (!req.companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const { employee, client, task, department, moduleName, description, date, hours, isBillable } = req.body;

    const parsedHours = Number(hours);
    if (!parsedHours || parsedHours <= 0) return res.status(400).json({ success: false, message: 'Hours must be greater than 0' });

    const tenantObjectId = new mongoose.Types.ObjectId(req.companyId);
    const existingEntry = await TimeEntry.findOne({ _id: id, tenantCompanyId: tenantObjectId });
    if (!existingEntry) return res.status(404).json({ success: false, message: 'Time entry not found' });

    if (employee) {
      const employeeExists = await User.exists({ _id: employee, agencyId: tenantObjectId });
      if (!employeeExists) return res.status(403).json({ success: false, message: 'Invalid employee reference' });
    }
    if (client) {
      const clientExists = await User.exists({ _id: client, agencyId: tenantObjectId });
      if (!clientExists) return res.status(403).json({ success: false, message: 'Invalid client reference' });
    }
    if (task) {
      const taskExists = await Task.exists({ _id: task, $or: [{ tenantCompanyId: tenantObjectId }, { companyId: tenantObjectId }] });
      if (!taskExists) return res.status(403).json({ success: false, message: 'Invalid task reference' });
    }

    const oldTask = existingEntry.task;
    const oldHours = existingEntry.hours;

    existingEntry.employee = employee;
    existingEntry.client = client;
    existingEntry.task = task;
    existingEntry.department = department;
    existingEntry.moduleName = moduleName;
    existingEntry.description = description;
    existingEntry.date = date;
    existingEntry.hours = parsedHours;
    existingEntry.isBillable = isBillable;

    await existingEntry.save();

    // Reconcile Task.timeSpent
    if (oldTask?.toString() === task?.toString()) {
      if (oldTask && oldHours !== parsedHours) {
        await Task.findByIdAndUpdate(oldTask, { $inc: { timeSpent: parsedHours - oldHours } });
      }
    } else {
      if (oldTask) await Task.findByIdAndUpdate(oldTask, { $inc: { timeSpent: -oldHours } });
      if (task) await Task.findByIdAndUpdate(task, { $inc: { timeSpent: parsedHours } });
    }

    res.status(200).json({ success: true, message: 'Time entry updated successfully', data: existingEntry });
  } catch (error) {
    console.error('Error updating time entry:', error);
    res.status(500).json({ success: false, message: 'Failed to update time entry', error: error.message });
  }
};

// ─── DELETE /:id — deleteTimeEntry ───────────────────────────────────────────

exports.deleteTimeEntry = async (req, res) => {
  try {
    if (!req.companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const tenantObjectId = new mongoose.Types.ObjectId(req.companyId);

    const existingEntry = await TimeEntry.findOne({ _id: id, tenantCompanyId: tenantObjectId });
    if (!existingEntry) return res.status(404).json({ success: false, message: 'Time entry not found' });

    if (existingEntry.task) {
      await Task.findByIdAndUpdate(existingEntry.task, { $inc: { timeSpent: -existingEntry.hours } });
    }

    await TimeEntry.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Time entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting time entry:', error);
    res.status(500).json({ success: false, message: 'Failed to delete time entry', error: error.message });
  }
};

const MAX_WORK_HOURS_PER_DAY = 24; // Physical maximum working hours per day
const IN_PROGRESS_STATUSES = ['in_progress', 'IN_PROGRESS', 'in progress'];

/**
 * Gets end of due date (23:59:59.999) as a timestamp in ms. Returns Infinity if no due date.
 */
function getTaskDueEndMs(dueDate) {
  if (!dueDate) return Infinity;
  const dueEnd = new Date(dueDate);
  if (isNaN(dueEnd.getTime())) return Infinity;
  dueEnd.setHours(23, 59, 59, 999);
  return dueEnd.getTime();
}

/**
 * Validates if a task has an active running timer that is in_progress and not past deadline.
 */
function isTaskTimerActive(task, now = new Date()) {
  if (!task || !task.workStartedAt) return false;
  if (!IN_PROGRESS_STATUSES.includes(task.status)) return false;
  const dueEndMs = getTaskDueEndMs(task.dueDate);
  if (now.getTime() > dueEndMs) {
    return false;
  }
  return true;
}

/**
 * Calculates active session hours for a task on a specific day window, stopping at task due date.
 */
function calculateActiveTaskDayHours(task, dayStartMs, dayEndMs, nowMs) {
  if (!task || !task.workStartedAt) return 0;
  if (!IN_PROGRESS_STATUSES.includes(task.status)) return 0;

  const startedMs = new Date(task.workStartedAt).getTime();
  const dueEndMs = getTaskDueEndMs(task.dueDate);
  const taskStopTimeMs = Math.min(nowMs, dueEndMs);

  if (startedMs > dayEndMs || startedMs >= taskStopTimeMs) return 0;
  if (dayStartMs >= taskStopTimeMs) return 0;

  const effectiveStart = Math.max(startedMs, dayStartMs);
  const effectiveEnd = Math.min(taskStopTimeMs, dayEndMs);
  if (effectiveStart >= effectiveEnd) return 0;

  const rawHours = (effectiveEnd - effectiveStart) / 3600000;
  return Math.min(24, Math.max(0, rawHours));
}

// ─── GET /recent — getRecentEntries ──────────────────────────────────────────

exports.getRecentEntries = async (req, res) => {
  try {
    if (!req.companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const tenantObjectId = new mongoose.Types.ObjectId(req.companyId);

    const companyIdList = await getCompanyIdList(req, tenantObjectId);

    let matchQuery = {
      $or: [
        { tenantCompanyId: { $in: companyIdList } },
        { client: { $in: companyIdList } }
      ]
    };
    // Regular users see only their own entries
    if (['user', 'brand_team_user'].includes(req.user.role)) {
      matchQuery.employee = new mongoose.Types.ObjectId(req.user._id);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build department lookup maps to resolve raw ObjectIds or slugs into clean display names
    const departments = await Department.find({}).select('_id name slug').lean();
    const deptIdMap = {};
    const deptSlugMap = {};
    departments.forEach(d => {
      deptIdMap[d._id.toString()] = d.name;
      if (d.slug) deptSlugMap[d.slug.toLowerCase()] = d.name;
      if (d.name) deptSlugMap[d.name.toLowerCase()] = d.name;
    });

    const resolveDeptName = (raw) => {
      if (!raw) return null;
      const str = String(raw).trim();
      if (deptIdMap[str]) return deptIdMap[str];
      if (deptSlugMap[str.toLowerCase()]) return deptSlugMap[str.toLowerCase()];
      if (mongoose.Types.ObjectId.isValid(str) && /^[0-9a-fA-F]{24}$/.test(str)) {
        return null; // Don't leak raw ObjectId
      }
      return str;
    };

    // ── Active running in-progress tasks (Page 1) ────────────────────────────
    const now = new Date();
    const nowMs = now.getTime();
    let activeEntries = [];

    const activeTasksRaw = await Task.find({
      $or: [
        { tenantCompanyId: { $in: companyIdList } },
        { companyId: { $in: companyIdList } }
      ],
      status: { $in: IN_PROGRESS_STATUSES },
      workStartedAt: { $ne: null }
    })
    .populate('assignedTo', 'name departmentId departmentName')
    .populate('companyId', 'companyName name')
    .sort({ workStartedAt: -1 })
    .lean();

    const filteredActive = ['user', 'brand_team_user'].includes(req.user.role)
      ? activeTasksRaw.filter(t => t.assignedTo?._id?.toString() === req.user._id.toString())
      : activeTasksRaw;

    activeEntries = filteredActive.map(t => {
      const startedMs = new Date(t.workStartedAt).getTime();
      const dueEndMs = getTaskDueEndMs(t.dueDate);
      const stopMs = Math.min(nowMs, dueEndMs);
      const isRunning = nowMs <= dueEndMs;
      const elapsedHours = startedMs < stopMs ? Math.max(0.01, (stopMs - startedMs) / 3600000) : 0;

      const resolvedDept = t.assignedTo?.departmentName 
        || resolveDeptName(t.department) 
        || '—';

      let resolvedModule = resolveDeptName(t.department) || 'General';
      if (mongoose.Types.ObjectId.isValid(resolvedModule) && /^[0-9a-fA-F]{24}$/.test(resolvedModule)) {
        resolvedModule = 'General';
      }

      return {
        id: `active_${t._id}`,
        date: new Date(t.workStartedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        rawDate: t.workStartedAt,
        employeeId: t.assignedTo?._id,
        clientId: t.companyId?._id,
        taskId: t._id,
        departmentId: t.assignedTo?.departmentId || null,
        member: t.assignedTo?.name || 'Unassigned',
        memberInit: t.assignedTo?.name ? t.assignedTo.name.substring(0, 2).toUpperCase() : 'UN',
        department: resolvedDept,
        client: t.companyId?.companyName || t.companyId?.name || null,
        module: resolvedModule,
        task: t.title || 'General Work',
        taskStatus: 'IN_PROGRESS',
        rawDescription: t.description || t.title,
        hours: elapsedHours,
        billable: true,
        source: 'timer',
        isRunning: isRunning
      };
    });

    const totalLogged = await TimeEntry.countDocuments(matchQuery);
    const total = totalLogged + activeEntries.length;

    // Adjust limit on page 1 if active entries are prepended
    const historicalLimit = page === 1 ? Math.max(1, limit - activeEntries.length) : limit;
    const historicalSkip = page === 1 ? 0 : skip - activeEntries.length;

    const entries = await TimeEntry.find(matchQuery)
      .populate('employee', 'name departmentId departmentName')
      .populate('client', 'name companyName')
      .populate('task', 'title department status')
      .populate('department', 'name')
      .sort({ date: -1, createdAt: -1 })
      .skip(historicalSkip > 0 ? historicalSkip : 0)
      .limit(historicalLimit);

    const historicalFormatted = entries.map(e => {
      const resolvedDept = e.department?.name 
        || deptIdMap[e.department?.toString()]
        || e.employee?.departmentName 
        || resolveDeptName(e.task?.department) 
        || resolveDeptName(e.moduleName) 
        || '—';

      let resolvedModule = resolveDeptName(e.moduleName) 
        || e.department?.name 
        || resolveDeptName(e.task?.department) 
        || 'General';

      if (mongoose.Types.ObjectId.isValid(resolvedModule) && /^[0-9a-fA-F]{24}$/.test(resolvedModule)) {
        resolvedModule = 'General';
      }

      return {
        id: e._id,
        date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        rawDate: e.date,
        employeeId: e.employee?._id,
        clientId: e.client?._id,
        taskId: e.task?._id,
        departmentId: e.department?._id || null,
        member: e.employee?.name || 'Unknown',
        memberInit: e.employee?.name ? e.employee.name.substring(0, 2).toUpperCase() : 'UN',
        department: resolvedDept,
        client: e.client?.companyName || e.client?.name || null,
        module: resolvedModule,
        task: e.description || e.task?.title || 'General Work',
        taskStatus: e.task?.status,
        rawDescription: e.description,
        hours: e.hours,
        billable: e.isBillable,
        source: e.source,
        isRunning: false
      };
    });

    const combinedData = page === 1 ? [...activeEntries, ...historicalFormatted] : historicalFormatted;

    res.status(200).json({ success: true, data: combinedData, total, page, limit });
  } catch (error) {
    console.error('Error fetching recent entries:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch entries', error: error.message });
  }
};



// ─── GET /dashboard — getDashboardData ───────────────────────────────────────

exports.getDashboardData = async (req, res) => {
  try {
    if (!req.companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const tenantObjectId = new mongoose.Types.ObjectId(req.companyId);

    const startDateParam = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDateParam = req.query.endDate ? new Date(req.query.endDate) : null;
    const dateParam = req.query.date ? new Date(req.query.date) : new Date();

    let startOfWeek, endOfWeek, startOfMonth, endOfMonth;
    
    if (startDateParam && endDateParam) {
      startOfWeek = new Date(startDateParam);
      startOfWeek.setUTCHours(0, 0, 0, 0);
      
      endOfWeek = new Date(endDateParam);
      endOfWeek.setUTCHours(23, 59, 59, 999);
      
      startOfMonth = startOfWeek;
      endOfMonth = endOfWeek;
    } else {
      const weekRange = getWeekRange(dateParam);
      startOfWeek = weekRange.startOfWeek;
      endOfWeek = weekRange.endOfWeek;
      startOfMonth = new Date(dateParam.getFullYear(), dateParam.getMonth(), 1);
      endOfMonth = new Date(dateParam.getFullYear(), dateParam.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const companyIdList = await getCompanyIdList(req, tenantObjectId);

    const baseMatch = {
      $or: [
        { tenantCompanyId: { $in: companyIdList } },
        { client: { $in: companyIdList } }
      ]
    };
    // Regular users: scope to their own entries
    if (['user', 'brand_team_user'].includes(req.user.role)) {
      baseMatch.employee = new mongoose.Types.ObjectId(req.user._id);
    }

    const weekMatch = { ...baseMatch, date: { $gte: startOfWeek, $lte: endOfWeek } };
    const monthMatch = { ...baseMatch, date: { $gte: startOfMonth, $lte: endOfMonth } };

    // ── KPI: Hours logged this week ──────────────────────────────────────────
    const kpiAgg = await TimeEntry.aggregate([
      { $match: weekMatch },
      { $group: {
        _id: null,
        totalHours: { $sum: '$hours' },
        billableHours: { $sum: { $cond: [{ $eq: ['$isBillable', true] }, '$hours', 0] } },
        nonBillableHours: { $sum: { $cond: [{ $eq: ['$isBillable', false] }, '$hours', 0] } }
      }}
    ]);
    const kpi = kpiAgg[0] || { totalHours: 0, billableHours: 0, nonBillableHours: 0 };
    const utilizationRate = kpi.totalHours > 0 ? Math.round((kpi.billableHours / kpi.totalHours) * 100) : 0;

    // ── Active timers (strictly tasks in_progress with workStartedAt set) ─────
    const now = new Date();
    const nowMs = now.getTime();
    const weekStartMs = startOfWeek.getTime();
    const weekEndMs = endOfWeek.getTime();

    const activeTasksRaw = await Task.find({
      $or: [
        { tenantCompanyId: { $in: companyIdList } },
        { companyId: { $in: companyIdList } }
      ],
      status: { $in: IN_PROGRESS_STATUSES },
      workStartedAt: { $ne: null }
    }).populate('assignedTo', 'name departmentId departmentName')
      .populate('companyId', 'companyName name');

    let activeTimersRunningTimeMin = 0; // for the Active Timers card (total running)
    let activeWeekHours = 0; // to add to kpi.totalHours

    const activeTasksCurrentlyRunning = activeTasksRaw.filter(t => isTaskTimerActive(t, now));

    const activeTasksData = activeTasksRaw.map(t => {
      const startedAt = new Date(t.workStartedAt);
      const startedMs = startedAt.getTime();
      const dueEndMs = getTaskDueEndMs(t.dueDate);
      const stopMs = Math.min(nowMs, dueEndMs);
      
      // Running time for active session (only if not past due date)
      if (nowMs <= dueEndMs && startedMs < stopMs) {
        const totalElapsedMin = (stopMs - startedMs) / 60000;
        activeTimersRunningTimeMin += totalElapsedMin;
      }

      // Calculate elapsed active hours within the week (each day stops at due date)
      let elapsedWeekHours = 0;
      for (let isoDay = 1; isoDay <= 7; isoDay++) {
        const dayStartMs = weekStartMs + (isoDay - 1) * 86400000;
        const dayEndMs = dayStartMs + 86400000 - 1;
        elapsedWeekHours += calculateActiveTaskDayHours(t, dayStartMs, dayEndMs, nowMs);
      }
      activeWeekHours += elapsedWeekHours;

      return {
        ...t.toObject(),
        employeeId: t.assignedTo?._id?.toString(),
        departmentId: t.assignedTo?.departmentId?.toString(),
        departmentName: t.assignedTo?.departmentName || t.department || '—',
        elapsedWeekHours,
        startedMs,
        dueEndMs
      };
    });

    // Add active week hours to KPIs
    kpi.totalHours += activeWeekHours;
    kpi.billableHours += activeWeekHours;

    const activeTimersList = activeTasksCurrentlyRunning.map(t => ({
      taskId: t._id,
      taskTitle: t.title,
      memberName: t.assignedTo?.name || 'Unknown',
      department: t.assignedTo?.departmentName || t.department || '—',
      startedAt: t.workStartedAt
    }));

    // ── Missing timesheets: employees who haven't logged today ───────────────
    let eligibleUsers = await getEligibleUsers(req, companyIdList);

    const todayStart = new Date(dateParam); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(dateParam); todayEnd.setHours(23, 59, 59, 999);
    const todayLoggedEmployeeIds = await TimeEntry.find({
      ...baseMatch, date: { $gte: todayStart, $lte: todayEnd }
    }).distinct('employee');

    const loggedSet = new Set(todayLoggedEmployeeIds.map(id => id.toString()));
    let missingCount = 0;
    eligibleUsers.forEach(u => { if (!loggedSet.has(u._id.toString())) missingCount++; });

    const totalEligibleMembers = eligibleUsers.length;
    const avgHoursPerMember = totalEligibleMembers > 0 ? parseFloat((kpi.totalHours / totalEligibleMembers).toFixed(2)) : 0;

    const kpiCards = {
      totalHours: parseFloat(kpi.totalHours.toFixed(1)),
      capacity: null,
      capacityRemaining: null,
      billableHours: parseFloat(kpi.billableHours.toFixed(1)),
      nonBillableHours: parseFloat(kpi.nonBillableHours.toFixed(1)),
      billablePercent: kpi.totalHours > 0 ? Math.round((kpi.billableHours / kpi.totalHours) * 100) : 0,
      nonBillablePercent: kpi.totalHours > 0 ? Math.round((kpi.nonBillableHours / kpi.totalHours) * 100) : 0,
      utilizationRate: utilizationRate > 100 ? 100 : utilizationRate,
      activeTimersCount: activeTasksCurrentlyRunning.length,
      activeTimersRunningTime: parseFloat((activeTimersRunningTimeMin / 60).toFixed(2)),
      activeTimersList,
      missingTimesheetsCount: missingCount,
      totalEligibleMembers,
      avgHoursPerMember,
      missingTimesheetsMessage: eligibleUsers.length === 0
        ? 'No members to track'
        : missingCount > 0
          ? `${missingCount} haven't logged today`
          : 'Everyone has logged today'
    };

    // ── Weekly timesheet: hours per member per day ───────────────────────────
    const weekEntries = await TimeEntry.find(weekMatch)
      .populate('task', 'title status companyId')
      .populate('client', 'companyName name')
      .populate('department', 'name')
      .lean();

    // Fetch departments in this tenant/company for enriching data
    const departments = await getDepartments(companyIdList);
    const deptMap = {};
    departments.forEach(d => { deptMap[d._id.toString()] = d.name; });
    
    // Add missing users who have time entries or active tasks but are not in eligibleUsers
    const activeEmployeeIds = activeTasksData.map(t => t.employeeId).filter(Boolean);
    const timeEntryEmployeeIds = weekEntries.map(e => e.employee?.toString()).filter(Boolean);
    const allRelevantEmployeeIds = [...new Set([...activeEmployeeIds, ...timeEntryEmployeeIds])];
    
    const missingIds = allRelevantEmployeeIds.filter(id => !eligibleUsers.some(u => u._id.toString() === id));
    if (missingIds.length > 0) {
      const missingUsers = await User.find({ _id: { $in: missingIds } }).select('_id name role departmentId departmentName').lean();
      eligibleUsers.push(...missingUsers);
    }
    
    // Add "Unassigned" row if there are tasks with no assigned user
    if (activeTasksData.some(t => !t.employeeId && t.elapsedWeekHours > 0) || weekEntries.some(e => !e.employee)) {
      if (!eligibleUsers.some(u => u._id.toString() === 'unassigned')) {
        eligibleUsers.push({
          _id: 'unassigned',
          name: 'Unassigned Tasks',
          role: 'N/A',
          departmentId: null,
          departmentName: '—'
        });
      }
    }

    const getIsoDayOfWeek = (dateInput) => {
      if (!dateInput) return 0;
      if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [y, m, dayNum] = dateInput.split('-').map(Number);
        const d = new Date(Date.UTC(y, m - 1, dayNum));
        const day = d.getUTCDay();
        return day === 0 ? 7 : day;
      }
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return 0;
      const day = d.getUTCDay();
      return day === 0 ? 7 : day;
    };

    const colors = ['var(--accent-warning)', 'var(--accent-primary)', 'var(--accent-info)', 'var(--accent-secondary)', 'var(--accent-danger)'];
    const timesheetData = eligibleUsers.map((u, i) => {
      const empEntries = weekEntries.filter(e => e.employee && e.employee.toString() === u._id.toString());
      
      const daysArr = [1, 2, 3, 4, 5, 6, 7].map(isoDay => {
        const dayEntries = empEntries.filter(e => getIsoDayOfWeek(e.date) === isoDay);
        const dayHours = dayEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
        
        const entries = dayEntries.map(e => ({
          taskId: e.task?._id,
          taskTitle: e.description || e.task?.title || 'General Work',
          client: e.client?.companyName || e.client?.name || null,
          department: e.department?.name || e.moduleName || null,
          status: e.task?.status,
          hours: Number(e.hours) || 0,
          isBillable: e.isBillable !== false,
          isRunning: false,
          startedAt: e.createdAt,
          description: e.description
        }));

        return {
          total: parseFloat(dayHours.toFixed(2)),
          entries
        };
      });

      // Distribute active timer hours across the week days
      const daysArrWithActive = [...daysArr];
      const empActiveTasks = activeTasksData.filter(t => t.employeeId === u._id.toString());
      
      for (let isoDay = 1; isoDay <= 7; isoDay++) {
        const dayStartMs = weekStartMs + (isoDay - 1) * 86400000;
        const dayEndMs = dayStartMs + 86400000 - 1;
        
        let dayActiveHoursSum = 0;
        empActiveTasks.forEach(t => {
          const taskDayHours = calculateActiveTaskDayHours(t, dayStartMs, dayEndMs, nowMs);
          if (taskDayHours > 0) {
            dayActiveHoursSum += taskDayHours;
            const dueEndMs = getTaskDueEndMs(t.dueDate);
            daysArrWithActive[isoDay - 1].entries.push({
              taskId: t._id,
              taskTitle: t.title || 'General Work',
              client: t.companyId?.companyName || t.companyId?.name || null,
              department: t.department || null,
              status: t.status,
              hours: parseFloat(taskDayHours.toFixed(2)),
              isBillable: true,
              isRunning: nowMs <= dueEndMs,
              startedAt: new Date(Math.max(t.startedMs, dayStartMs))
            });
          }
        });

        // Cap total daily hours (logged + active) to physical max of 24h
        const currentTotal = daysArrWithActive[isoDay - 1].total;
        const cappedDayTotal = Math.min(24, currentTotal + dayActiveHoursSum);
        daysArrWithActive[isoDay - 1].total = parseFloat(cappedDayTotal.toFixed(2));
      }

      const finalTotal = daysArrWithActive.reduce((s, v) => s + v.total, 0);

      const deptName = u.departmentId ? (deptMap[u.departmentId.toString()] || u.departmentName || '—') : (u.departmentName || '—');

      return {
        name: u.name,
        role: u.roleName || u.role,
        department: deptName,
        initials: u.name ? u.name.substring(0, 2).toUpperCase() : 'UN',
        color: colors[i % colors.length],
        mon: daysArrWithActive[0], tue: daysArrWithActive[1], wed: daysArrWithActive[2],
        thu: daysArrWithActive[3], fri: daysArrWithActive[4], sat: daysArrWithActive[5], sun: daysArrWithActive[6],
        total: parseFloat(finalTotal.toFixed(2))
      };
    });

    // ── Time by client (current month) ───────────────────────────────────────
    const clientAgg = await TimeEntry.aggregate([
      { $match: monthMatch },
      { $group: {
        _id: '$client',
        billable: { $sum: { $cond: [{ $eq: ['$isBillable', true] }, '$hours', 0] } },
        nonBillable: { $sum: { $cond: [{ $eq: ['$isBillable', false] }, '$hours', 0] } }
      }}
    ]);
    const clientIds = clientAgg.map(c => c._id).filter(Boolean);
    const clientsInfo = await User.find({ _id: { $in: clientIds } }).select('companyName name').lean();

    const timeByClient = clientAgg.map(c => {
      if (!c._id) return { client: 'Internal / No Client', billable: parseFloat(c.billable.toFixed(1)), nonBillable: parseFloat(c.nonBillable.toFixed(1)) };
      const cInfo = clientsInfo.find(u => u._id.toString() === c._id.toString());
      return { client: cInfo ? (cInfo.companyName || cInfo.name) : 'Unknown Client', billable: parseFloat(c.billable.toFixed(1)), nonBillable: parseFloat(c.nonBillable.toFixed(1)) };
    });

    // Add active time to timeByClient
    activeTasksData.forEach(t => {
      if (t.elapsedMonthHours > 0) {
        const cId = t.companyId ? t.companyId.toString() : null;
        let cInfo = cId ? clientsInfo.find(u => u._id.toString() === cId) : null;
        if (cId && !cInfo) {
          // If not in pre-fetched clientsInfo, handle it
          cInfo = { companyName: 'Unknown Client' }; 
        }
        const clientName = cId ? (cInfo.companyName || cInfo.name || 'Unknown Client') : 'Internal / No Client';
        
        const existing = timeByClient.find(c => c.client === clientName);
        if (existing) {
          existing.billable += t.elapsedMonthHours;
        } else {
          timeByClient.push({
            client: clientName,
            billable: t.elapsedMonthHours,
            nonBillable: 0
          });
        }
      }
    });

    timeByClient.forEach(c => {
      c.billable = parseFloat(c.billable.toFixed(1));
    });

    // ── Department breakdown: hours per department this week ──────────────────
    const deptTimeAgg = await TimeEntry.aggregate([
      { $match: weekMatch },
      {
        $lookup: {
          from: 'users',
          localField: 'employee',
          foreignField: '_id',
          as: 'employeeDoc'
        }
      },
      { $unwind: { path: '$employeeDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$employeeDoc.departmentId', 'no-dept'] },
          deptName: { $first: { $ifNull: ['$employeeDoc.departmentName', 'No Department'] } },
          totalHours: { $sum: '$hours' },
          billableHours: { $sum: { $cond: [{ $eq: ['$isBillable', true] }, '$hours', 0] } },
          memberCount: { $addToSet: '$employee' }
        }
      },
      { $project: { deptName: 1, totalHours: 1, billableHours: 1, memberCount: { $size: '$memberCount' } } }
    ]);

    // Enrich with dept names from Department collection
    const timeByDepartment = deptTimeAgg.map(d => ({
      department: d._id && d._id !== 'no-dept' ? (deptMap[d._id.toString()] || d.deptName || 'No Department') : 'No Department',
      totalHours: d.totalHours,
      billable: d.billableHours,
      nonBillable: d.totalHours - d.billableHours,
      members: d.memberCount
    }));

    // Add active time to timeByDepartment
    activeTasksData.forEach(t => {
      if (t.elapsedWeekHours > 0) {
        const dId = t.departmentId;
        const deptName = dId ? (deptMap[dId] || t.departmentName) : t.departmentName;
        
        let existing = timeByDepartment.find(d => d.department === deptName);
        if (existing) {
          existing.totalHours += t.elapsedWeekHours;
          existing.billable += t.elapsedWeekHours;
          // Note: not incrementing members if employee already counted, to prevent double counting
        } else {
          timeByDepartment.push({
            department: deptName,
            totalHours: t.elapsedWeekHours,
            billable: t.elapsedWeekHours,
            nonBillable: 0,
            members: 1
          });
        }
      }
    });

    timeByDepartment.forEach(d => {
      d.totalHours = parseFloat(d.totalHours.toFixed(1));
      d.billable = parseFloat(d.billable.toFixed(1));
      d.nonBillable = parseFloat(d.nonBillable.toFixed(1));
    });

    res.status(200).json({
      success: true,
      kpis: kpiCards,
      timesheet: timesheetData,
      timeByClient,
      timeByDepartment,
      departments: departments.map(d => ({ _id: d._id, name: d.name }))
    });
  } catch (error) {
    console.error('getDashboardData error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data', error: error.message });
  }
};

// ─── GET /options — getFormOptions ───────────────────────────────────────────

exports.getFormOptions = async (req, res) => {
  try {
    if (!req.companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const tenantObjectId = new mongoose.Types.ObjectId(req.companyId);
    const companyIdList = await getCompanyIdList(req, tenantObjectId);

    const employees = await getEligibleUsers(req, companyIdList);

    const clients = await User.find({
      $or: [
        { agencyId: { $in: companyIdList } },
        { brandId: { $in: companyIdList } },
        { companyId: { $in: companyIdList } }
      ],
      role: { $in: CLIENT_ROLES }
    }).select('companyName name').lean();

    const tasks = await Task.find({
      $or: [{ tenantCompanyId: { $in: companyIdList } }, { companyId: { $in: companyIdList } }],
      status: { $nin: ['completed', 'complete', 'validated', 'done', 'rejected'] }
    }).select('title department').lean();

    const departments = await getDepartments(companyIdList);

    res.status(200).json({ success: true, data: { employees, clients, tasks, departments } });
  } catch (error) {
    console.error('getFormOptions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch form options', error: error.message });
  }
};

// ─── GET /performance — getTeamTaskPerformance ────────────────────────────────

exports.getTeamTaskPerformance = async (req, res) => {
  try {
    if (!req.companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const tenantObjectId = new mongoose.Types.ObjectId(req.companyId);
    const companyIdList = await getCompanyIdList(req, tenantObjectId);

    const startDateParam = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDateParam = req.query.endDate ? new Date(req.query.endDate) : null;
    const dateParam = req.query.date ? new Date(req.query.date) : new Date();

    let startOfWeek, endOfWeek;
    
    if (startDateParam && endDateParam) {
      startOfWeek = new Date(startDateParam);
      startOfWeek.setUTCHours(0, 0, 0, 0);
      
      endOfWeek = new Date(endDateParam);
      endOfWeek.setUTCHours(23, 59, 59, 999);
    } else {
      const weekRange = getWeekRange(dateParam);
      startOfWeek = weekRange.startOfWeek;
      endOfWeek = weekRange.endOfWeek;
    }

    const completedStatuses = [
      'completed', 'done', 'validated', 'complete', 'review', 'REVIEW',
      'submitted', 'SUBMITTED', 'in_review', 'IN_REVIEW', 'in review', 'IN REVIEW',
      'reviewing', 'REVIEWING', 'APPROVED', 'approved', 'Completed', 'Done',
      'Validated', 'Complete', 'sent_for_client_review', 'SENT_FOR_CLIENT_REVIEW',
      'client_review', 'CLIENT_REVIEW', 'review_ready', 'closed', 'Closed', 'CLOSED'
    ];

    // Tasks completed this week based on any completion date field, updatedAt, createdAt or dueDate
    const tasksCompletedAgg = await Task.aggregate([
      { $match: {
        $or: [{ tenantCompanyId: { $in: companyIdList } }, { companyId: { $in: companyIdList } }],
        status: { $in: completedStatuses },
        assignedTo: { $ne: null },
        $or: [
          { actualCompletionDate: { $gte: startOfWeek, $lte: endOfWeek } },
          { validatedAt: { $gte: startOfWeek, $lte: endOfWeek } },
          { completedAt: { $gte: startOfWeek, $lte: endOfWeek } },
          { workCompletedAt: { $gte: startOfWeek, $lte: endOfWeek } },
          { updatedAt: { $gte: startOfWeek, $lte: endOfWeek } },
          { createdAt: { $gte: startOfWeek, $lte: endOfWeek } },
          { dueDate: { $gte: startOfWeek, $lte: endOfWeek } }
        ]
      }},
      { $group: { _id: '$assignedTo', tasksCompleted: { $sum: 1 } } }
    ]);

    // Hours from TimeEntry this week
    const timeSpentAgg = await TimeEntry.aggregate([
      { $match: { tenantCompanyId: { $in: companyIdList }, date: { $gte: startOfWeek, $lte: endOfWeek } } },
      { $group: { _id: '$employee', totalTimeSpentHours: { $sum: '$hours' } } }
    ]);

    // Fetch ALL active trackable users for this tenant
    const users = await getEligibleUsers(req, companyIdList);

    // Fetch departments for label mapping
    const departments = await getDepartments(companyIdList);
    const deptMap = {};
    departments.forEach(d => { 
      deptMap[d._id.toString()] = d.name;
      if (d.slug) deptMap[d.slug] = d.name;
      if (d.name) deptMap[d.name] = d.name;
    });

    const getNormalizedDeptName = (raw) => {
      if (!raw || raw === '—' || raw === 'no-dept') return 'No Department';
      const str = raw.toString();
      if (deptMap[str]) return deptMap[str];
      const matched = departments.find(d => 
        d._id.toString() === str || 
        (d.slug && d.slug.toLowerCase() === str.toLowerCase()) || 
        (d.name && d.name.toLowerCase() === str.toLowerCase())
      );
      if (matched) return matched.name;
      return str;
    };

    const now = new Date();
    const nowMs = now.getTime();
    const weekStartMs = startOfWeek.getTime();
    const weekEndMs = endOfWeek.getTime();

    // Fetch active tasks to get their active time
    const activeTasksRaw = await Task.find({
      $or: [{ tenantCompanyId: { $in: companyIdList } }, { companyId: { $in: companyIdList } }],
      status: { $in: IN_PROGRESS_STATUSES },
      workStartedAt: { $ne: null }
    }).populate('assignedTo', 'name departmentId departmentName');

    const activeTasks = activeTasksRaw;

    // Ensure active users are included in `users` list
    const activeEmployeeIds = activeTasks.map(t => t.assignedTo?._id?.toString()).filter(Boolean);
    const timeEntryEmployeeIds = timeSpentAgg.map(t => t._id?.toString()).filter(Boolean);
    const completedTasksEmployeeIds = tasksCompletedAgg.map(t => t._id?.toString()).filter(Boolean);
    const allRelevantIds = [...new Set([...activeEmployeeIds, ...timeEntryEmployeeIds, ...completedTasksEmployeeIds])];
    
    const missingUserIds = allRelevantIds.filter(id => !users.some(u => u._id.toString() === id));
    if (missingUserIds.length > 0) {
      const missingUsers = await User.find({ _id: { $in: missingUserIds } }).select('_id name role departmentId departmentName').lean();
      users.push(...missingUsers);
    }
    
    if (activeTasks.some(t => !t.assignedTo) || timeSpentAgg.some(t => !t._id) || tasksCompletedAgg.some(t => !t._id)) {
      if (!users.some(u => u._id.toString() === 'unassigned')) {
        users.push({
          _id: 'unassigned',
          name: 'Unassigned Tasks',
          role: 'N/A',
          departmentId: null,
          departmentName: '—'
        });
      }
    }

    const performanceData = users.map(u => {
      const tc = tasksCompletedAgg.find(t => t._id && t._id.toString() === u._id.toString());
      const ts = timeSpentAgg.find(t => t._id && t._id.toString() === u._id.toString());
      const rawDept = u.departmentId ? (deptMap[u.departmentId.toString()] || u.departmentName || '—') : (u.departmentName || '—');
      const deptName = getNormalizedDeptName(rawDept);
      return {
        userId: u._id,
        name: u.name,
        role: u.roleName || u.role,
        department: deptName,
        tasksCompleted: tc ? tc.tasksCompleted : 0,
        totalTimeSpent: ts ? ts.totalTimeSpentHours : 0
      };
    });

    activeTasks.forEach(t => {
      let elapsedHours = 0;
      for (let isoDay = 1; isoDay <= 7; isoDay++) {
        const dayStartMs = weekStartMs + (isoDay - 1) * 86400000;
        const dayEndMs = dayStartMs + 86400000 - 1;
        elapsedHours += calculateActiveTaskDayHours(t, dayStartMs, dayEndMs, nowMs);
      }
      
      const uId = t.assignedTo ? t.assignedTo._id.toString() : 'unassigned';
      const pData = performanceData.find(p => p.userId.toString() === uId);
      if (pData && elapsedHours > 0) {
        pData.totalTimeSpent += elapsedHours;
      }
    });

    performanceData.forEach(p => {
      p.totalTimeSpent = parseFloat(p.totalTimeSpent.toFixed(1));
    });

    // Also return department-level rollup initialized with active departments
    const deptPerformance = {};
    departments.forEach(d => {
      deptPerformance[d.name] = { department: d.name, members: 0, tasksCompleted: 0, totalTimeSpent: 0 };
    });

    performanceData.forEach(p => {
      const key = getNormalizedDeptName(p.department);
      if (!deptPerformance[key]) {
        deptPerformance[key] = { department: key, members: 0, tasksCompleted: 0, totalTimeSpent: 0 };
      }
      deptPerformance[key].members++;
      deptPerformance[key].tasksCompleted += p.tasksCompleted;
      deptPerformance[key].totalTimeSpent = parseFloat((deptPerformance[key].totalTimeSpent + p.totalTimeSpent).toFixed(1));
    });

    res.status(200).json({
      success: true,
      data: performanceData,
      byDepartment: Object.values(deptPerformance)
    });
  } catch (error) {
    console.error('getTeamTaskPerformance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch team performance', error: error.message });
  }
};

// ─── GET /timesheet — getTimesheetData ───────────────────────────────────────
exports.getTimesheetData = async (req, res) => {
  try {
    if (!req.companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const tenantObjectId = new mongoose.Types.ObjectId(req.companyId);

    const startDateParam = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDateParam = req.query.endDate ? new Date(req.query.endDate) : null;
    const dateParam = req.query.date ? new Date(req.query.date) : new Date();

    let startOfWeek, endOfWeek;
    if (startDateParam && endDateParam) {
      startOfWeek = new Date(startDateParam);
      startOfWeek.setUTCHours(0, 0, 0, 0);
      endOfWeek = new Date(endDateParam);
      endOfWeek.setUTCHours(23, 59, 59, 999);
    } else {
      const weekRange = getWeekRange(dateParam);
      startOfWeek = weekRange.startOfWeek;
      endOfWeek = weekRange.endOfWeek;
    }

    const companyIdList = await getCompanyIdList(req, tenantObjectId);

    const baseMatch = {
      $or: [
        { tenantCompanyId: { $in: companyIdList } },
        { client: { $in: companyIdList } }
      ]
    };
    if (['user', 'brand_team_user'].includes(req.user.role)) {
      baseMatch.employee = new mongoose.Types.ObjectId(req.user._id);
    }

    const weekMatch = { ...baseMatch, date: { $gte: startOfWeek, $lte: endOfWeek } };

    const activeTasks = await Task.find({
      $or: [
        { tenantCompanyId: { $in: companyIdList } },
        { companyId: { $in: companyIdList } }
      ],
      status: { $in: IN_PROGRESS_STATUSES },
      workStartedAt: { $ne: null }
    }).populate('assignedTo', 'name departmentId departmentName')
      .populate('companyId', 'companyName name');

    const now = new Date();
    const weekStartMs = startOfWeek.getTime();
    const weekEndMs = endOfWeek.getTime();
    const nowMs = now.getTime();

    const activeTasksData = activeTasks.map(t => {
      const startedAt = new Date(t.workStartedAt);
      const startedMs = startedAt.getTime();
      return {
        ...t.toObject(),
        employeeId: t.assignedTo?._id?.toString(),
        departmentId: t.assignedTo?.departmentId?.toString(),
        departmentName: t.assignedTo?.departmentName || t.department || '—',
        startedMs
      };
    });

    let eligibleUsers = await getEligibleUsers(req, companyIdList);
    
    // Filter by department and member search
    if (req.query.departmentId && req.query.departmentId !== 'all') {
      eligibleUsers = eligibleUsers.filter(u => u.departmentId?.toString() === req.query.departmentId);
    }
    if (req.query.searchMember) {
      const s = req.query.searchMember.toLowerCase();
      eligibleUsers = eligibleUsers.filter(u => u.name?.toLowerCase().includes(s));
    }

    const total = eligibleUsers.length;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    eligibleUsers = eligibleUsers.slice((page - 1) * limit, page * limit);

    const weekEntries = await TimeEntry.find(weekMatch)
      .populate('task', 'title status companyId')
      .populate('client', 'companyName name')
      .populate('department', 'name')
      .lean();

    const departments = await getDepartments(companyIdList);
    const deptMap = {};
    departments.forEach(d => { deptMap[d._id.toString()] = d.name; });

    const getIsoDayOfWeek = (dateInput) => {
      if (!dateInput) return 0;
      if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [y, m, dayNum] = dateInput.split('-').map(Number);
        const d = new Date(Date.UTC(y, m - 1, dayNum));
        const day = d.getUTCDay();
        return day === 0 ? 7 : day;
      }
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return 0;
      const day = d.getUTCDay();
      return day === 0 ? 7 : day;
    };

    const colors = ['var(--accent-warning)', 'var(--accent-primary)', 'var(--accent-info)', 'var(--accent-secondary)', 'var(--accent-danger)'];
    
    const timesheetData = eligibleUsers.map((u, i) => {
      const empEntries = weekEntries.filter(e => e.employee && e.employee.toString() === u._id.toString());
      
      const daysArr = [1, 2, 3, 4, 5, 6, 7].map(isoDay => {
        const dayEntries = empEntries.filter(e => getIsoDayOfWeek(e.date) === isoDay);
        const dayHours = dayEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
        const entries = dayEntries.map(e => ({
          taskId: e.task?._id,
          taskTitle: e.description || e.task?.title || 'General Work',
          client: e.client?.companyName || e.client?.name || null,
          department: e.department?.name || e.moduleName || null,
          status: e.task?.status,
          hours: Number(e.hours) || 0,
          isBillable: e.isBillable !== false,
          isRunning: false,
          startedAt: e.createdAt,
          description: e.description
        }));
        return { total: parseFloat(dayHours.toFixed(2)), entries };
      });

      const daysArrWithActive = [...daysArr];
      const empActiveTasks = activeTasksData.filter(t => t.employeeId === u._id.toString());
      
      for (let isoDay = 1; isoDay <= 7; isoDay++) {
        const dayStartMs = weekStartMs + (isoDay - 1) * 86400000;
        const dayEndMs = dayStartMs + 86400000 - 1;
        
        let dayActiveHoursSum = 0;
        empActiveTasks.forEach(t => {
          const taskDayHours = calculateActiveTaskDayHours(t, dayStartMs, dayEndMs, nowMs);
          if (taskDayHours > 0) {
            dayActiveHoursSum += taskDayHours;
            const dueEndMs = getTaskDueEndMs(t.dueDate);
            daysArrWithActive[isoDay - 1].entries.push({
              taskId: t._id,
              taskTitle: t.title || 'General Work',
              client: t.companyId?.companyName || t.companyId?.name || null,
              department: t.department || null,
              status: t.status,
              hours: parseFloat(taskDayHours.toFixed(2)),
              isBillable: true,
              isRunning: nowMs <= dueEndMs,
              startedAt: new Date(Math.max(t.startedMs, dayStartMs))
            });
          }
        });

        // Cap total daily hours (logged + active) to physical max of 24h
        const currentTotal = daysArrWithActive[isoDay - 1].total;
        const cappedDayTotal = Math.min(24, currentTotal + dayActiveHoursSum);
        daysArrWithActive[isoDay - 1].total = parseFloat(cappedDayTotal.toFixed(2));
      }

      const finalTotal = daysArrWithActive.reduce((s, v) => s + v.total, 0);
      const deptName = u.departmentId ? (deptMap[u.departmentId.toString()] || u.departmentName || '—') : (u.departmentName || '—');

      return {
        name: u.name,
        role: u.roleName || u.role,
        department: deptName,
        initials: u.name ? u.name.substring(0, 2).toUpperCase() : 'UN',
        color: colors[i % colors.length],
        mon: daysArrWithActive[0], tue: daysArrWithActive[1], wed: daysArrWithActive[2],
        thu: daysArrWithActive[3], fri: daysArrWithActive[4], sat: daysArrWithActive[5], sun: daysArrWithActive[6],
        total: parseFloat(finalTotal.toFixed(2))
      };
    });

    res.status(200).json({ success: true, data: timesheetData, total, page, limit });
  } catch (error) {
    console.error('getTimesheetData error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch timesheet data', error: error.message });
  }
};
