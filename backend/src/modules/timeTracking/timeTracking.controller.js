const TimeEntry = require('./timeTracking.model');
const User = require('../auth/user.model');
const Task = require('../tasks/task.model');
const Department = require('../departments/department.model');
const mongoose = require('mongoose');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXCLUDED_SYSTEM_ROLES = ['supreme_super_admin', 'commander_admin', 'agency_super_admin'];

/** Roles that are considered clients */
const CLIENT_ROLES = ['brand_super_admin', 'brand_manager', 'agency_client'];

function getCompanyIdList(req, tenantObjectId) {
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

  return Array.from(new Set(ids)).map(id => new mongoose.Types.ObjectId(id));
}

async function getEligibleUsers(companyIdList) {
  return await User.find({
    $or: [
      { agencyId: { $in: companyIdList } },
      { brandId: { $in: companyIdList } },
      { companyId: { $in: companyIdList } }
    ],
    role: { $nin: EXCLUDED_SYSTEM_ROLES }
  }).select('_id name role departmentId departmentName').lean();
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
      .populate('task', 'title department status')
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
      taskStatus: e.task?.status,
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
    const companyIdSet = new Set(
      [tenantObjectId, req.user?.companyId, req.user?.brandId, req.user?.agencyId, req.user?._id]
        .filter(Boolean)
        .map(id => id.toString())
    );
    const companyIdList = Array.from(companyIdSet).map(id => new mongoose.Types.ObjectId(id));

    const activeTasks = await Task.find({
      $or: [
        { tenantCompanyId: { $in: companyIdList } },
        { companyId: { $in: companyIdList } }
      ],
      workStartedAt: { $ne: null }
    }).populate('assignedTo', 'name departmentId departmentName')
      .populate('companyId', 'companyName name');

    const now = new Date();
    
    // Calculate overlap with the selected week and month
    const weekStartMs = startOfWeek.getTime();
    const weekEndMs = endOfWeek.getTime();
    const monthStartMs = startOfMonth.getTime();
    const monthEndMs = endOfMonth.getTime();
    const nowMs = now.getTime();

    let activeTimersRunningTimeMin = 0; // for the Active Timers card (total running)
    let activeWeekHours = 0; // to add to kpi.totalHours

    const activeTasksData = activeTasks.map(t => {
      const startedAt = new Date(t.workStartedAt);
      const startedMs = startedAt.getTime();
      
      const totalElapsedMin = Math.max(0, (nowMs - startedMs) / 60000);
      activeTimersRunningTimeMin += totalElapsedMin;

      const overlapWeekStart = Math.max(startedMs, weekStartMs);
      const overlapWeekEnd = Math.min(nowMs, weekEndMs);
      const elapsedWeekMin = overlapWeekStart < overlapWeekEnd ? (overlapWeekEnd - overlapWeekStart) / 60000 : 0;
      const elapsedWeekHours = elapsedWeekMin / 60;
      activeWeekHours += elapsedWeekHours;

      const overlapMonthStart = Math.max(startedMs, monthStartMs);
      const overlapMonthEnd = Math.min(nowMs, monthEndMs);
      const elapsedMonthMin = overlapMonthStart < overlapMonthEnd ? (overlapMonthEnd - overlapMonthStart) / 60000 : 0;
      const elapsedMonthHours = elapsedMonthMin / 60;

      return {
        ...t.toObject(),
        employeeId: t.assignedTo?._id?.toString(),
        departmentId: t.assignedTo?.departmentId?.toString(),
        departmentName: t.assignedTo?.departmentName || t.department || '—',
        elapsedWeekHours,
        elapsedMonthHours,
        startedMs
      };
    });

    // Add active week hours to KPIs
    kpi.totalHours += activeWeekHours;
    kpi.billableHours += activeWeekHours; // assuming active timers are billable

    const activeTimersList = activeTasks.map(t => ({
      taskId: t._id,
      taskTitle: t.title,
      memberName: t.assignedTo?.name || 'Unknown',
      department: t.assignedTo?.departmentName || t.department || '—',
      startedAt: t.workStartedAt
    }));

    // ── Missing timesheets: employees who haven't logged today ───────────────
    let eligibleUsers = await getEligibleUsers(companyIdList);

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

      const visualTotal = daysArr.reduce((s, v) => s + v.total, 0);
      
      // Distribute active timer hours across the week days
      let finalTotal = visualTotal;
      const daysArrWithActive = [...daysArr];
      
      const empActiveTasks = activeTasksData.filter(t => t.employeeId === u._id.toString());
      empActiveTasks.forEach(t => {
        if (t.elapsedWeekHours > 0) {
          finalTotal += t.elapsedWeekHours;
          // Split elapsed time by day
          for (let isoDay = 1; isoDay <= 7; isoDay++) {
            const dayStartMs = weekStartMs + (isoDay - 1) * 86400000;
            const dayEndMs = dayStartMs + 86400000 - 1;
            const overlapDayStart = Math.max(t.startedMs, dayStartMs);
            const overlapDayEnd = Math.min(nowMs, dayEndMs);
            if (overlapDayStart < overlapDayEnd) {
              const dayElapsed = (overlapDayEnd - overlapDayStart) / 3600000;
              daysArrWithActive[isoDay - 1].total = parseFloat((daysArrWithActive[isoDay - 1].total + dayElapsed).toFixed(2));
              daysArrWithActive[isoDay - 1].entries.push({
                taskId: t._id,
                taskTitle: t.title || 'General Work',
                client: t.companyId?.companyName || t.companyId?.name || null,
                department: t.department || null,
                status: t.status,
                hours: parseFloat(dayElapsed.toFixed(2)),
                isBillable: true,
                isRunning: true,
                startedAt: new Date(overlapDayStart)
              });
            }
          }
        }
      });

      const deptName = u.departmentId ? (deptMap[u.departmentId.toString()] || u.departmentName || '—') : (u.departmentName || '—');

      return {
        name: u.name,
        role: u.role,
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
    const companyIdList = getCompanyIdList(req, tenantObjectId);

    const employees = await getEligibleUsers(companyIdList);

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
    const companyIdList = getCompanyIdList(req, tenantObjectId);

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
        $or: [{ tenantCompanyId: { $in: companyIdList } }, { companyId: { $in: companyIdList } }],
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
      { $match: { tenantCompanyId: { $in: companyIdList }, date: { $gte: startOfWeek, $lte: endOfWeek } } },
      { $group: { _id: '$employee', totalTimeSpentHours: { $sum: '$hours' } } }
    ]);

    // Fetch ALL active trackable users for this tenant
    let users = await getEligibleUsers(companyIdList);

    // Fetch departments for label mapping
    const departments = await getDepartments(companyIdList);
    const deptMap = {};
    departments.forEach(d => { deptMap[d._id.toString()] = d.name; });

    // Fetch active tasks to get their active time
    const activeTasks = await Task.find({
      $or: [{ tenantCompanyId: { $in: companyIdList } }, { companyId: { $in: companyIdList } }],
      workStartedAt: { $ne: null }
    }).populate('assignedTo', 'name departmentId departmentName');

    const now = new Date();
    const nowMs = now.getTime();
    const weekStartMs = startOfWeek.getTime();
    const weekEndMs = endOfWeek.getTime();

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
      const deptName = u.departmentId ? (deptMap[u.departmentId.toString()] || u.departmentName || '—') : (u.departmentName || '—');
      return {
        userId: u._id,
        name: u.name,
        role: u.role,
        department: deptName,
        tasksCompleted: tc ? tc.tasksCompleted : 0,
        totalTimeSpent: ts ? ts.totalTimeSpentHours : 0
      };
    });

    activeTasks.forEach(t => {
      const startedMs = new Date(t.workStartedAt).getTime();
      const overlapStart = Math.max(startedMs, weekStartMs);
      const overlapEnd = Math.min(nowMs, weekEndMs);
      
      if (overlapStart < overlapEnd) {
        const elapsedHours = (overlapEnd - overlapStart) / 3600000;
        const uId = t.assignedTo ? t.assignedTo._id.toString() : 'unassigned';
        const pData = performanceData.find(p => p.userId.toString() === uId);
        if (pData) {
          pData.totalTimeSpent += elapsedHours;
        }
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
