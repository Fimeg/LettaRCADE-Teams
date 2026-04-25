/**
 * ConnectionModeIndicator — toggles between Server mode (direct SDK to the
 * configured Letta server) and Local mode (spawn @letta-ai/letta-code as a
 * subprocess inside Electron, routed through the local Express proxy).
 *
 * The WebSocket-to-letta-code approach the old implementation used does not
 * work: letta-code does not listen on any port.
 */

import { useState, useEffect } from "react";
import { useLettaCodeSpawn } from "../hooks/useLettaCodeSpawn";
import { useAppStore } from "../store/useAppStore";

export type ConnectionMode = "server" | "local";

interface Props {
  mode: ConnectionMode;
  onModeChange: (mode: ConnectionMode) => void;
  /** Agent the spawn is associated with. Used to (a) substitute `{agentId}` in
   *  the operator's memfs URL template and (b) read any per-agent metadata
   *  override (`agent.metadata.letta_memfs_git_url`). */
  agentId?: string;
}

export default function ConnectionModeIndicator({ mode, onModeChange, agentId }: Props) {
  const { available, status, spawn, stop } = useLettaCodeSpawn();
  const agent = useAppStore((s) => (agentId ? s.agents[agentId] : null));
  const [spawnError, setSpawnError] = useState<string | null>(null);

  // Log status changes for debugging
  useEffect(() => {
    console.log("[ConnectionModeIndicator] status changed:", status);
  }, [status]);

  const localDisabled = !available;
  const spawnState = status.status;

  const statusDotClass = (() => {
    switch (spawnState) {
      case "running": return "bg-green-500";
      case "starting":
      case "stopping": return "bg-amber-500 animate-pulse";
      case "crashed": return "bg-red-500";
      default: return "bg-ink-300";
    }
  })();

  const handleSwitch = async (next: ConnectionMode) => {
    if (next === mode) return;
    if (next === "local" && localDisabled) return;
    onModeChange(next);
    if (next === "server" && spawnState === "running") {
      await stop();
    }
  };

  const handleSpawnToggle = async () => {
    setSpawnError(null);
    if (spawnState === "running" || spawnState === "starting") {
      await stop();
    } else {
      try {
        console.log("[ConnectionModeIndicator] Starting spawn...");
        // Pull per-agent metadata override from the loaded agent record. The
        // store's `agent.raw` carries the full SDK AgentState; `metadata` is
        // the freeform server-side field we use for per-agent env overrides.
        const raw = agent?.raw as { metadata?: Record<string, unknown> } | undefined;
        const md = raw?.metadata ?? {};
        const agentMetadataEnv = {
          letta_memfs_git_url: typeof md.letta_memfs_git_url === "string" ? md.letta_memfs_git_url : undefined,
          letta_memfs_local: typeof md.letta_memfs_local === "string" ? md.letta_memfs_local : undefined,
        };
        const result = await spawn({ agentId, agentMetadataEnv });
        console.log("[ConnectionModeIndicator] Spawn completed:", result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[ConnectionModeIndicator] spawn failed:", err);
        setSpawnError(msg);
      }
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex bg-surface-cream rounded-lg p-1 border border-ink-900/10">
        <button
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === "server"
              ? "bg-accent text-white shadow-sm"
              : "text-ink-600 hover:bg-ink-900/5"
          }`}
          onClick={() => handleSwitch("server")}
          title="Server mode: direct SDK calls to the configured Letta server"
        >
          Server
        </button>
        <button
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            mode === "local"
              ? "bg-accent text-white shadow-sm"
              : "text-ink-600 hover:bg-ink-900/5"
          }`}
          onClick={() => handleSwitch("local")}
          disabled={localDisabled}
          title={
            localDisabled
              ? "Local mode requires the desktop app"
              : "Local mode: spawn letta-code through the local proxy"
          }
        >
          Local
        </button>
      </div>

      {mode === "local" && (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusDotClass}`} title={spawnState} />
          <span className="text-xs text-ink-600 capitalize">{spawnState}</span>
          <button
            onClick={handleSpawnToggle}
            disabled={spawnState === "starting" || spawnState === "stopping"}
            className="text-xs px-2 py-1 rounded-md border border-ink-900/10 text-ink-700 hover:bg-ink-900/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {spawnState === "running" || spawnState === "starting" ? "Stop" : "Start"}
          </button>
          {(status.error || spawnError) && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-red-600 font-semibold">Error:</span>
              <span
                className="text-xs text-red-600 max-w-[400px] break-words font-mono bg-red-50 px-2 py-1 rounded border border-red-200"
                title={spawnError || status.error}
              >
                {spawnError || status.error}
              </span>
            </div>
          )}
        </div>
      )}
      {mode === "local" && localDisabled && (
        <span className="text-xs text-amber-600" title="Local mode requires the desktop build. Restart `npm run dev` after pulling these changes so preload is rebuilt.">
          desktop only — restart dev?
        </span>
      )}
    </div>
  );
}
