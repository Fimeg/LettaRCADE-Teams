/**
 * Valid memfs startup values for validation
 */
export const MEMFS_STARTUP_VALUES = ["blocking", "background", "skip"];
/**
 * Parse and validate memfs-startup option
 * @param value - The raw string value from CLI options
 * @returns Validated MemfsStartup value, or undefined if not provided
 * @throws Error if value is invalid
 */
export function parseMemfsStartup(value) {
    if (value === undefined) {
        return undefined;
    }
    if (!MEMFS_STARTUP_VALUES.includes(value)) {
        throw new Error(`Invalid memfs-startup mode '${value}'. Must be one of: ${MEMFS_STARTUP_VALUES.join(", ")}`);
    }
    return value;
}
