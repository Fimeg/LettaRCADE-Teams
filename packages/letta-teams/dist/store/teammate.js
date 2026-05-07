/**
 * Teammate storage - CRUD operations for teammate state files
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { formatTargetName, getTargetKind, parseTargetName } from "../targets.js";
const LTEAMS_DIR = ".lteams";
/**
 * Override project directory (used by daemon to find teammate files)
 * When set, .lteams directory is relative to this instead of process.cwd()
 */
let projectDirOverride = null;
/**
 * Set the project directory override (used by daemon)
 */
export function setProjectDir(dir) {
    projectDirOverride = dir;
}
/**
 * Get the current project directory
 */
export function getProjectDir() {
    return projectDirOverride || process.cwd();
}
/**
 * Get the .lteams directory path
 * Uses projectDirOverride if set, otherwise falls back to cwd
 */
export function getLteamsDir() {
    return path.join(getProjectDir(), LTEAMS_DIR);
}
/**
 * Ensure .lteams directory exists
 */
export function ensureLteamsDir() {
    const dir = getLteamsDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
/**
 * Get the path to a teammate's JSON file
 */
export function getTeammatePath(name) {
    return path.join(getLteamsDir(), `${name}.json`);
}
/**
 * Check if a teammate exists
 */
export function teammateExists(name) {
    return fs.existsSync(getTeammatePath(name));
}
function migrateTeammateState(name, state) {
    // Ensure name matches filename
    if (state.name !== name) {
        return { ...state, name };
    }
    return state;
}
/**
 * Load a teammate's state
 * Returns null if the file doesn't exist or is corrupted
 * Ensures the name field matches the filename (defensive against corrupted JSON)
 */
export function loadTeammate(name) {
    const filePath = getTeammatePath(name);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        const state = JSON.parse(content);
        return migrateTeammateState(name, state);
    }
    catch {
        // Return null if JSON is corrupted
        return null;
    }
}
/**
 * Save a teammate's state
 */
export function saveTeammate(state) {
    ensureLteamsDir();
    const filePath = getTeammatePath(state.name);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}
export function getRootConversationId(state) {
    return state.targets?.find((t) => t.kind === 'root')?.conversationId;
}
export function getConversationTarget(rootName, targetName) {
    const teammate = loadTeammate(rootName);
    if (!teammate)
        return null;
    const parsed = parseTargetName(targetName);
    if (parsed.rootName !== rootName) {
        return null;
    }
    return teammate.targets?.find((target) => target.name === parsed.fullName) || null;
}
export function listConversationTargets(rootName) {
    return loadTeammate(rootName)?.targets || [];
}
/**
 * Get the memory target for a teammate (if any)
 */
export function getMemoryTarget(rootName) {
    const teammate = loadTeammate(rootName);
    return teammate?.targets?.find((t) => t.kind === 'memory');
}
/**
 * Get the memory conversation ID for a teammate
 */
export function getMemoryConversationId(rootName) {
    return getMemoryTarget(rootName)?.conversationId;
}
export function targetExists(targetName) {
    const parsed = parseTargetName(targetName);
    if (parsed.isRoot) {
        return teammateExists(parsed.rootName);
    }
    return getConversationTarget(parsed.rootName, parsed.fullName) !== null;
}
export function createConversationTarget(rootName, target) {
    const state = loadTeammate(rootName);
    if (!state)
        return null;
    const name = formatTargetName(rootName, target.forkName);
    if (state.targets?.some((existing) => existing.name === name)) {
        throw new Error(`Target '${name}' already exists`);
    }
    const created = {
        name,
        rootName,
        forkName: target.forkName,
        kind: target.kind ?? getTargetKind(target.forkName),
        conversationId: target.conversationId,
        parentTargetName: target.parentTargetName,
        parentConversationId: target.parentConversationId,
        createdAt: target.createdAt,
        lastActiveAt: target.lastActiveAt,
        status: target.status,
    };
    const updated = {
        ...state,
        targets: [...(state.targets || []), created],
    };
    saveTeammate(updated);
    return created;
}
export function updateConversationTarget(rootName, targetName, updates) {
    const state = loadTeammate(rootName);
    if (!state || !state.targets)
        return null;
    const index = state.targets.findIndex((target) => target.name === targetName);
    if (index === -1)
        return null;
    const nextTargets = [...state.targets];
    nextTargets[index] = {
        ...nextTargets[index],
        ...updates,
    };
    saveTeammate({
        ...state,
        targets: nextTargets,
    });
    return nextTargets[index];
}
/**
 * Update specific fields of a teammate
 */
export function updateTeammate(name, updates) {
    const state = loadTeammate(name);
    if (!state)
        return null;
    const updated = {
        ...state,
        ...updates,
        lastUpdated: new Date().toISOString(),
    };
    saveTeammate(updated);
    return updated;
}
/**
 * Remove a teammate's JSON file
 */
export function removeTeammate(name) {
    const filePath = getTeammatePath(name);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    return false;
}
/**
 * List all teammates
 * Logs warnings for corrupted JSON files
 */
export function listTeammates() {
    const dir = getLteamsDir();
    if (!fs.existsSync(dir)) {
        return [];
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    return files
        .map((file) => {
        const name = file.replace(".json", "");
        const state = loadTeammate(name);
        if (state === null) {
            console.warn(`Warning: Could not load teammate '${name}' - file may be corrupted. Path: ${getTeammatePath(name)}`);
        }
        return state;
    })
        .filter((t) => t !== null);
}
