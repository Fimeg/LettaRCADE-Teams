/**
 * useLettaCodeWs — manages WebSocket connection to local letta-code instance.
 * Enables full tool use sessions via execute_command protocol.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Protocol Types (from letta-code protocol_v2.ts)

export interface DeviceStatus {
  current_connection_id: string | null;
  connection_name: string | null;
  is_online: boolean;
  agent_id: string | null;
  conversation_id: string | null;
  pending_approvals_count: number;
  pending_control_requests: unknown[];
  memory_directory: string | null;
  reflection_settings: unknown | null;
  supported_commands: string[];
}

export interface StreamDelta {
  message_type?: string;
  content?: string;
  id?: string;
  name?: string;
  arguments?: string;
  tool_call_id?: string;
  reasoning?: string;
  [key: string]: unknown;
}

export type LettaCodeStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LettaCodeMessage {
  type: string;
  delta?: StreamDelta;
  device_status?: DeviceStatus;
  [key: string]: unknown;
}

interface ExecuteCommandParams {
  commandId: string;
  agentId: string;
  conversationId: string;
  args?: string;
}

const RECONNECT_DELAY_MS = 5000;

export function useLettaCodeWs(wsUrl: string | null) {
  const [status, setStatus] = useState<LettaCodeStatus>('disconnected');
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const messageHandlersRef = useRef<Set<(msg: LettaCodeMessage) => void>>(new Set());

  // Subscribe to messages
  const subscribe = useCallback((handler: (msg: LettaCodeMessage) => void) => {
    messageHandlersRef.current.add(handler);
    return () => messageHandlersRef.current.delete(handler);
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!wsUrl || !mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    setLastError(null);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setStatus('connected');
        setLastError(null);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data) as LettaCodeMessage;

          // Handle device status updates
          if (msg.type === 'update_device_status' && msg.device_status) {
            setDeviceStatus(msg.device_status);
          }

          // Broadcast to all subscribers
          messageHandlersRef.current.forEach(handler => {
            try {
              handler(msg);
            } catch {
              // Ignore handler errors
            }
          });
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        wsRef.current = null;

        if (event.code === 1000) {
          setStatus('disconnected');
        } else {
          setStatus('error');
          setLastError(`Connection closed: ${event.reason || 'Unknown reason'}`);
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setLastError('WebSocket error');
      };
    } catch (err) {
      if (mountedRef.current) {
        setStatus('error');
        setLastError(err instanceof Error ? err.message : 'Failed to connect');
      }
    }
  }, [wsUrl]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      if (mountedRef.current) connect();
    }, RECONNECT_DELAY_MS);
  }, [connect]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }
    setStatus('disconnected');
    setDeviceStatus(null);
  }, []);

  // Execute slash command via WebSocket
  const executeCommand = useCallback((params: ExecuteCommandParams) => {
    if (!wsRef.current || status !== 'connected') {
      return false;
    }

    const message = {
      type: 'execute_command',
      command_id: params.commandId,
      request_id: crypto.randomUUID(),
      runtime: {
        agent_id: params.agentId,
        conversation_id: params.conversationId,
      },
      args: params.args,
    };

    wsRef.current.send(JSON.stringify(message));
    return true;
  }, [status]);

  // Auto-connect when URL provided
  useEffect(() => {
    mountedRef.current = true;

    if (wsUrl) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [wsUrl, connect]);

  return {
    status,
    deviceStatus,
    lastError,
    subscribe,
    connect,
    disconnect,
    executeCommand,
  };
}
