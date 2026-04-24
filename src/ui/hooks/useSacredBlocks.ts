import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'letta-sacred-blocks';

export function useSacredBlocks(agentId: string) {
  const [sacredBlocks, setSacredBlocks] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${agentId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSacredBlocks(new Set(parsed));
      }
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [agentId]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        `${STORAGE_KEY}-${agentId}`,
        JSON.stringify(Array.from(sacredBlocks))
      );
    } catch {
      // Fail silently
    }
  }, [sacredBlocks, loaded, agentId]);

  const toggleSacred = useCallback((blockLabel: string) => {
    setSacredBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockLabel)) {
        next.delete(blockLabel);
      } else {
        next.add(blockLabel);
      }
      return next;
    });
  }, []);

  const isSacred = useCallback((blockLabel: string) => {
    return sacredBlocks.has(blockLabel);
  }, [sacredBlocks]);

  return {
    sacredBlocks,
    toggleSacred,
    isSacred,
    loaded,
  };
}
