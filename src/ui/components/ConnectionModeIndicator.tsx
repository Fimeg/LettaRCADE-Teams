/**
 * ConnectionModeIndicator — toggles between three connection modes:
 * - Server: Direct HTTP SDK calls to the external Letta server
 * - Local: Spawn letta-code CLI locally (if not running), connect to localhost:8283
 * - Remote: Connect to user-provided remote Letta server URL
 *
 * All modes use direct HTTP REST API via getLettaClient().
 */

import { useState, useEffect } from "react";
import { useLettaCodeSpawn } from "../hooks/useLettaCodeSpawn";
import { useAppStore } from "../store/useAppStore";
import { getApiKey } from "../services/api";

export type ConnectionMode = "server" | "local" | "remote";

interface Props {
  mode: ConnectionMode;
  onModeChange: (mode: ConnectionMode) => void;
  /** For Remote mode: the user-configured remote server URL */
  remoteUrl?: string;
  onRemoteUrlChange?: (url: string) => void;
  /** Agent the spawn is associated with. Used to (a) substitute `{agentId}` in
   *  the operator's memfs URL template and (b) read any per-agent metadata
   *  override (`agent.metadata.letta_memfs_git_url`). */
  agentId?: string;
}

export default function ConnectionModeIndicator({
  mode,
  onModeChange,
  remoteUrl,
  onRemoteUrlChange,
  agentId,
}: Props) {
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
      case "running":
        return "bg-green-500";
      case "starting":
      case "stopping":
        return "bg-amber-500 animate-pulse";
      case "crashed":
        return "bg-red-500";
      default:
        return "bg-ink-300";
    }
  })();

  const handleSwitch = async (next: ConnectionMode) => {
    if (next === mode) return;
    if (next === "local" && localDisabled) return;
    onModeChange(next);
    // Stop local spawn when switching away from local mode
    if (mode === "local" && spawnState === "running") {
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
        // Local mode: spawn with localhost URL
        const result = await spawn({
          agentId,
          agentMetadataEnv,
          serverUrl: "http://localhost:8283",
          apiKey: getApiKey(),
        });
        console.log("[ConnectionModeIndicator] Spawn completed:", result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[ConnectionModeIndicator] spawn failed:", err);
        setSpawnError(msg);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
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
                : "Local mode: spawn letta-code locally and connect to localhost:8283"
            }
          >
            Local
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === "remote"
                ? "bg-accent text-white shadow-sm"
                : "text-ink-600 hover:bg-ink-900/5"
            }`}
            onClick={() => handleSwitch("remote")}
            title="Remote mode: connect to a user-configured remote Letta server"
          >
            Remote
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
          <span
            className="text-xs text-amber-600"
            title="Local mode requires the desktop build. Restart `npm run dev` after pulling these changes so preload is rebuilt."
          >
            desktop only — restart dev?
          </span>
        )}
      </div>

      {/* Remote URL input */}
      {mode === "remote" && (
        <div className="flex items-center gap-2 pl-1">
          <span className="text-xs text-ink-500">Remote URL:</span>
          <input
            type="text"
            value={remoteUrl || ""}
            onChange={(e) => onRemoteUrlChange?.(e.target.value)}
            placeholder="http://remote-server:8283"
            className="text-xs px-2 py-1 rounded border border-ink-900/10 bg-white flex-1 min-w-[200px]"
          />
          {!remoteUrl && (
            <span className="text-xs text-amber-600">Enter a remote server URL</span>
          )}
        </div>
      )}
    </div>
  );
}
