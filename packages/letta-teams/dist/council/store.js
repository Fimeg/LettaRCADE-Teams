import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureLteamsDir, getLteamsDir } from '../store.js';
function atomicWriteJson(filePath, payload) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
    fs.renameSync(tmpPath, filePath);
}
function atomicWriteText(filePath, content) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, content);
    fs.renameSync(tmpPath, filePath);
}
export function getCouncilsDir() {
    return path.join(getLteamsDir(), 'councils');
}
export function getCouncilSessionDir(sessionId) {
    return path.join(getCouncilsDir(), sessionId);
}
export function getCouncilMetaPath(sessionId) {
    return path.join(getCouncilSessionDir(sessionId), 'meta.json');
}
export function getCouncilTurnDir(sessionId, turn) {
    return path.join(getCouncilSessionDir(sessionId), `turn-${turn}`);
}
export function getCouncilOpinionPath(sessionId, turn, agentName) {
    return path.join(getCouncilTurnDir(sessionId, turn), `${agentName}.json`);
}
export function getCouncilSynthesisPath(sessionId, turn) {
    return path.join(getCouncilSessionDir(sessionId), 'synthesis', `turn-${turn}.md`);
}
export function getCouncilPlansDir() {
    return path.join(getLteamsDir(), 'plans');
}
export function getCouncilFinalPlanPath(sessionId) {
    return path.join(getCouncilPlansDir(), `${sessionId}.md`);
}
export function initCouncilSession(input) {
    ensureLteamsDir();
    fs.mkdirSync(getCouncilSessionDir(input.sessionId), { recursive: true });
    fs.mkdirSync(path.join(getCouncilSessionDir(input.sessionId), 'synthesis'), { recursive: true });
    const now = new Date().toISOString();
    const firstTurn = {
        turn: 1,
        startedAt: now,
        opinionSubmittedBy: [],
        votesBy: {},
        notesBy: {},
    };
    const meta = {
        sessionId: input.sessionId,
        prompt: input.prompt,
        message: input.message,
        createdAt: now,
        updatedAt: now,
        status: 'running',
        participants: input.participants,
        leadName: input.leadName,
        currentTurn: 1,
        maxTurns: input.maxTurns ?? 5,
        turns: { '1': firstTurn },
    };
    atomicWriteJson(getCouncilMetaPath(input.sessionId), meta);
    return meta;
}
export function loadCouncilSession(sessionId) {
    const filePath = getCouncilMetaPath(sessionId);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    catch {
        return null;
    }
}
export function saveCouncilSession(meta) {
    meta.updatedAt = new Date().toISOString();
    atomicWriteJson(getCouncilMetaPath(meta.sessionId), meta);
}
export function ensureCouncilTurn(meta, turn) {
    const key = String(turn);
    if (!meta.turns[key]) {
        meta.turns[key] = {
            turn,
            startedAt: new Date().toISOString(),
            opinionSubmittedBy: [],
            votesBy: {},
            notesBy: {},
        };
    }
    return meta.turns[key];
}
export function writeCouncilOpinion(record) {
    const filePath = getCouncilOpinionPath(record.sessionId, record.turn, record.agentName);
    atomicWriteJson(filePath, record);
    return filePath;
}
export function listCouncilOpinions(sessionId, turn) {
    const dir = getCouncilTurnDir(sessionId, turn);
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs.readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
        try {
            return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'));
        }
        catch {
            return null;
        }
    })
        .filter((v) => v !== null);
}
export function writeCouncilSynthesis(sessionId, turn, content) {
    const filePath = getCouncilSynthesisPath(sessionId, turn);
    atomicWriteText(filePath, content);
    return filePath;
}
export function readCouncilSynthesis(sessionId, turn) {
    const filePath = getCouncilSynthesisPath(sessionId, turn);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
}
export function writeCouncilFinalPlan(sessionId, content) {
    const filePath = getCouncilFinalPlanPath(sessionId);
    atomicWriteText(filePath, content);
    return filePath;
}
export function readCouncilFinalPlan(sessionId) {
    const filePath = getCouncilFinalPlanPath(sessionId);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
}
export function listCouncilSessions() {
    const dir = getCouncilsDir();
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs.readdirSync(dir)
        .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
        .sort((a, b) => b.localeCompare(a));
}
export function markOpinionSubmitted(meta, turn, agentName) {
    const state = ensureCouncilTurn(meta, turn);
    if (!state.opinionSubmittedBy.includes(agentName)) {
        state.opinionSubmittedBy.push(agentName);
    }
}
export function markVote(meta, turn, agentName, vote, note) {
    const state = ensureCouncilTurn(meta, turn);
    state.votesBy[agentName] = vote;
    if (note) {
        state.notesBy[agentName] = note;
    }
}
