import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerEvent, ClientEvent } from "../types";
import { getLettaClient } from "../services/api";

export function useIPC(onEvent: (event: ServerEvent) => void) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent; // always up-to-date, no re-subscribe needed

  useEffect(() => {
    // Check if running in Electron
    const isElectron = typeof window !== 'undefined' && window.electron !== undefined;

    if (isElectron) {
      // Use Electron IPC — read onEvent from ref to avoid re-subscribing when
      // the callback identity changes (e.g. activeConversationId flips).
      // Without this, a permission.request broadcast during the tear-down /
      // re-setup gap is silently lost, stalling the canUseTool Promise.
      const unsubscribe = window.electron.onServerEvent((event: ServerEvent) => {
        onEventRef.current(event);
      });

      setConnected(true);

      return () => {
        unsubscribe();
      };
    } else {
      // Browser mode: Use HTTP API instead of WebSocket (since Redis is down)
      console.log('[useIPC] Browser mode - using HTTP API');
      setConnected(true);

      // Load initial data
      (async () => {
        try {
          const client = getLettaClient();
          let count = 0;
          for await (const _ of client.agents.list()) count++;
          console.log('[useIPC] Loaded', count, 'agents');
        } catch (err) {
          console.error('[useIPC] Failed to load agents:', err);
        }
      })();

      return () => {
        setConnected(false);
      };
    }
  }, []); // stable — reads ref instead of onEvent directly

  const sendEvent = useCallback(async (event: ClientEvent) => {
    const isElectron = typeof window !== 'undefined' && window.electron !== undefined;

    if (isElectron) {
      window.electron.sendClientEvent(event);
      return;
    }

    // Browser mode: Handle client events via HTTP API — read onEvent from ref
    console.log('[useIPC] Browser mode sendEvent:', event.type);

    try {
      const client = getLettaClient();
      switch (event.type) {
        case "session.list": {
          const conversations = await client.conversations.list({ agent_id: 'default-agent' });
          onEventRef.current({
            type: "session.list",
            payload: {
              sessions: conversations.map((c) => ({
                id: c.id,
                title: 'Conversation ' + c.id.slice(0, 8),
                status: 'idle',
                createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
                updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
              }))
            }
          });
          break;
        }
        case "session.start": {
          const conv = await client.conversations.create({ agent_id: 'default-agent' });
          onEventRef.current({
            type: "session.status",
            payload: {
              sessionId: conv.id,
              status: 'running',
              title: event.payload.title || 'New Session'
            }
          });
          break;
        }
        default:
          console.warn('[useIPC] Unhandled client event in browser mode:', event.type);
      }
    } catch (err) {
      console.error('[useIPC] Failed to send event:', err);
      onEventRef.current({
        type: "runner.error",
        payload: { message: err instanceof Error ? err.message : 'Unknown error' }
      });
    }
  }, []); // stable — reads onEvent from ref

  return { connected, sendEvent };
}
