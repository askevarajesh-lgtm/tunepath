import dayjs from "dayjs";

const d = (v) => (v == null || v === "" ? null : dayjs(v));
const ok = (x) => x && x.isValid();

const FINISHED_STATUSES = [
    "completed",
    "complete",
    "validated",
    "approved",
    "done",
];

export function isTaskFinished(status) {
    if (!status) return false;
    return FINISHED_STATUSES.includes(String(status).toLowerCase().trim());
}

/**
 * Mirrors server getTasksForKanban date branch for one calendar day.
 * Used so Kanban, Dashboard, and Calendar View stay consistent.
 * For finished tasks, matches on completion timestamp or scheduled due/start date.
 * For active tasks (To Do, In Progress, Review, Hold), matches on dueDate, startDate, workStartedAt, or createdAt.
 */
export function taskMatchesKanbanDay(task, day) {
    if (!task || !day) return false;
    const start = day.startOf("day");
    const end = day.endOf("day");
    const s = start.valueOf();
    const e = end.valueOf();

    const isFinished = isTaskFinished(task.status);

    const workCompletedAt = d(task.workCompletedAt);
    const actualCompletionDate = d(task.actualCompletionDate);
    const validatedAt = d(task.validatedAt);
    const completedAt = d(task.completedAt);
    const workStartedAt = d(task.workStartedAt);
    const startDate = d(task.startDate);
    const dueDate = d(task.dueDate);
    const createdAt = d(task.createdAt);
    const updatedAt = d(task.updatedAt);

    if (isFinished) {
        if (ok(workCompletedAt) && workCompletedAt.valueOf() >= s && workCompletedAt.valueOf() <= e) return true;
        if (ok(actualCompletionDate) && actualCompletionDate.valueOf() >= s && actualCompletionDate.valueOf() <= e) return true;
        if (ok(validatedAt) && validatedAt.valueOf() >= s && validatedAt.valueOf() <= e) return true;
        if (ok(completedAt) && completedAt.valueOf() >= s && completedAt.valueOf() <= e) return true;
        if (ok(dueDate) && dueDate.valueOf() >= s && dueDate.valueOf() <= e) return true;
        if (ok(startDate) && startDate.valueOf() >= s && startDate.valueOf() <= e) return true;
        if (ok(updatedAt) && updatedAt.valueOf() >= s && updatedAt.valueOf() <= e) return true;
        return false;
    }

    // Active / unfinished tasks (To Do, In Progress, Review, Hold, etc.):
    if (ok(dueDate) && dueDate.valueOf() >= s && dueDate.valueOf() <= e) return true;
    if (ok(startDate) && startDate.valueOf() >= s && startDate.valueOf() <= e) return true;
    if (ok(workStartedAt) && workStartedAt.valueOf() >= s && workStartedAt.valueOf() <= e) return true;

    const noDates = (!ok(startDate) || task.startDate === null) && (!ok(dueDate) || task.dueDate === null);
    if (noDates && ok(createdAt) && createdAt.valueOf() >= s && createdAt.valueOf() <= e) return true;

    return false;
}

/** Scheduled / in-window for that day (Options A & B only — excludes completion-only). */
export function taskScheduledForKanbanDay(task, day) {
    if (!task || !day) return false;
    const start = day.startOf("day");
    const end = day.endOf("day");
    const s = start.valueOf();
    const e = end.valueOf();

    const startDate = d(task.startDate);
    const dueDate = d(task.dueDate);
    const createdAt = d(task.createdAt);

    if (ok(startDate) && startDate.valueOf() >= s && startDate.valueOf() <= e) {
        return true;
    }

    if (ok(dueDate) && dueDate.valueOf() >= s && dueDate.valueOf() <= e) {
        return true;
    }

    const noDates = (!ok(startDate) || task.startDate === null) && (!ok(dueDate) || task.dueDate === null);
    if (noDates && ok(createdAt)) {
        return createdAt.valueOf() >= s && createdAt.valueOf() <= e;
    }

    return false;
}

export function taskCompletedOnDay(task, day) {
    if (!task || !day) return false;
    if (!isTaskFinished(task.status)) return false;

    const s = day.startOf("day").valueOf();
    const e = day.endOf("day").valueOf();

    const workCompletedAt = d(task.workCompletedAt);
    const actualCompletionDate = d(task.actualCompletionDate);
    const validatedAt = d(task.validatedAt);
    const completedAt = d(task.completedAt);
    const updatedAt = d(task.updatedAt);
    const dueDate = d(task.dueDate);

    if (ok(workCompletedAt)) {
        const wc = workCompletedAt.valueOf();
        return wc >= s && wc <= e;
    }
    if (ok(actualCompletionDate)) {
        const ac = actualCompletionDate.valueOf();
        return ac >= s && ac <= e;
    }
    if (ok(validatedAt)) {
        const va = validatedAt.valueOf();
        return va >= s && va <= e;
    }
    if (ok(completedAt)) {
        const ca = completedAt.valueOf();
        return ca >= s && ca <= e;
    }
    if (ok(updatedAt)) {
        const u = updatedAt.valueOf();
        return u >= s && u <= e;
    }
    if (ok(dueDate)) {
        const dd = dueDate.valueOf();
        return dd >= s && dd <= e;
    }
    return false;
}
