const INTERNAL_PREFIX = '[internal';
export function inferTaskKind(task) {
    if (task.kind) {
        return task.kind;
    }
    const normalized = task.message.trim().toLowerCase();
    if (normalized.startsWith(`${INTERNAL_PREFIX} init]`)) {
        return 'internal_init';
    }
    if (normalized.startsWith(`${INTERNAL_PREFIX} reinit]`)) {
        return 'internal_reinit';
    }
    return 'work';
}
export function isInternalTask(task) {
    const kind = inferTaskKind(task);
    return kind === 'internal_init' || kind === 'internal_reinit';
}
export function filterVisibleTasks(tasks, includeInternal = false) {
    if (includeInternal) {
        return tasks;
    }
    return tasks.filter((task) => !isInternalTask(task));
}
