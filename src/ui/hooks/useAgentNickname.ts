import { useCallback, useEffect, useState } from 'react';

const storageKey = (agentId: string) => `letta-ui:nickname:${agentId}`;

/**
 * Per-agent UI nickname, persisted to localStorage.
 * Distinct from the agent's server-side `name` — lets the user pick a
 * chat-display label without renaming the agent on the server.
 */
export function useAgentNickname(agentId: string | null) {
  const [nickname, setNicknameState] = useState<string>('');

  useEffect(() => {
    if (!agentId) {
      setNicknameState('');
      return;
    }
    try {
      setNicknameState(localStorage.getItem(storageKey(agentId)) ?? '');
    } catch {
      setNicknameState('');
    }
  }, [agentId]);

  const setNickname = useCallback(
    (value: string) => {
      setNicknameState(value);
      if (!agentId) return;
      try {
        if (value) {
          localStorage.setItem(storageKey(agentId), value);
        } else {
          localStorage.removeItem(storageKey(agentId));
        }
      } catch {
        // localStorage may be unavailable (private mode, quota, etc.)
      }
    },
    [agentId],
  );

  return { nickname, setNickname };
}
