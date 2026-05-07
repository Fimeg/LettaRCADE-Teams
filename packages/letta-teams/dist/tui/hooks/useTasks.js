import { useState, useEffect, useCallback } from 'react';
import { listTasks } from '../../store.js';
import { filterVisibleTasks } from '../../task-visibility.js';
/**
 * Hook to load and poll tasks
 */
export function useTasks(pollIntervalMs = 3000, includeInternal = false) {
    const [tasks, setTasks] = useState([]);
    const loadTasks = useCallback(() => {
        try {
            const data = listTasks();
            setTasks(filterVisibleTasks(data, includeInternal));
        }
        catch (error) {
            console.error('Failed to load tasks:', error);
        }
    }, [includeInternal]);
    // Initial load
    useEffect(() => {
        loadTasks();
    }, [loadTasks]);
    // Polling
    useEffect(() => {
        const interval = setInterval(loadTasks, pollIntervalMs);
        return () => clearInterval(interval);
    }, [loadTasks, pollIntervalMs]);
    return { tasks, refresh: loadTasks };
}
