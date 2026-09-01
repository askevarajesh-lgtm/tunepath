const TimeEntry = require('../timeTracking/timeTracking.model');
const User = require('../auth/user.model');

exports.recordTimerStop = async (task, diffMinutes, userId) => {
  if (!diffMinutes || diffMinutes <= 0) return;
  const diffHours = diffMinutes / 60;
  
  try {
    const employeeId = task.assignedTo || userId;
    const employee = await User.findById(employeeId).select('agencyId');
    const tenantCompanyId = employee ? employee.agencyId : (task.tenantCompanyId || task.companyId);

    const timeEntry = new TimeEntry({
      employee: employeeId,
      client: task.companyId,
      task: task._id,
      date: new Date(),
      hours: diffHours,
      isBillable: true,
      moduleName: task.department || 'General',
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
