import dayjs from "dayjs";

const d = (v) => (v == null || v === "" ? null : dayjs(v));
const ok = (x) => x && x.isValid();

const FINISHED_STATUSES = [
    "review",
    "in_review",
    "in review",
    "reviewing",
    "completed",
    "complete",
    "validated",
    "approved",
    "done",
    "sent_for_client_review",
    "rejected",
    "rejected_k",
];

export function isTaskFinished(status) {
    if (!status) return false;
    return FINISHED_STATUSES.includes(String(status).toLowerCase().trim());
}

/**
 * Mirrors server getTasksForKanban date branch for one calendar day.
 * Used so Kanban, Dashboard, and Calendar View stay consistent.
 * For finished/review tasks, matches solely on completion timestamp.
 * For active tasks, matches on workStartedAt, startDate, dueDate, or createdAt.
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
        // For completed / in-review / finished tasks, match strictly on completion time
        if (ok(workCompletedAt)) {
            const val = workCompletedAt.valueOf();
            return val >= s && val <= e;
        }
        if (ok(actualCompletionDate)) {
            const val = actualCompletionDate.valueOf();
            return val >= s && val <= e;
        }
        if (ok(validatedAt)) {
            const val = validatedAt.valueOf();
            return val >= s && val <= e;
        }
        if (ok(completedAt)) {
            const val = completedAt.valueOf();
            return val >= s && val <= e;
        }
        // Fallback for older tasks with no completion timestamp recorded
        if (ok(updatedAt) && updatedAt.valueOf() >= s && updatedAt.valueOf() <= e) {
            return true;
        }
        if (ok(dueDate) && dueDate.valueOf() >= s && dueDate.valueOf() <= e) {
            return true;
        }
        if (ok(startDate) && startDate.valueOf() >= s && startDate.valueOf() <= e) {
            return true;
        }
        return false;
    }

    // Active / unfinished tasks:
    if (ok(workStartedAt) && workStartedAt.valueOf() >= s && workStartedAt.valueOf() <= e) {
        return true;
    }

    // 1. Check startDate
    if (ok(startDate) && startDate.valueOf() >= s && startDate.valueOf() <= e) {
        return true;
    }

    // 2. Check dueDate
    if (ok(dueDate) && dueDate.valueOf() >= s && dueDate.valueOf() <= e) {
        return true;
    }

    // 3. Fallback to createdAt if no dates set
    const noDates = (!ok(startDate) || task.startDate === null) && (!ok(dueDate) || task.dueDate === null);
    if (noDates && ok(createdAt) && createdAt.valueOf() >= s && createdAt.valueOf() <= e) {
        return true;
    }

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
