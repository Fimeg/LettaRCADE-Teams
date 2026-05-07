import { ensureCouncilTurn, loadCouncilSession, markOpinionSubmitted, markVote, saveCouncilSession, writeCouncilOpinion } from './store.js';
function asString(value) {
    return typeof value === 'string' ? value : '';
}
function asStringArray(value) {
    if (!Array.isArray(value))
        return undefined;
    return value.filter((item) => typeof item === 'string');
}
function parseSide(value) {
    if (value === 'thesis' || value === 'antithesis') {
        return value;
    }
    throw new Error('side must be thesis or antithesis');
}
function parseVote(value) {
    if (value === 'agree' || value === 'disagree') {
        return value;
    }
    throw new Error('vote must be agree or disagree');
}
export function createCouncilTools(context) {
    const councilWriteTool = {
        label: 'Council Write',
        name: 'council-write',
        description: 'Write your council opinion for this turn to the shared council directory.',
        parameters: {
            type: 'object',
            properties: {
                side: { type: 'string', enum: ['thesis', 'antithesis'] },
                position: { type: 'string' },
                evidence: { type: 'array', items: { type: 'string' } },
                proposal: { type: 'string' },
                risks: { type: 'array', items: { type: 'string' } },
                openQuestions: { type: 'array', items: { type: 'string' } },
            },
            required: ['side', 'position'],
            additionalProperties: false,
        },
        execute: async (_toolCallId, args) => {
            const input = (args || {});
            const meta = loadCouncilSession(context.sessionId);
            if (!meta) {
                throw new Error(`Council session '${context.sessionId}' not found`);
            }
            if (meta.currentTurn !== context.turn) {
                throw new Error(`Council turn mismatch: expected ${meta.currentTurn}, got ${context.turn}`);
            }
            const record = {
                sessionId: context.sessionId,
                turn: context.turn,
                agentName: context.agentName,
                side: parseSide(input.side),
                position: asString(input.position),
                evidence: asStringArray(input.evidence),
                proposal: asString(input.proposal) || undefined,
                risks: asStringArray(input.risks),
                openQuestions: asStringArray(input.openQuestions),
                createdAt: new Date().toISOString(),
            };
            if (!record.position.trim()) {
                throw new Error('position is required');
            }
            const filePath = writeCouncilOpinion(record);
            saveCouncilSession(meta);
            return {
                content: [{ type: 'text', text: `wrote opinion to ${filePath}` }],
                details: { path: filePath },
            };
        },
    };
    const councilSubmitTool = {
        label: 'Council Submit',
        name: 'council-submit',
        description: 'Submit council stage completion (opinion or vote).',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['opinion', 'vote'] },
                vote: { type: 'string', enum: ['agree', 'disagree'] },
                note: { type: 'string' },
            },
            required: ['action'],
            additionalProperties: false,
        },
        execute: async (_toolCallId, args) => {
            const input = (args || {});
            const meta = loadCouncilSession(context.sessionId);
            if (!meta) {
                throw new Error(`Council session '${context.sessionId}' not found`);
            }
            ensureCouncilTurn(meta, context.turn);
            if (input.action === 'opinion') {
                markOpinionSubmitted(meta, context.turn, context.agentName);
            }
            else if (input.action === 'vote') {
                markVote(meta, context.turn, context.agentName, parseVote(input.vote), asString(input.note) || undefined);
            }
            else {
                throw new Error('action must be opinion or vote');
            }
            saveCouncilSession(meta);
            return {
                content: [{ type: 'text', text: `submitted ${String(input.action)} for turn ${context.turn}` }],
            };
        },
    };
    return [councilWriteTool, councilSubmitTool];
}
