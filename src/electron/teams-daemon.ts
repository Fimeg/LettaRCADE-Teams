import { startDaemon } from "letta-teams-sdk/daemon";

const rawPort = process.env.LETTA_TEAMS_DAEMON_PORT?.trim();
const port = rawPort ? Number(rawPort) : undefined;

startDaemon(Number.isFinite(port) ? port : undefined).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[teams-daemon] Failed to start daemon: ${message}`);
  process.exit(1);
});
