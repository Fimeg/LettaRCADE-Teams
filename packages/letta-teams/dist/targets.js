const INVALID_NAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/;
const INVALID_FORK_CHARS = /[<>:"/\\|?*\x00-\x1f]/;
export function validateRootName(name) {
    if (!name || name.trim().length === 0) {
        throw new Error('Teammate name cannot be empty');
    }
    if (name.length > 64) {
        throw new Error('Teammate name must be 64 characters or less');
    }
    if (INVALID_NAME_CHARS.test(name)) {
        throw new Error('Teammate name contains invalid characters');
    }
}
export function validateForkName(name) {
    if (!name || name.trim().length === 0) {
        throw new Error('Fork name cannot be empty');
    }
    if (name.length > 64) {
        throw new Error('Fork name must be 64 characters or less');
    }
    if (INVALID_FORK_CHARS.test(name)) {
        throw new Error('Fork name contains invalid characters');
    }
}
export function formatTargetName(rootName, forkName) {
    return forkName ? `${rootName}/${forkName}` : rootName;
}
export function parseTargetName(input) {
    if (!input || input.trim().length === 0) {
        throw new Error('Target name cannot be empty');
    }
    const parts = input.split('/');
    if (parts.length > 2) {
        throw new Error(`Invalid target '${input}'. Nested forks are not supported.`);
    }
    const [rootName, forkName] = parts;
    validateRootName(rootName);
    if (!forkName) {
        return {
            fullName: rootName,
            rootName,
            isRoot: true,
        };
    }
    validateForkName(forkName);
    return {
        fullName: `${rootName}/${forkName}`,
        rootName,
        forkName,
        isRoot: false,
    };
}
export function validateTargetName(input) {
    parseTargetName(input);
}
export function getTargetKind(forkName) {
    if (!forkName)
        return 'root';
    return forkName === 'memory' ? 'memory' : 'custom';
}
