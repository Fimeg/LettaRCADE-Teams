var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import Letta from '@letta-ai/letta-client';
import { createAgent, createSession } from '@letta-ai/letta-code-sdk';
import { checkApiKey } from '../agent.js';
import { buildCouncilReviewerPrompt } from './prompts.js';
function buildCouncilReviewerMemoryBlocks() {
    return [
        {
            label: 'identity',
            description: 'Disposable council reviewer identity.',
            value: `You are a disposable council reviewer agent for letta-teams.
You are neutral and do not pick sides before analysis.
You are responsible for review quality and final reporting clarity.`,
        },
        {
            label: 'review-contract',
            description: 'How to review council opinions.',
            value: `Review all participant opinions deeply.
Compare tradeoffs, risks, evidence quality, and implementation realism.
Reject vague plans. Favor concrete plans with clear validation steps.
Only you decide whether the council should finalize now or continue.`,
        },
        {
            label: 'output-contract',
            description: 'Strict response format.',
            value: `Return ONLY a single JSON object with fields:
- decision: "continue" | "finalize"
- summary: string (dense synthesis)
- final_plan_markdown: string (required when decision=finalize)
- confidence: number 0..100
- next_focus: string[]

No extra prose before or after JSON.`,
        },
    ];
}
function parseReviewerJson(raw) {
    const trimmed = raw.trim();
    const jsonBlockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
    const candidate = jsonBlockMatch?.[1]?.trim() || trimmed;
    let parsed;
    try {
        parsed = JSON.parse(candidate);
    }
    catch {
        throw new Error('Reviewer agent returned invalid JSON');
    }
    const decision = parsed.decision;
    if (decision !== 'continue' && decision !== 'finalize') {
        throw new Error('Reviewer decision must be continue or finalize');
    }
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    if (!summary) {
        throw new Error('Reviewer summary is required');
    }
    const finalPlanMarkdown = typeof parsed.final_plan_markdown === 'string' && parsed.final_plan_markdown.trim().length > 0
        ? parsed.final_plan_markdown
        : undefined;
    if (decision === 'finalize' && !finalPlanMarkdown) {
        throw new Error('Reviewer must provide final_plan_markdown when decision=finalize');
    }
    const confidence = typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(100, parsed.confidence))
        : undefined;
    const nextFocus = Array.isArray(parsed.next_focus)
        ? parsed.next_focus.filter((v) => typeof v === 'string' && v.trim().length > 0)
        : undefined;
    return {
        decision,
        summary,
        finalPlanMarkdown,
        confidence,
        nextFocus,
    };
}
async function deleteAgentFromServer(agentId) {
    try {
        const client = new Letta({ apiKey: process.env.LETTA_API_KEY });
        await client.agents.delete(agentId);
    }
    catch {
        // best effort cleanup for disposable reviewer
    }
}
export async function runDisposableCouncilReviewer(input) {
    checkApiKey();
    let reviewerAgentId;
    try {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            reviewerAgentId = await createAgent({
                model: process.env.LETTA_MODEL || 'letta/auto',
                tags: ['origin:letta-teams', 'kind:council-reviewer', `session:${input.sessionId}`],
                memory: buildCouncilReviewerMemoryBlocks(),
                memfs: false,
            });
            const session = __addDisposableResource(env_1, createSession(reviewerAgentId, {
                permissionMode: 'bypassPermissions',
                disallowedTools: ['AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode'],
                memfs: false,
            }), true);
            await session.send(buildCouncilReviewerPrompt({
                sessionId: input.sessionId,
                turn: input.turn,
                prompt: input.councilPrompt,
                opinions: input.opinions,
                previousSynthesis: input.previousSynthesis,
                customMessage: input.customMessage,
            }));
            let accumulated = '';
            for await (const msg of session.stream()) {
                if (msg.type === 'assistant' && typeof msg.content === 'string') {
                    accumulated += msg.content;
                }
                if (msg.type === 'error') {
                    throw new Error(msg.message);
                }
                if (msg.type === 'result') {
                    const raw = msg.result || accumulated;
                    return parseReviewerJson(raw);
                }
            }
            return parseReviewerJson(accumulated);
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            const result_1 = __disposeResources(env_1);
            if (result_1)
                await result_1;
        }
    }
    finally {
        if (reviewerAgentId) {
            await deleteAgentFromServer(reviewerAgentId);
        }
    }
}
