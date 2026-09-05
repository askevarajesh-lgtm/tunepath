const TimeEntry = require('./timeTracking.model');
const User = require('../auth/user.model');
const Task = require('../tasks/task.model');
const Department = require('../departments/department.model');
const mongoose = require('mongoose');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the User filter for the current tenant.
 * User.agencyId is the correct field (NOT tenantCompanyId which doesn't exist on User schema).
 */
function buildTenantUserFilter(tenantObjectId) {
  return { agencyId: tenantObjectId };
}

/** Roles that are considered trackable employees */
const EMPLOYEE_ROLES = [
  'user', 'brand_team_user',
  'coordinator', 'digital_marketing_manager', 'digital_marketing_coordinator', 'website_coordinator'
];

/** Roles that are considered clients */
const CLIENT_ROLES = ['brand_super_admin', 'brand_manager', 'agency_client'];

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

// ─── GET /recent — getRecentEntries ──────────────────────────────────────────

exports.getRecentEntries = async (req, res) => {
  try {
    if (!req.companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const tenantObjectId = new mongoose.Types.ObjectId(req.companyId);

    let matchQuery = { tenantCompanyId: tenantObjectId };
    // Regular users see only their own entries
    if (['user', 'brand_team_user'].includes(req.user.role)) {
      matchQuery.employee = new mongoose.Types.ObjectId(req.user._id);
    }

    const entries = await TimeEntry.find(matchQuery)
      .populate('employee', 'name departmentId departmentName')
      .populate('client', 'name companyName')
      .populate('task', 'title department')
      .populate('department', 'name')
      .sort({ date: -1, createdAt: -1 })
      .limit(20);

    const formatted = entries.map(e => ({
      id: e._id,
      date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      rawDate: e.date,
      employeeId: e.employee?._id,
      clientId: e.client?._id,
      taskId: e.task?._id,
      departmentId: e.department?._id || null,
      member: e.employee?.name || 'Unknown',
      memberInit: e.employee?.name?.substring(0, 2).toUpperCase() || 'UN',
      department: e.department?.name || e.employee?.departmentName || e.task?.department || '—',
      client: e.client?.companyName || e.client?.name || null,
      module: e.moduleName || 'Other',
      task: e.description || e.task?.title || 'General Work',
      rawDescription: e.description,
      hours: e.hours,
      billable: e.isBillable,
      source: e.source
    }));

    res.status(200).json({ success: true, data: formatted });
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

    const baseMatch = { tenantCompanyId: tenantObjectId };
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

    // ── Active timers (tasks in_progress with workStartedAt set) ─────────────
    const activeTasks = await Task.find({
      $or: [{ tenantCompanyId: tenantObjectId }, { companyId: tenantObjectId }],
      status: 'in_progress',
      workStartedAt: { $ne: null }
    }).populate('assignedTo', 'name departmentName');

    const now = new Date();
    let activeTimersRunningTimeMin = 0;
    activeTasks.forEach(t => {
      const elapsedMin = Math.max(0, Math.round((now - new Date(t.workStartedAt)) / 60000));
      // Cap running time per timer to 12 hours (720 min) to handle unstopped stale timers
      activeTimersRunningTimeMin += Math.min(elapsedMin, 720);
    });

    const activeTimersList = activeTasks.map(t => ({
      taskId: t._id,
      taskTitle: t.title,
      memberName: t.assignedTo?.name || 'Unknown',
      department: t.assignedTo?.departmentName || t.department || '—',
      startedAt: t.workStartedAt
    }));

    // ── Missing timesheets: employees who haven't logged today ───────────────
    // Use agencyId (correct field), not tenantCompanyId which doesn't exist on User
    const eligibleUsers = await User.find({
      agencyId: tenantObjectId,
      role: { $in: EMPLOYEE_ROLES }
    }).select('_id name role departmentId departmentName').lean();

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
      activeTimersCount: activeTasks.length,
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
    const weekEntries = await TimeEntry.find(weekMatch).lean();

    // Fetch departments in this agency for enriching data
    const departments = await Department.find({ agencyId: tenantObjectId }).select('_id name').lean();
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
        const dayHours = empEntries
          .filter(e => getIsoDayOfWeek(e.date) === isoDay)
          .reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
        return dayHours === 0 ? '-' : parseFloat(dayHours.toFixed(2));
      });

      const visualTotal = daysArr.reduce((s, v) => s + (v === '-' ? 0 : v), 0);
      const deptName = u.departmentId ? (deptMap[u.departmentId.toString()] || u.departmentName || '—') : (u.departmentName || '—');

      return {
        name: u.name,
        role: u.role,
        department: deptName,
        initials: u.name ? u.name.substring(0, 2).toUpperCase() : 'UN',
        color: colors[i % colors.length],
        mon: daysArr[0], tue: daysArr[1], wed: daysArr[2],
        thu: daysArr[3], fri: daysArr[4], sat: daysArr[5], sun: daysArr[6],
        total: parseFloat(visualTotal.toFixed(2))
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
      totalHours: parseFloat(d.totalHours.toFixed(1)),
      billable: parseFloat(d.billableHours.toFixed(1)),
      nonBillable: parseFloat((d.totalHours - d.billableHours).toFixed(1)),
      members: d.memberCount
    }));

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

    // Use agencyId (correct field on User schema)
    const employees = await User.find({
      agencyId: tenantObjectId,
      role: { $in: EMPLOYEE_ROLES }
    }).select('name role departmentId departmentName').lean();

    const clients = await User.find({
      agencyId: tenantObjectId,
      role: { $in: CLIENT_ROLES }
    }).select('companyName name').lean();

    const tasks = await Task.find({
      $or: [{ tenantCompanyId: tenantObjectId }, { companyId: tenantObjectId }],
      status: { $nin: ['completed', 'complete', 'validated', 'done', 'rejected'] }
    }).select('title department').lean();

    const departments = await Department.find({
      agencyId: tenantObjectId,
      status: 'active'
    }).select('name slug').lean();

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
      'submitted', 'SUBMITTED', 'in_review', 'IN_REVIEW', 'APPROVED', 'approved',
      'Completed', 'Done', 'Validated', 'Complete'
    ];

    // Tasks completed this week based on any completion date field or updatedAt
    const tasksCompletedAgg = await Task.aggregate([
      { $match: {
        $or: [{ tenantCompanyId: tenantObjectId }, { companyId: tenantObjectId }],
        status: { $in: completedStatuses },
        assignedTo: { $ne: null },
        $or: [
          { actualCompletionDate: { $gte: startOfWeek, $lte: endOfWeek } },
          { validatedAt: { $gte: startOfWeek, $lte: endOfWeek } },
          { completedAt: { $gte: startOfWeek, $lte: endOfWeek } },
          { workCompletedAt: { $gte: startOfWeek, $lte: endOfWeek } },
          { updatedAt: { $gte: startOfWeek, $lte: endOfWeek } }
        ]
      }},
      { $group: { _id: '$assignedTo', tasksCompleted: { $sum: 1 } } }
    ]);

    // Hours from TimeEntry this week
    const timeSpentAgg = await TimeEntry.aggregate([
      { $match: { tenantCompanyId: tenantObjectId, date: { $gte: startOfWeek, $lte: endOfWeek } } },
      { $group: { _id: '$employee', totalTimeSpentHours: { $sum: '$hours' } } }
    ]);

    // Fetch ALL active trackable users for this tenant
    const users = await User.find({ 
      agencyId: tenantObjectId,
      role: { $in: EMPLOYEE_ROLES }
    }).select('name role departmentId departmentName').lean();

    // Fetch departments for label mapping
    const departments = await Department.find({ agencyId: tenantObjectId }).select('_id name').lean();
    const deptMap = {};
    departments.forEach(d => { deptMap[d._id.toString()] = d.name; });

    const performanceData = users.map(u => {
      const tc = tasksCompletedAgg.find(t => t._id && t._id.toString() === u._id.toString());
      const ts = timeSpentAgg.find(t => t._id && t._id.toString() === u._id.toString());
      const deptName = u.departmentId ? (deptMap[u.departmentId.toString()] || u.departmentName || '—') : (u.departmentName || '—');
      return {
        userId: u._id,
        name: u.name,
        role: u.role,
        department: deptName,
        tasksCompleted: tc ? tc.tasksCompleted : 0,
        totalTimeSpent: ts ? parseFloat(ts.totalTimeSpentHours.toFixed(1)) : 0
      };
    });

    // Also return department-level rollup initialized with active departments
    const deptPerformance = {};
    departments.forEach(d => {
      deptPerformance[d.name] = { department: d.name, members: 0, tasksCompleted: 0, totalTimeSpent: 0 };
    });

    performanceData.forEach(p => {
      const key = p.department && p.department !== '—' ? p.department : 'No Department';
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
