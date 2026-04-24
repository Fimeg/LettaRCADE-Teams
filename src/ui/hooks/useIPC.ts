import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerEvent, ClientEvent } from "../types";
import { api } from "../services/api";

// Type for conversation objects returned by listConversations
interface Conversation {
  id: string;
  created_at?: string | number;
  updated_at?: string | number;
}

export function useIPC(onEvent: (event: ServerEvent) => void) {
  const [connected, setConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Check if running in Electron
    const isElectron = typeof window !== 'undefined' && window.electron !== undefined;

    if (isElectron) {
      // Use Electron IPC
      const unsubscribe = window.electron.onServerEvent((event: ServerEvent) => {
        onEvent(event);
      });

      unsubscribeRef.current = unsubscribe;
      setConnected(true);

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        setConnected(false);
      };
    } else {
      // Browser mode: Use HTTP API instead of WebSocket (since Redis is down)
      console.log('[useIPC] Browser mode - using HTTP API');
      setConnected(true);

      // Load initial data
      api.listAgents().then(agents => {
        console.log('[useIPC] Loaded', agents.length, 'agents');
      }).catch(err => {
        console.error('[useIPC] Failed to load agents:', err);
      });

      return () => {
        setConnected(false);
      };
    }
  }, [onEvent]);

  const sendEvent = useCallback(async (event: ClientEvent) => {
    const isElectron = typeof window !== 'undefined' && window.electron !== undefined;

    if (isElectron) {
      window.electron.sendClientEvent(event);
      return;
    }

    // Browser mode: Handle client events via HTTP API
    console.log('[useIPC] Browser mode sendEvent:', event.type);

    try {
      switch (event.type) {
        case "session.list": {
          // Get conversations from API
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const conversations = await (api as any).listConversations('default-agent');
          onEvent({
            type: "session.list",
            payload: {
              sessions: conversations.map((c: Conversation) => ({
                id: c.id,
                title: 'Conversation ' + c.id.slice(0, 8),
                status: 'idle',
                createdAt: new Date(c.created_at || Date.now()).getTime(),
                updatedAt: new Date(c.updated_at || Date.now()).getTime()
              }))
            }
          });
          break;
        }
        case "session.start": {
          // Create a new conversation
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const conv = await (api as any).createConversation('default-agent');
          onEvent({
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
      onEvent({
        type: "runner.error",
        payload: { message: err instanceof Error ? err.message : 'Unknown error' }
      });
    }
  }, [onEvent]);

  return { connected, sendEvent };
}
