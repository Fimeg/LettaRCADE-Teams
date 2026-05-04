/**
 * ConnectionModeIndicator — Compact connection mode selector
 * Three modes: Direct (Local+Remote merged), Server (Letta Cloud), Teleport (teaser)
 *
 * All modes use direct HTTP REST API via getLettaClient().
 */

import { useState, useEffect } from "react";
import { useLettaCodeSpawn } from "../hooks/useLettaCodeSpawn";
import { useAppStore } from "../store/useAppStore";
import { getApiKeyAsync, type ConnectionMode as ApiConnectionMode } from "../services/api";
import { Input } from "./ui/primitives/Input";
import { Globe, Cloud, Zap, ArrowRightLeft } from "lucide-react";

// Re-export ConnectionMode for consumers (matches api.ts)
export type ConnectionMode = ApiConnectionMode;

// Unified persistence keys (match api.ts)
const MODE_STORAGE_KEY = "letta_connection_mode";
const REMOTE_URL_STORAGE_KEY = "letta_remote_url";

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
  /** Compact mode - smaller UI for header/status bar placement */
  compact?: boolean;
}

export default function ConnectionModeIndicator({
  mode: controlledMode,
  onModeChange: controlledOnModeChange,
  remoteUrl: controlledRemoteUrl,
  onRemoteUrlChange: controlledOnRemoteUrlChange,
  agentId,
  compact = false,
}: Props) {
  const { available, status, spawn, stop } = useLettaCodeSpawn();
  const agent = useAppStore((s) => (agentId ? s.agents[agentId] : null));
  const [spawnError, setSpawnError] = useState<string | null>(null);

  // Uncontrolled state with persistence - default to LOCAL mode
  const [internalMode, setInternalMode] = useState<ApiConnectionMode>("local");
  const [internalRemoteUrl, setInternalRemoteUrl] = useState<string>("");

  // Determine if controlled or uncontrolled
  const isControlled = controlledMode !== undefined;
  const mode = isControlled ? controlledMode : internalMode;
  const remoteUrl = isControlled ? controlledRemoteUrl : internalRemoteUrl;
  const onModeChange = isControlled ? controlledOnModeChange : setInternalMode;
  const onRemoteUrlChange = isControlled ? controlledOnRemoteUrlChange : setInternalRemoteUrl;

  // Load persisted state on mount
  useEffect(() => {
    if (isControlled) return;

    try {
      const savedMode = localStorage.getItem(MODE_STORAGE_KEY) as ApiConnectionMode | null;
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

  const handleDirectUrlChange = (url: string) => {
    onRemoteUrlChange?.(url);
    // If URL is localhost, treat as local mode, otherwise remote
    const isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");
    const newMode = isLocalhost ? "local" : "remote";
    if (newMode !== mode) {
      onModeChange?.(newMode);
    }
  };

  const getServerUrl = async (): Promise<string> => {
    let baseUrl = "";
    try {
      baseUrl = localStorage.getItem("letta_api_url") || "";
    } catch {
      // ignore
    }

    if (!baseUrl && typeof window !== "undefined" && window.electron?.getRuntimeEnv) {
      try {
        const env = await window.electron.getRuntimeEnv();
        baseUrl = env.LETTA_BASE_URL || "";
      } catch (err) {
        console.error("[ConnectionModeIndicator] Failed to get runtime env:", err);
      }
    }

    if (!baseUrl) {
      baseUrl = "http://localhost:8283";
    }

    switch (mode) {
      case "local":
        return baseUrl;
      case "remote":
        return remoteUrl || "";
      case "server":
      default:
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

  // Compact mode - just a dropdown/status indicator
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative group">
          <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-ink-600 hover:bg-ink-900/5 transition-colors">
            {mode === "server" && <Cloud className="w-3.5 h-3.5" />}
            {mode === "local" && <ArrowRightLeft className="w-3.5 h-3.5" />}
            {mode === "remote" && <Globe className="w-3.5 h-3.5" />}
            <span>
              {mode === "server" ? "Cloud" : mode === "local" ? "Local" : "Remote"}
            </span>
          </button>
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-48 py-1 bg-surface rounded-lg shadow-lg border border-ink-900/10 hidden group-hover:block z-50">
            <button
              onClick={() => handleSwitch("local")}
              className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-ink-900/5 ${
                mode === "local" ? "text-accent bg-accent/5" : "text-ink-700"
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Direct (Local)
            </button>
            <button
              onClick={() => handleSwitch("remote")}
              className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-ink-900/5 ${
                mode === "remote" ? "text-accent bg-accent/5" : "text-ink-700"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Direct (Custom URL)
            </button>
            <button
              onClick={() => handleSwitch("server")}
              className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-ink-900/5 ${
                mode === "server" ? "text-accent bg-accent/5" : "text-ink-700"
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              Letta Cloud
            </button>
            <div className="border-t border-ink-900/10 my-1" />
            <div className="px-3 py-2 text-xs text-ink-400 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              Teleport (soon)
            </div>
          </div>
        </div>
        {mode === "local" && (
          <div className={`w-2 h-2 rounded-full ${statusDotClass}`} title={spawnState} />
        )}
      </div>
    );
  }

  // Full mode - card-based selector
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Direct Mode Card (Local + Remote merged) */}
        <button
          onClick={() => handleSwitch("local")}
          className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
            mode === "local" || mode === "remote"
              ? "border-accent bg-accent/5"
              : "border-ink-900/10 hover:border-ink-900/20"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${mode === "local" || mode === "remote" ? "bg-accent/10" : "bg-ink-100"}`}>
              <ArrowRightLeft className={`w-4 h-4 ${mode === "local" || mode === "remote" ? "text-accent" : "text-ink-600"}`} />
            </div>
            <span className="text-sm font-medium text-ink-900">Direct</span>
            {(mode === "local" || mode === "remote") && (
              <div className={`w-2 h-2 rounded-full ${statusDotClass}`} />
            )}
          </div>
          <p className="text-xs text-ink-500">
            Connect directly to a Letta server. Default: localhost:8283
          </p>
          {mode === "local" && localDisabled && (
            <span className="mt-2 text-[10px] text-amber-600">
              Desktop app required
            </span>
          )}
        </button>

        {/* Server Mode Card (Letta Cloud) */}
        <button
          onClick={() => handleSwitch("server")}
          className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
            mode === "server"
              ? "border-accent bg-accent/5"
              : "border-ink-900/10 hover:border-ink-900/20"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${mode === "server" ? "bg-accent/10" : "bg-ink-100"}`}>
              <Cloud className={`w-4 h-4 ${mode === "server" ? "text-accent" : "text-ink-600"}`} />
            </div>
            <span className="text-sm font-medium text-ink-900">Letta Cloud</span>
            {mode === "server" && (
              <div className="w-2 h-2 rounded-full bg-green-500" />
            )}
          </div>
          <p className="text-xs text-ink-500">
            Connect to the managed Letta Cloud service
          </p>
        </button>

        {/* Teleport Mode Card (Teaser - Coming Soon) */}
        <div className="flex flex-col items-start p-3 rounded-xl border border-dashed border-ink-900/20 opacity-60 cursor-not-allowed">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-ink-100">
              <Zap className="w-4 h-4 text-ink-500" />
            </div>
            <span className="text-sm font-medium text-ink-700">Teleport</span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-ink-100 text-ink-500 rounded-full">
              Soon
            </span>
          </div>
          <p className="text-xs text-ink-500">
            Remote control agents across devices via LACE
          </p>
        </div>
      </div>

      {/* Direct URL Input (shown when Direct mode selected) */}
      {(mode === "local" || mode === "remote") && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary border border-ink-900/5">
          <div className="flex items-center gap-2 flex-1">
            <Globe className="w-4 h-4 text-ink-400" />
            <div className="flex-1">
              <label className="text-xs font-medium text-ink-600 block mb-1">
                Server URL
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={remoteUrl || "http://localhost:8283"}
                  onChange={(e) => handleDirectUrlChange(e.target.value)}
                  placeholder="http://localhost:8283"
                  size="sm"
                  className="flex-1"
                />
                {(!remoteUrl || remoteUrl.includes("localhost")) ? (
                  <span className="text-xs text-ink-400 whitespace-nowrap">Local mode</span>
                ) : (
                  <span className="text-xs text-accent whitespace-nowrap">Custom URL</span>
                )}
              </div>
            </div>
          </div>
          {mode === "local" && (
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <div className={`w-2 h-2 rounded-full ${statusDotClass}`} />
              {spawnState === "running"
                ? "Connected"
                : spawnState === "starting"
                ? "Connecting..."
                : "Disconnected"}
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {(status.error || spawnError) && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs text-red-600 font-medium mb-1">Connection Error</p>
          <p className="text-xs text-red-600 font-mono break-words">
            {spawnError || status.error}
          </p>
        </div>
      )}
    </div>
  );
}
