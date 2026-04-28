import { create } from 'zustand';
import type {
  DispatchTaskInput,
  SpawnTeammateInput,
  TaskState,
  TaskStatus,
  TeammateState,
} from 'letta-teams-sdk';
import { getApiBase, getApiKey } from '../services/api';
import { useAppStore } from './useAppStore';

const DEFAULT_POLL_INTERVAL_MS = 5000;
const MIN_POLL_INTERVAL_MS = 1000;

type TeamsOperationState = {
  bootstrapping: boolean;
  refreshing: boolean;
  ensuringDaemon: boolean;
  spawning: boolean;
  dispatching: boolean;
};

type RefreshOptions = {
  silent?: boolean;
  status?: TaskStatus;
};

type TeamsState = {
  supported: boolean;
  bootstrapped: boolean;
  configured: boolean;
  snapshot: TeamsRuntimeSnapshot | null;
  daemon: TeamsDaemonStatusPayload | null;
  teammates: TeamsTeammateState[];
  tasks: TeamsTaskState[];
  error: string | null;
  pollTimer: number | null;
  pollIntervalMs: number;
  operations: TeamsOperationState;
  clearError: () => void;
  bootstrap: () => Promise<void>;
  configure: (input?: Partial<TeamsRuntimeConfig>) => Promise<TeamsRuntimeSnapshot | null>;
  setProjectDir: (projectDir: string) => Promise<void>;
  pickProjectDir: () => Promise<string | null>;
  refresh: (options?: RefreshOptions) => Promise<void>;
  ensureDaemonRunning: () => Promise<void>;
  startPolling: () => Promise<void>;
  stopPolling: () => void;
  spawnTeammate: (input: SpawnTeammateInput) => Promise<TeammateState>;
  forkTeammate: (name: string, forkName: string) => Promise<TeammateState>;
  reinitTeammate: (name: string, prompt?: string) => Promise<string>;
  dispatchTask: (input: DispatchTaskInput) => Promise<{ taskId: string }>;
  cancelTask: (id: string) => Promise<TaskState>;
};

const defaultOperations: TeamsOperationState = {
  bootstrapping: false,
  refreshing: false,
  ensuringDaemon: false,
  spawning: false,
  dispatching: false,
};

function hasTeamsBridge(): boolean {
  return typeof window !== 'undefined' && !!window.electron?.teams;
}

function normalizeProjectDir(projectDir?: string): string | undefined {
  const trimmed = projectDir?.trim();
  return trimmed ? trimmed : undefined;
}

function sortTeammates(teammates: TeamsTeammateState[]): TeamsTeammateState[] {
  return [...teammates].sort((a, b) => a.name.localeCompare(b.name));
}

function sortTasks(tasks: TeamsTaskState[]): TeamsTaskState[] {
  return [...tasks].sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    return bTime - aTime;
  });
}

async function resolveDefaultProjectDir(): Promise<string | undefined> {
  const appCwd = useAppStore.getState().cwd?.trim();
  if (appCwd) {
    return appCwd;
  }

  if (typeof window !== 'undefined' && window.electron?.getRuntimeEnv) {
    try {
      const env = await window.electron.getRuntimeEnv();
      return normalizeProjectDir(env.cwd);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

async function resolvePollInterval(): Promise<number> {
  if (typeof window === 'undefined' || !window.electron?.getConfig) {
    return DEFAULT_POLL_INTERVAL_MS;
  }

  try {
    const config = await window.electron.getConfig();
    return Math.max(MIN_POLL_INTERVAL_MS, config.pollingInterval || DEFAULT_POLL_INTERVAL_MS);
  } catch {
    return DEFAULT_POLL_INTERVAL_MS;
  }
}

function setOperation(
  set: (partial: Partial<TeamsState> | ((state: TeamsState) => Partial<TeamsState>)) => void,
  key: keyof TeamsOperationState,
  value: boolean,
) {
  set((state) => ({
    operations: {
      ...state.operations,
      [key]: value,
    },
  }));
}

export const useTeamsStore = create<TeamsState>((set, get) => ({
  supported: hasTeamsBridge(),
  bootstrapped: false,
  configured: false,
  snapshot: null,
  daemon: null,
  teammates: [],
  tasks: [],
  error: null,
  pollTimer: null,
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  operations: defaultOperations,

  clearError: () => set({ error: null }),

  configure: async (input = {}) => {
    if (!hasTeamsBridge()) {
      set({ supported: false, bootstrapped: true, configured: false });
      return null;
    }

    const currentSnapshot = get().snapshot;
    const projectDir =
      normalizeProjectDir(input.projectDir)
      ?? currentSnapshot?.config.projectDir
      ?? await resolveDefaultProjectDir();
    const snapshot = await window.electron.teams.configure({
      baseUrl: input.baseUrl?.trim() || getApiBase(),
      apiKey: input.apiKey !== undefined ? input.apiKey : (getApiKey() || undefined),
      projectDir,
    });

    set({
      supported: true,
      bootstrapped: true,
      configured: snapshot.configured,
      snapshot,
      daemon: snapshot.daemon,
      error: null,
    });

    return snapshot;
  },

  bootstrap: async () => {
    setOperation(set, 'bootstrapping', true);
    try {
      await get().configure();
      const interval = await resolvePollInterval();
      set({ pollIntervalMs: interval });
    } catch (error) {
      set({
        supported: hasTeamsBridge(),
        bootstrapped: true,
        error: error instanceof Error ? error.message : 'Failed to bootstrap Teams runtime',
      });
    } finally {
      setOperation(set, 'bootstrapping', false);
    }
  },

  setProjectDir: async (projectDir) => {
    const nextProjectDir = normalizeProjectDir(projectDir);
    if (!nextProjectDir) {
      set({ error: 'Project directory is required' });
      return;
    }

    await get().configure({ projectDir: nextProjectDir });
    await get().refresh({ silent: true });
  },

  pickProjectDir: async () => {
    if (typeof window === 'undefined' || !window.electron?.selectDirectory) {
      return null;
    }

    const picked = await window.electron.selectDirectory();
    if (picked) {
      await get().setProjectDir(picked);
    }
    return picked;
  },

  refresh: async ({ silent = false, status }: RefreshOptions = {}) => {
    if (!hasTeamsBridge()) {
      set({ supported: false, bootstrapped: true });
      return;
    }

    if (!silent) {
      setOperation(set, 'refreshing', true);
    }

    try {
      const snapshot = await get().configure();
      const [daemon, teammates, tasks] = await Promise.all([
        window.electron.teams.getDaemonStatus(),
        window.electron.teams.listTeammates(),
        window.electron.teams.listTasks(status),
      ]);

      set({
        supported: true,
        configured: snapshot?.configured ?? get().configured,
        snapshot: snapshot
          ? { ...snapshot, daemon }
          : (get().snapshot ? { ...get().snapshot!, daemon } : null),
        daemon,
        teammates: sortTeammates(teammates),
        tasks: sortTasks(tasks),
        error: null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to refresh Teams data' });
    } finally {
      if (!silent) {
        setOperation(set, 'refreshing', false);
      }
    }
  },

  ensureDaemonRunning: async () => {
    if (!hasTeamsBridge()) {
      set({ supported: false, bootstrapped: true });
      return;
    }

    setOperation(set, 'ensuringDaemon', true);
    try {
      await get().configure();
      const daemon = await window.electron.teams.ensureDaemonRunning();
      const snapshot = get().snapshot;

      set({
        daemon,
        snapshot: snapshot ? { ...snapshot, daemon } : snapshot,
        error: null,
      });

      await get().refresh({ silent: true });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to start Teams daemon' });
    } finally {
      setOperation(set, 'ensuringDaemon', false);
    }
  },

  startPolling: async () => {
    if (!hasTeamsBridge() || get().pollTimer !== null) {
      return;
    }

    const interval = await resolvePollInterval();
    const timer = window.setInterval(() => {
      void get().refresh({ silent: true });
    }, interval);

    set({ pollTimer: timer, pollIntervalMs: interval });
  },

  stopPolling: () => {
    const timer = get().pollTimer;
    if (timer !== null) {
      window.clearInterval(timer);
    }
    set({ pollTimer: null });
  },

  spawnTeammate: async (input) => {
    setOperation(set, 'spawning', true);
    try {
      await get().configure();
      const teammate = await window.electron.teams.spawnTeammate(input);
      await get().refresh({ silent: true });
      return teammate;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to spawn teammate';
      set({ error: message });
      throw error;
    } finally {
      setOperation(set, 'spawning', false);
    }
  },

  forkTeammate: async (name, forkName) => {
    try {
      await get().configure();
      const teammate = await window.electron.teams.forkTeammate(name, forkName);
      await get().refresh({ silent: true });
      return teammate;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fork teammate';
      set({ error: message });
      throw error;
    }
  },

  reinitTeammate: async (name, prompt) => {
    try {
      await get().configure();
      const taskId = await window.electron.teams.reinitTeammate(name, prompt);
      await get().refresh({ silent: true });
      return taskId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reinitialize teammate';
      set({ error: message });
      throw error;
    }
  },

  dispatchTask: async (input) => {
    setOperation(set, 'dispatching', true);
    try {
      await get().configure();
      const dispatched = await window.electron.teams.dispatchTask(input);
      await get().refresh({ silent: true });
      return dispatched;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to dispatch task';
      set({ error: message });
      throw error;
    } finally {
      setOperation(set, 'dispatching', false);
    }
  },

  cancelTask: async (id) => {
    try {
      await get().configure();
      const task = await window.electron.teams.cancelTask(id);
      await get().refresh({ silent: true });
      return task;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel task';
      set({ error: message });
      throw error;
    }
  },
}));
