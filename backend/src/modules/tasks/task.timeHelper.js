const mongoose = require('mongoose');
const TimeEntry = require('../timeTracking/timeTracking.model');
const User = require('../auth/user.model');

exports.calculateSessionElapsedMinutes = (workStartedAt, dueDate = null, now = new Date()) => {
  if (!workStartedAt) return 0;
  let stopTime = now;
  if (dueDate) {
    const dueEnd = new Date(dueDate);
    if (!isNaN(dueEnd.getTime())) {
      dueEnd.setHours(23, 59, 59, 999);
      if (now > dueEnd) {
        stopTime = dueEnd;
      }
    }
  }
  const diffMs = Math.max(0, stopTime - new Date(workStartedAt));
  return Math.max(0, Math.round(diffMs / 60000));
};

exports.recordTimerStop = async (task, diffMinutes, userId) => {
  if (!diffMinutes || diffMinutes <= 0) return;
  const diffHours = diffMinutes / 60;
  
  try {
    const employeeId = task.assignedTo || userId;
    const employee = await User.findById(employeeId).select('agencyId brandId companyId departmentId departmentName');
    const tenantCompanyId = (employee && (employee.brandId || employee.agencyId || employee.companyId)) || task.tenantCompanyId || task.companyId;

    let moduleName = task.department || 'General';
    let deptId = employee ? employee.departmentId : undefined;

    if (task.department && mongoose.Types.ObjectId.isValid(task.department)) {
      const Department = require('../departments/department.model');
      const deptDoc = await Department.findById(task.department).select('name slug');
      if (deptDoc) {
        moduleName = deptDoc.slug || deptDoc.name;
        if (!deptId) deptId = deptDoc._id;
      }
    }

    const timeEntry = new TimeEntry({
      employee: employeeId,
      client: task.companyId,
      task: task._id,
      department: deptId,
      date: new Date(),
      hours: diffHours,
      isBillable: true,
      moduleName: moduleName,
      description: task.title,
      tenantCompanyId: tenantCompanyId,
      source: 'timer',
      createdBy: userId
    });
    
    await timeEntry.save();
    task.timeSpent = (task.timeSpent || 0) + diffHours;
  } catch (error) {
    console.error('Error recording timer stop in TimeEntry:', error);
  }
};
