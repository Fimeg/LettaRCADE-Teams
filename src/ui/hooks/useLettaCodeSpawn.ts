import { useCallback, useEffect, useState } from "react";

/**
 * Renderer-side handle for the letta-code subprocess managed by the main
 * process. In a browser-only build (no Electron), returns a permanently
 * "unavailable" status so the UI can gracefully hide local-mode affordances.
 */

export function useLettaCodeSpawn() {
  const api = typeof window !== "undefined" ? window.electron?.lettaCode : undefined;
  const available = !!api;

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
      if (!api) throw new Error("letta-code is only available in the desktop app");
      return api.spawn(opts);
    },
    [api],
  );

  const stop = useCallback(async () => {
    if (!api) return;
    await api.stop();
  }, [api]);

  return { available, status, spawn, stop };
}
