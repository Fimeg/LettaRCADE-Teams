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
import { getApiKeyAsync } from "../services/api";

export type ConnectionMode = "server" | "local" | "remote" | "teleport";

// Persistence keys
const MODE_STORAGE_KEY = "letta:connection-mode";
const REMOTE_URL_STORAGE_KEY = "letta:remote-server-url";

interface Props {
  /** Controlled mode - if not provided, component manages its own state */
  mode?: ConnectionMode;
  /** Controlled mode change handler */
  onModeChange?: (mode: ConnectionMode) => void;
  /** For Remote mode: the user-configured remote server URL (controlled) */
  remoteUrl?: string;
  /** Controlled remote URL change handler */
  onRemoteUrlChange?: (url: string) => void;
  /** Agent the spawn is associated with. Used to (a) substitute `{agentId}` in
   *  the operator's memfs URL template and (b) read any per-agent metadata
   *  override (`agent.metadata.letta_memfs_git_url`). */
  agentId?: string;
}

export default function ConnectionModeIndicator({
  mode: controlledMode,
  onModeChange: controlledOnModeChange,
  remoteUrl: controlledRemoteUrl,
  onRemoteUrlChange: controlledOnRemoteUrlChange,
  agentId,
}: Props) {
  const { available, status, spawn, stop } = useLettaCodeSpawn();
  const agent = useAppStore((s) => (agentId ? s.agents[agentId] : null));
  const [spawnError, setSpawnError] = useState<string | null>(null);

  // Uncontrolled state with persistence - default to LOCAL mode
  const [internalMode, setInternalMode] = useState<ConnectionMode>("local");
  const [internalRemoteUrl, setInternalRemoteUrl] = useState<string>("");

  // Determine if controlled or uncontrolled
  const isControlled = controlledMode !== undefined;
  const mode = isControlled ? controlledMode : internalMode;
  const remoteUrl = isControlled ? controlledRemoteUrl : internalRemoteUrl;
  const onModeChange = isControlled ? controlledOnModeChange : setInternalMode;
  const onRemoteUrlChange = isControlled ? controlledOnRemoteUrlChange : setInternalRemoteUrl;

  // Load persisted state on mount
  useEffect(() => {
    if (isControlled) return; // Don't load if controlled

    try {
      const savedMode = localStorage.getItem(MODE_STORAGE_KEY) as ConnectionMode | null;
      const savedRemoteUrl = localStorage.getItem(REMOTE_URL_STORAGE_KEY);
      if (savedMode && ["server", "local", "remote"].includes(savedMode)) {
        setInternalMode(savedMode);
      }
      if (savedRemoteUrl) {
        setInternalRemoteUrl(savedRemoteUrl);
      }
    } catch {
      // Ignore localStorage errors (privacy mode, etc.)
    }
  }, [isControlled]);

  // Persist state changes
  useEffect(() => {
    if (isControlled) return;

    try {
      localStorage.setItem(MODE_STORAGE_KEY, internalMode);
      localStorage.setItem(REMOTE_URL_STORAGE_KEY, internalRemoteUrl);
    } catch {
      // Ignore localStorage errors
    }
  }, [internalMode, internalRemoteUrl, isControlled]);

  // Log status changes for debugging
  useEffect(() => {
    console.log("[ConnectionModeIndicator] status changed:", status);
  }, [status]);

  const localDisabled = !available;
  const spawnState = status.status;

  // Auto-spawn CLI when agent loads in local mode
  useEffect(() => {
    if (mode === "local" && agentId && spawnState === "stopped" && !spawnError) {
      console.log("[ConnectionModeIndicator] Auto-spawning CLI for agent:", agentId);
      handleSpawnToggle().catch((err) => {
        console.error("[ConnectionModeIndicator] Auto-spawn failed:", err);
      });
    }
  }, [mode, agentId, spawnState, spawnError]);

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
    onModeChange?.(next);
    // Stop local spawn when switching away from local mode
    if (mode === "local" && spawnState === "running") {
      await stop();
    }
  };

  // Get server URL based on current mode
  const getServerUrl = async (): Promise<string> => {
    // First, try to get from localStorage (user-configured)
    let baseUrl = "";
    try {
      baseUrl = localStorage.getItem("letta_api_url") || "";
    } catch {
      // ignore
    }
    
    // If not in localStorage, try to get from main process env (for Electron)
    if (!baseUrl && typeof window !== 'undefined' && window.electron?.getRuntimeEnv) {
      try {
        const env = await window.electron.getRuntimeEnv();
        baseUrl = env.LETTA_BASE_URL || "";
      } catch (err) {
        console.error("[ConnectionModeIndicator] Failed to get runtime env:", err);
      }
    }
    
    // Fallback to default
    if (!baseUrl) {
      baseUrl = "http://localhost:8283";
    }

    switch (mode) {
      case "local":
        // For Local mode, the CLI runs on localhost but connects to the upstream server
        // Use the configured server URL (from localStorage or env) as the upstream target
        return baseUrl;
      case "remote":
        return remoteUrl || "";
      case "server":
      default:
        // For server mode, use the configured API URL
        return baseUrl;
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

        const serverUrl = await getServerUrl();
        if (!serverUrl) {
          throw new Error("Server URL not configured");
        }

        // Get API key asynchronously (checks main process env for Electron)
        const apiKey = await getApiKeyAsync();

        const result = await spawn({
          agentId,
          agentMetadataEnv,
          serverUrl,
          apiKey,
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
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 ${
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
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors opacity-50 cursor-not-allowed ${
              mode === "teleport"
                ? "bg-accent text-white shadow-sm"
                : "text-ink-600"
            }`}
            disabled
            title="Teleport mode: send context to another machine (future feature)"
          >
            Teleport
          </button>
        </div>

        {mode === "local" && (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusDotClass}`} title={spawnState} />
            <span className="text-xs text-ink-600">
              {spawnState === "running" ? "Connected" : 
               spawnState === "starting" ? "Connecting..." : 
               spawnState === "stopping" ? "Disconnecting..." : 
               "Disconnected"}
            </span>
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
