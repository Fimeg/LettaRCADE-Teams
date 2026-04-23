/**
 * Memory Block WebSocket Sync Hook
 * Real-time synchronization for memory block changes via WebSocket
 */

import { useEffect, useRef } from "react";
import { useAppStore, type MemoryBlock } from "../store/useAppStore";

interface MemoryUpdatedMessage {
  type: "memory:updated";
  agentId: string;
  blocks: MemoryBlock[];
  timestamp: string;
}

type WebSocketMessage = MemoryUpdatedMessage;

const WS_URL = "ws://10.10.20.19:3000/ws";

export function useMemorySync(agentId: string | null) {
  const updateMemoryBlocks = useAppStore((state) => state.updateMemoryBlocks);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!agentId) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      // Subscribe to agent-specific memory updates
      ws.send(
        JSON.stringify({
          action: "subscribe",
          channels: [`agent:${agentId}:memory`, `agent:${agentId}`],
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WebSocketMessage;

        if (msg.type === "memory:updated" && msg.agentId === agentId) {
          updateMemoryBlocks(agentId, msg.blocks);
        }
      } catch (err) {
        console.error("[useMemorySync] Error parsing WebSocket message:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("[useMemorySync] WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("[useMemorySync] WebSocket closed");
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [agentId, updateMemoryBlocks]);

  return wsRef;
}
