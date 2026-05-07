import { ensureDaemonRunning, startCouncilViaDaemon } from '../ipc.js';
import { handleCliError } from '../utils/errors.js';
import { listCouncilSessions, loadCouncilSession, readCouncilFinalPlan } from '../council/store.js';
function resolveSessionId(explicit) {
    if (explicit)
        return explicit;
    const sessions = listCouncilSessions();
    return sessions[0] || null;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function getCouncilStatusPayload(sessionId) {
    const meta = loadCouncilSession(sessionId);
    if (!meta) {
        throw new Error(`Council session '${sessionId}' not found`);
    }
    return {
        sessionId: meta.sessionId,
        status: meta.status,
        currentTurn: meta.currentTurn,
        maxTurns: meta.maxTurns,
        participants: meta.participants,
        leadName: meta.leadName ?? null,
        updatedAt: meta.updatedAt,
        planReady: Boolean(meta.finalPlanPath),
        finalPlanPath: meta.finalPlanPath ?? null,
        error: meta.error ?? null,
    };
}
export function registerCouncilCommands(program) {
    program
        .command('agent-council')
        .description('Start a council session across teammates')
        .requiredOption('--prompt <prompt>', 'Council prompt')
        .option('--message <message>', 'Custom message describing council behavior')
        .option('--participants <names>', 'Comma-separated participant names')
        .option('--max-turns <n>', 'Maximum number of turns (default: 5)', '5')
        .action(async (options) => {
        const globalOpts = program.opts();
        try {
            await ensureDaemonRunning();
            const participants = typeof options.participants === 'string' && options.participants.trim().length > 0
                ? options.participants.split(',').map((s) => s.trim()).filter(Boolean)
                : undefined;
            const maxTurns = Number.parseInt(options.maxTurns, 10);
            const result = await startCouncilViaDaemon(options.prompt, {
                message: options.message,
                participantNames: participants,
                maxTurns: Number.isFinite(maxTurns) && maxTurns > 0 ? maxTurns : 5,
            });
            if (globalOpts.json) {
                console.log(JSON.stringify(result, null, 2));
            }
            else {
                console.log(`✓ Council started: ${result.sessionId}`);
                console.log(`  Read:  letta-teams council read ${result.sessionId}`);
                console.log(`  Watch: letta-teams council --watch ${result.sessionId}`);
            }
        }
        catch (error) {
            handleCliError(error, globalOpts.json);
        }
    });
    const council = program
        .command('council')
        .description('Read/watch council decisions');
    council
        .command('status [sessionId]')
        .description('Show council session status and progress')
        .action((sessionId) => {
        const globalOpts = program.opts();
        try {
            const resolved = resolveSessionId(sessionId);
            if (!resolved) {
                throw new Error('No council sessions found');
            }
            const payload = getCouncilStatusPayload(resolved);
            if (globalOpts.json) {
                console.log(JSON.stringify(payload, null, 2));
                return;
            }
            console.log(`Council: ${payload.sessionId}`);
            console.log(`Status: ${payload.status}`);
            console.log(`Turn: ${payload.currentTurn}/${payload.maxTurns}`);
            console.log(`Participants: ${payload.participants.join(', ') || '-'}`);
            console.log(`Lead: ${payload.leadName ?? '-'}`);
            console.log(`Updated: ${new Date(payload.updatedAt).toLocaleString()}`);
            console.log(`Final plan: ${payload.planReady ? (payload.finalPlanPath ?? 'ready') : 'not ready'}`);
            if (payload.error) {
                const firstLine = payload.error.split('\n')[0];
                const hasMore = payload.error.includes('\n');
                console.log(`Error: ${firstLine}${hasMore ? ' (truncated)' : ''}`);
            }
        }
        catch (error) {
            handleCliError(error, globalOpts.json);
        }
    });
    council
        .command('read [sessionId]')
        .description('Read final council decision')
        .action((sessionId) => {
        const globalOpts = program.opts();
        try {
            const resolved = resolveSessionId(sessionId);
            if (!resolved) {
                throw new Error('No council sessions found');
            }
            const finalPlan = readCouncilFinalPlan(resolved);
            if (!finalPlan) {
                if (globalOpts.json) {
                    console.log(JSON.stringify({ sessionId: resolved, status: 'pending', message: 'please use --watch to follow' }, null, 2));
                }
                else {
                    console.log('please use --watch to follow');
                }
                return;
            }
            if (globalOpts.json) {
                console.log(JSON.stringify({ sessionId: resolved, plan: finalPlan }, null, 2));
            }
            else {
                console.log(finalPlan);
            }
        }
        catch (error) {
            handleCliError(error, globalOpts.json);
        }
    });
    council
        .option('--watch', 'Wait for final decision and print it')
        .argument('[sessionId]')
        .action(async (sessionId, options) => {
        const globalOpts = program.opts();
        const watch = options.watch === true;
        if (!watch) {
            if (!globalOpts.json) {
                console.log('Usage: letta-teams council --watch [sessionId]');
            }
            return;
        }
        try {
            const resolved = resolveSessionId(sessionId);
            if (!resolved) {
                throw new Error('No council sessions found');
            }
            while (true) {
                const finalPlan = readCouncilFinalPlan(resolved);
                if (finalPlan) {
                    if (globalOpts.json) {
                        console.log(JSON.stringify({ sessionId: resolved, plan: finalPlan }, null, 2));
                    }
                    else {
                        console.log(finalPlan);
                    }
                    return;
                }
                const meta = loadCouncilSession(resolved);
                if (meta?.status === 'error') {
                    throw new Error(meta.error || `Council ${resolved} failed`);
                }
                await sleep(1000);
            }
        }
        catch (error) {
            handleCliError(error, globalOpts.json);
        }
    });
}
