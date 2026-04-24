import { useEffect, useRef, useState } from "react";

/**
 * Floating log panel for the spawned letta-code subprocess. Subscribes to
 * main-process log events and keeps the last N lines. Useful for debugging
 * why Local mode didn't start cleanly.
 */

const MAX_LINES = 500;

interface LogLine {
  stream: "stdout" | "stderr";
  line: string;
  ts: number;
}

export function LettaCodeLogPanel() {
  const api = typeof window !== "undefined" ? window.electron?.lettaCode : undefined;
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!api) return;
    const unsubscribe = api.onLog((entry) => {
      setLines((prev) => {
        const next = [...prev, { ...entry, ts: Date.now() }];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
    });
    return unsubscribe;
  }, [api]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, open]);

  if (!api) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 text-xs font-medium rounded-full bg-ink-900 text-white shadow-lg hover:bg-ink-800 transition-colors"
          title="Open letta-code subprocess logs"
        >
          letta-code logs{lines.length > 0 ? ` (${lines.length})` : ""}
        </button>
      ) : (
        <div className="w-[480px] h-[320px] flex flex-col rounded-xl border border-ink-900/20 bg-ink-900/95 text-white shadow-2xl overflow-hidden backdrop-blur">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-xs font-semibold">letta-code subprocess</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLines([])}
                className="text-[10px] px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
              >
                clear
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-[10px] px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
              >
                close
              </button>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
            {lines.length === 0 ? (
              <p className="text-white/40 italic">No output yet. Start Local mode to see logs.</p>
            ) : (
              lines.map((l, i) => (
                <div
                  key={`${l.ts}-${i}`}
                  className={l.stream === "stderr" ? "text-red-300" : "text-white/80"}
                >
                  {l.line}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
