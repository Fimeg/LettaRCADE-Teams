import { useCallback, useEffect, useState } from "react";

/**
 * Renderer-side handle for the letta-code subprocess managed by the main
 * process. In a browser-only build (no Electron), returns a permanently
 * "unavailable" status so the UI can gracefully hide local-mode affordances.
 */

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
    async (opts?: { cwd?: string }) => {
      if (!api) {
        const errMsg = "letta-code is only available in the desktop app";
        console.error(`[useLettaCodeSpawn] ${errMsg}`);
        throw new Error(errMsg);
      }
      // Renderer's working creds live in localStorage; main-process appConfig
      // never sees them. Pass them through on spawn so the proxy upstream
      // matches what the user actually configured in Settings.
      let serverUrl: string | undefined;
      let apiKey: string | undefined;
      try {
        serverUrl = localStorage.getItem("letta_api_url") || undefined;
        apiKey = localStorage.getItem("letta_api_key") || undefined;
      } catch { /* ignore privacy / quota errors */ }
      const fullOpts = { ...opts, serverUrl, apiKey };
      console.log("[useLettaCodeSpawn] Calling api.spawn with opts:", { ...fullOpts, apiKey: apiKey ? "(set)" : "(unset)" });
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
