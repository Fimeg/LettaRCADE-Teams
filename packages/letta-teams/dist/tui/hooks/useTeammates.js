import { useState, useEffect, useCallback } from 'react';
import { listTeammates } from '../../store.js';
/**
 * Hook to load and poll teammates
 */
export function useTeammates(pollIntervalMs = 3000) {
    const [teammates, setTeammates] = useState([]);
    const loadTeammates = useCallback(() => {
        try {
            const data = listTeammates();
            setTeammates(data);
        }
        catch (error) {
            console.error('Failed to load teammates:', error);
        }
    }, []);
    // Initial load
    useEffect(() => {
        loadTeammates();
    }, [loadTeammates]);
    // Polling
    useEffect(() => {
        const interval = setInterval(loadTeammates, pollIntervalMs);
        return () => clearInterval(interval);
    }, [loadTeammates, pollIntervalMs]);
    return { teammates, refresh: loadTeammates };
}
