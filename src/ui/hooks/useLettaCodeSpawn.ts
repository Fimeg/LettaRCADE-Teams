import { useCallback, useEffect, useState } from "react";

/**
 * Renderer-side handle for the letta-code subprocess managed by the main
 * process. In a browser-only build (no Electron), returns a permanently
 * "unavailable" status so the UI can gracefully hide local-mode affordances.
 *
 * 3-Mode Architecture:
 * - Server: Direct HTTP to external Letta server (no spawn)
 * - Local: Spawn letta.js CLI, connect to localhost:8283
 * - Remote: Direct HTTP to user-configured remote server (no spawn)
 *
 * Only Local mode uses this hook to spawn the CLI. Server and Remote modes
 * use getLettaClient() directly with the appropriate baseURL.
 */

export interface SpawnOptions {
  cwd?: string;
  agentId?: string;
  agentMetadataEnv?: {
    letta_memfs_git_url?: string;
    letta_memfs_local?: string;
  };
  /** The Letta server URL to connect to. Required for 3-mode architecture. */
  serverUrl?: string;
  /** API key for the Letta server. */
  apiKey?: string;
}

export function useLettaCodeSpawn() {
  const api = typeof window !== "undefined" ? window.electron?.lettaCode : undefined;
  const available = !!api;

  // Debug logging for IPC availability
  if (typeof window !== "undefined") {
    console.log("[useLettaCodeSpawn] window.electron exists:", !!window.electron);
    console.log("[useLettaCodeSpawn] window.electron.lettaCode exists:", !!window.electron?.lettaCode);
    console.log("[useLettaCodeSpawn] available:", available);
  }

  const [status, setStatus] = useState<LettaCodeStatusPayload>({ status: "stopped" });

  useEffect(() => {
    if (!api) return;
    let disposed = false;

    api.getStatus().then((s) => {
      if (!disposed) setStatus(s);
    });

    const unsubscribe = api.onStatus((payload) => {
      if (!disposed) setStatus(payload);
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [api]);

  const spawn = useCallback(
    async (opts?: SpawnOptions) => {
      if (!api) {
        const errMsg = "letta-code is only available in the desktop app";
        console.error(`[useLettaCodeSpawn] ${errMsg}`);
        throw new Error(errMsg);
      }

      // For 3-mode architecture, caller explicitly provides serverUrl.
      // Fallback to localStorage only if not provided (backward compat).
      let serverUrl = opts?.serverUrl;
      let apiKey = opts?.apiKey;

      console.log("[useLettaCodeSpawn] Initial opts:", {
        serverUrl: serverUrl ? "(provided)" : "(not provided)",
        apiKey: apiKey ? "(provided)" : "(not provided)",
      });

      if (!serverUrl) {
        try {
          serverUrl = localStorage.getItem("letta_api_url") || undefined;
        } catch { /* ignore privacy / quota errors */ }
      }
      if (!apiKey) {
        try {
          apiKey = localStorage.getItem("letta_api_key") || undefined;
        } catch { /* ignore privacy / quota errors */ }
      }

      const fullOpts = { ...opts, serverUrl, apiKey };
      console.log("[useLettaCodeSpawn] Calling api.spawn with opts:", {
        serverUrl: fullOpts.serverUrl,
        apiKey: fullOpts.apiKey ? "(set)" : "(unset)",
        agentId: fullOpts.agentId,
      });

      try {
        const result = await api.spawn(fullOpts);
        console.log("[useLettaCodeSpawn] api.spawn succeeded:", result);
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("[useLettaCodeSpawn] api.spawn failed:", errorMsg);
        throw err;
      }
    },
    [api],
  );

  const stop = useCallback(async () => {
    if (!api) return;
    await api.stop();
  }, [api]);

  return { available, status, spawn, stop };
}
