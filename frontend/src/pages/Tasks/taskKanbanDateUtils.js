import dayjs from "dayjs";

const d = (v) => (v == null || v === "" ? null : dayjs(v));
const ok = (x) => x && x.isValid();

/**
 * Mirrors server getTasksForKanban date branch (Options A–D) for one calendar day.
 * Used so Calendar View stays consistent with Kanban’s due-date filter.
 */
export function taskMatchesKanbanDay(task, day) {
    const start = day.startOf("day");
    const end = day.endOf("day");
    const s = start.valueOf();
    const e = end.valueOf();

    const startDate = d(task.startDate);
    const dueDate = d(task.dueDate);
    const createdAt = d(task.createdAt);
    const actualCompletionDate = d(task.actualCompletionDate);
    const validatedAt = d(task.validatedAt);

    const hasStart =
        ok(startDate) && task.startDate !== null && task.startDate !== undefined;

    const completionGuard = () => {
        return !ok(actualCompletionDate);
    };

    if (hasStart && ok(dueDate)) {
        const optionA =
            startDate.valueOf() <= e && dueDate.valueOf() >= s && completionGuard();
        if (optionA) return true;
    }

    const noStart =
        !hasStart || task.startDate === null || task.startDate === undefined;

    if (noStart && ok(createdAt) && ok(dueDate)) {
        const optionB =
            createdAt.valueOf() <= e && dueDate.valueOf() >= s && completionGuard();
        if (optionB) return true;
    }

    if (ok(actualCompletionDate)) {
        const ac = actualCompletionDate.valueOf();
        if (ac >= s && ac <= e) return true;
    }

    if (ok(validatedAt)) {
        const va = validatedAt.valueOf();
        if (va >= s && va <= e) return true;
    }

    return false;
}

/** Scheduled / in-window for that day (Options A & B only — excludes completion-only). */
export function taskScheduledForKanbanDay(task, day) {
    const start = day.startOf("day");
    const end = day.endOf("day");
    const s = start.valueOf();
    const e = end.valueOf();

    const startDate = d(task.startDate);
    const dueDate = d(task.dueDate);
    const createdAt = d(task.createdAt);
    const actualCompletionDate = d(task.actualCompletionDate);

    const hasStart =
        ok(startDate) && task.startDate !== null && task.startDate !== undefined;

    const completionGuard = () => {
        return !ok(actualCompletionDate);
    };

    if (hasStart && ok(dueDate)) {
        if (
            startDate.valueOf() <= e &&
            dueDate.valueOf() >= s &&
            completionGuard()
        ) {
            return true;
        }
    }

    const noStart =
        !hasStart || task.startDate === null || task.startDate === undefined;

    if (noStart && ok(createdAt) && ok(dueDate)) {
        return (
            createdAt.valueOf() <= e && dueDate.valueOf() >= s && completionGuard()
        );
    }

    return false;
}

export function taskCompletedOnDay(task, day) {
    const terminal = ["completed", "complete", "validated", "done", "review"];
    const taskStatus = (task?.status || "").toLowerCase();
    if (!terminal.includes(taskStatus)) return false;

    const s = day.startOf("day").valueOf();
    const e = day.endOf("day").valueOf();

    const actualCompletionDate = d(task.actualCompletionDate);
    const validatedAt = d(task.validatedAt);
    const updatedAt = d(task.updatedAt);
    const dueDate = d(task.dueDate);

    if (ok(actualCompletionDate)) {
        const ac = actualCompletionDate.valueOf();
        if (ac >= s && ac <= e) return true;
    }
    if (ok(validatedAt)) {
        const va = validatedAt.valueOf();
        if (va >= s && va <= e) return true;
    }
    if (ok(updatedAt)) {
        const u = updatedAt.valueOf();
        if (u >= s && u <= e) return true;
    }
    if (ok(dueDate)) {
        const dd = dueDate.valueOf();
        if (dd >= s && dd <= e) return true;
    }
    return taskMatchesKanbanDay(task, day);
}
