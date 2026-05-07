import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

type ToolStatus = 'pending' | 'success' | 'error';

interface ToolStatusContextValue {
  getStatus: (toolCallId: string) => ToolStatus | undefined;
  setStatus: (toolCallId: string, status: ToolStatus) => void;
  subscribe: (callback: () => void) => () => void;
}

const ToolStatusContext = createContext<ToolStatusContextValue | null>(null);

export function ToolStatusProvider({ children }: { children: React.ReactNode }) {
  const [statusMap, setStatusMap] = useState<Map<string, ToolStatus>>(() => new Map());
  const [listeners, setListeners] = useState<Set<() => void>>(() => new Set());

  const getStatus = useCallback((toolCallId: string) => {
    return statusMap.get(toolCallId);
  }, [statusMap]);

  const setStatus = useCallback((toolCallId: string, status: ToolStatus) => {
    setStatusMap(prev => {
      const next = new Map(prev);
      next.set(toolCallId, status);
      return next;
    });
    // Defer listener notifications to avoid setState-during-render crash
    setTimeout(() => {
      listeners.forEach(listener => listener());
    }, 0);
  }, [listeners]);

  const subscribe = useCallback((callback: () => void) => {
    setListeners(prev => {
      const next = new Set(prev);
      next.add(callback);
      return next;
    });
    return () => {
      setListeners(prev => {
        const next = new Set(prev);
        next.delete(callback);
        return next;
      });
    };
  }, []);

  const value = React.useMemo(() => ({
    getStatus,
    setStatus,
    subscribe,
  }), [getStatus, setStatus, subscribe]);

  return (
    <ToolStatusContext.Provider value={value}>
      {children}
    </ToolStatusContext.Provider>
  );
}

export function useToolStatusContext() {
  const context = useContext(ToolStatusContext);
  if (!context) {
    throw new Error('useToolStatusContext must be used within ToolStatusProvider');
  }
  return context;
}

export function useToolStatus(toolCallId: string | undefined): ToolStatus | undefined {
  const context = useToolStatusContext();
  const [status, setStatus] = useState<ToolStatus | undefined>(() =>
    toolCallId ? context.getStatus(toolCallId) : undefined
  );

  useEffect(() => {
    if (!toolCallId) return;

    // Initial check
    setStatus(context.getStatus(toolCallId));

    // Subscribe to updates
    const unsubscribe = context.subscribe(() => {
      setStatus(context.getStatus(toolCallId));
    });

    return unsubscribe;
  }, [toolCallId, context]);

  return status;
}

export function useSetToolStatus() {
  const context = useToolStatusContext();
  return context.setStatus;
}
