export const COMPLETED_TASK_STATUSES = [
  "review",
  "in_review",
  "in review",
  "reviewing",
  "done",
  "completed",
  "validated",
  "complete",
];

export const CORRECTION_CATEGORIES = [
  "Correction",
  "Internal Correction",
  "Client Correction",
  "Hosting",
];
export const REDESIGN_CATEGORIES = ["Redesign"];

export const isCompletedTask = (status) =>
  COMPLETED_TASK_STATUSES.includes(status);

export const isDurationTrackingTask = (task) => !!task?.department;

export const isCorrectionTask = (task) =>
  CORRECTION_CATEGORIES.includes(task?.taskCategory);

export const isRedesignTask = (task) =>
  REDESIGN_CATEGORIES.includes(task?.taskCategory);

export const formatMinutesAsDuration = (minutes) => {
  if (minutes == null || Number.isNaN(Number(minutes))) return null;

  const totalMinutes = Math.max(0, Math.round(Number(minutes)));
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${remainingMinutes}m`;
};

export const getTaskDueDeadline = (dueDate) => {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return null;
  const endOfDay = new Date(d);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
};

export const isTaskTimerRunning = (task) => {
  if (!task || task.status !== "in_progress" || !task.workStartedAt) {
    return false;
  }
  if (task.dueDate) {
    const deadline = getTaskDueDeadline(task.dueDate);
    if (deadline && Date.now() > deadline.getTime()) {
      return false;
    }
  }
  return true;
};

export const getTaskLiveDurationMinutes = (task) => {
  if (!task) return 0;
  const accumulated = Number(task.workDurationMinutes) || 0;
  if (task.status === "in_progress" && task.workStartedAt) {
    let endTime = Date.now();
    if (task.dueDate) {
      const deadline = getTaskDueDeadline(task.dueDate);
      if (deadline && endTime > deadline.getTime()) {
        endTime = deadline.getTime();
      }
    }
    const startTime = new Date(task.workStartedAt).getTime();
    const elapsedMs = Math.max(0, endTime - startTime);
    const elapsedMins = Math.max(0, Math.round(elapsedMs / 60000));
    return accumulated + elapsedMins;
  }
  return accumulated;
};

export const getTaskDurationLabel = (task) => {
  if (!isDurationTrackingTask(task)) return null;
  const liveMins = getTaskLiveDurationMinutes(task);
  return formatMinutesAsDuration(liveMins);
};
