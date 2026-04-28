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

const ACTIVE_TASK_STATUSES = new Set<TaskStatus>([
  'pending',
  'running',
  'pending_review',
  'reviewing',
]);

const COMPLETED_TASK_STATUSES = new Set<TaskStatus>(['done', 'approved']);
const FAILED_TASK_STATUSES = new Set<TaskStatus>(['error', 'rejected']);

const followTokens = new Map<string, number>();

export type TeamsSelectionType = 'task' | 'teammate' | null;
export type TeamsTaskFilter = 'all' | 'active' | 'review' | 'completed' | 'failed';

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
  teammates: TeammateState[];
  tasks: TaskState[];
  error: string | null;
  pollingEnabled: boolean;
  pollTimer: number | null;
  basePollIntervalMs: number;
  pollIntervalMs: number;
  selectedEntityType: TeamsSelectionType;
  selectedTaskId: string | null;
  selectedTeammateName: string | null;
  taskFilter: TeamsTaskFilter;
  trackedTaskIds: string[];
  operations: TeamsOperationState;
  clearError: () => void;
  bootstrap: () => Promise<void>;
  configure: (input?: Partial<TeamsRuntimeConfig>) => Promise<TeamsRuntimeSnapshot | null>;
  setProjectDir: (projectDir: string) => Promise<void>;
  pickProjectDir: () => Promise<string | null>;
  refresh: (options?: RefreshOptions) => Promise<void>;
  refreshSelected: () => Promise<void>;
  ensureDaemonRunning: () => Promise<void>;
  startPolling: () => Promise<void>;
  stopPolling: () => void;
  selectTeammate: (name: string) => void;
  selectTask: (id: string) => void;
  setTaskFilter: (filter: TeamsTaskFilter) => void;
  followTask: (id: string) => void;
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

function sortTeammates(teammates: TeammateState[]): TeammateState[] {
  return [...teammates].sort((a, b) => a.name.localeCompare(b.name));
}

function sortTasks(tasks: TaskState[]): TaskState[] {
  return [...tasks].sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    return bTime - aTime;
  });
}

function upsertTask(tasks: TaskState[], task: TaskState): TaskState[] {
  return sortTasks([...tasks.filter((item) => item.id !== task.id), task]);
}

function upsertTeammate(teammates: TeammateState[], teammate: TeammateState): TeammateState[] {
  return sortTeammates([...teammates.filter((item) => item.name !== teammate.name), teammate]);
}

function getDefaultTask(tasks: TaskState[]): TaskState | undefined {
  return tasks.find((task) => ACTIVE_TASK_STATUSES.has(task.status)) ?? tasks[0];
}

function getDesiredPollInterval(state: Pick<TeamsState, 'tasks' | 'trackedTaskIds' | 'basePollIntervalMs'>): number {
  const hasActiveTasks = state.tasks.some((task) => ACTIVE_TASK_STATUSES.has(task.status));
  return hasActiveTasks || state.trackedTaskIds.length > 0
    ? MIN_POLL_INTERVAL_MS
    : state.basePollIntervalMs;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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

function clearPollTimer(
  set: (partial: Partial<TeamsState> | ((state: TeamsState) => Partial<TeamsState>)) => void,
  get: () => TeamsState,
) {
  const timer = get().pollTimer;
  if (timer !== null && typeof window !== 'undefined') {
    window.clearTimeout(timer);
  }
  set({ pollTimer: null });
}

function reconcileSelection(state: TeamsState, teammates: TeammateState[], tasks: TaskState[]) {
  let selectedEntityType = state.selectedEntityType;
  let selectedTaskId = state.selectedTaskId && tasks.some((task) => task.id === state.selectedTaskId)
    ? state.selectedTaskId
    : null;
  let selectedTeammateName = state.selectedTeammateName && teammates.some((teammate) => teammate.name === state.selectedTeammateName)
    ? state.selectedTeammateName
    : null;

  const defaultTask = getDefaultTask(tasks);
  const defaultTeammate = teammates[0];

  if (selectedTaskId && !selectedTeammateName) {
    selectedTeammateName = tasks.find((task) => task.id === selectedTaskId)?.teammateName ?? null;
  }

  if (selectedEntityType === 'task' && !selectedTaskId) {
    if (selectedTeammateName) {
      selectedEntityType = 'teammate';
    } else if (defaultTask) {
      selectedEntityType = 'task';
      selectedTaskId = defaultTask.id;
      selectedTeammateName = defaultTask.teammateName;
    } else if (defaultTeammate) {
      selectedEntityType = 'teammate';
      selectedTeammateName = defaultTeammate.name;
    } else {
      selectedEntityType = null;
    }
  }

  if (selectedEntityType === 'teammate' && !selectedTeammateName) {
    if (selectedTaskId) {
      selectedEntityType = 'task';
      selectedTeammateName = tasks.find((task) => task.id === selectedTaskId)?.teammateName ?? null;
    } else if (defaultTask) {
      selectedEntityType = 'task';
      selectedTaskId = defaultTask.id;
      selectedTeammateName = defaultTask.teammateName;
    } else if (defaultTeammate) {
      selectedEntityType = 'teammate';
      selectedTeammateName = defaultTeammate.name;
    } else {
      selectedEntityType = null;
    }
  }

  if (!selectedEntityType) {
    if (defaultTask) {
      selectedEntityType = 'task';
      selectedTaskId = defaultTask.id;
      selectedTeammateName = defaultTask.teammateName;
    } else if (defaultTeammate) {
      selectedEntityType = 'teammate';
      selectedTeammateName = defaultTeammate.name;
    }
  }

  return {
    selectedEntityType,
    selectedTaskId,
    selectedTeammateName,
    trackedTaskIds: state.trackedTaskIds.filter((id) => {
      const task = tasks.find((item) => item.id === id);
      return !!task && ACTIVE_TASK_STATUSES.has(task.status);
    }),
  };
}

function scheduleNextPoll(
  set: (partial: Partial<TeamsState> | ((state: TeamsState) => Partial<TeamsState>)) => void,
  get: () => TeamsState,
) {
  if (typeof window === 'undefined' || !get().pollingEnabled) {
    return;
  }

  clearPollTimer(set, get);

  const interval = getDesiredPollInterval(get());
  const timer = window.setTimeout(async () => {
    try {
      await get().refresh({ silent: true });
    } finally {
      scheduleNextPoll(set, get);
    }
  }, interval);

  set({ pollTimer: timer, pollIntervalMs: interval });
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

function beginTaskFollow(
  taskId: string,
  set: (partial: Partial<TeamsState> | ((state: TeamsState) => Partial<TeamsState>)) => void,
  get: () => TeamsState,
) {
  if (!hasTeamsBridge() || !taskId) {
    return;
  }

  const nextToken = (followTokens.get(taskId) ?? 0) + 1;
  followTokens.set(taskId, nextToken);

  set((state) => ({
    selectedEntityType: 'task',
    selectedTaskId: taskId,
    trackedTaskIds: state.trackedTaskIds.includes(taskId)
      ? state.trackedTaskIds
      : [taskId, ...state.trackedTaskIds],
  }));

  if (get().pollingEnabled) {
    scheduleNextPoll(set, get);
  }

  void (async () => {
    try {
      await window.electron.teams.waitForTask(taskId);
    } catch {
      // Silent here: the follow flow is best-effort and the next refresh will surface any error state.
    }

    if (followTokens.get(taskId) !== nextToken) {
      return;
    }

    followTokens.delete(taskId);
    set((state) => ({
      trackedTaskIds: state.trackedTaskIds.filter((id) => id !== taskId),
    }));

    await get().refresh({ silent: true });
    await get().refreshSelected();

    if (get().pollingEnabled) {
      scheduleNextPoll(set, get);
    }
  })();
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
  pollingEnabled: false,
  pollTimer: null,
  basePollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  selectedEntityType: null,
  selectedTaskId: null,
  selectedTeammateName: null,
  taskFilter: 'all',
  trackedTaskIds: [],
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
      set({
        basePollIntervalMs: interval,
        pollIntervalMs: interval,
      });
    } catch (error) {
      set({
        supported: hasTeamsBridge(),
        bootstrapped: true,
        error: getErrorMessage(error, 'Failed to bootstrap Teams runtime'),
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

      const nextTeammates = sortTeammates(teammates);
      const nextTasks = sortTasks(tasks);
      const currentState = get();
      const selection = reconcileSelection(currentState, nextTeammates, nextTasks);

      set({
        supported: true,
        configured: snapshot?.configured ?? currentState.configured,
        snapshot: snapshot
          ? { ...snapshot, daemon }
          : (currentState.snapshot ? { ...currentState.snapshot, daemon } : null),
        daemon,
        teammates: nextTeammates,
        tasks: nextTasks,
        error: null,
        selectedEntityType: selection.selectedEntityType,
        selectedTaskId: selection.selectedTaskId,
        selectedTeammateName: selection.selectedTeammateName,
        trackedTaskIds: selection.trackedTaskIds,
        pollIntervalMs: getDesiredPollInterval({
          tasks: nextTasks,
          trackedTaskIds: selection.trackedTaskIds,
          basePollIntervalMs: currentState.basePollIntervalMs,
        }),
      });
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to refresh Teams data') });
    } finally {
      if (!silent) {
        setOperation(set, 'refreshing', false);
      }
    }
  },

  refreshSelected: async () => {
    if (!hasTeamsBridge()) {
      return;
    }

    const state = get();

    try {
      if (state.selectedTaskId) {
        const task = await window.electron.teams.getTask(state.selectedTaskId);
        if (task) {
          set((current) => ({
            tasks: upsertTask(current.tasks, task),
            selectedTeammateName: task.teammateName || current.selectedTeammateName,
          }));
        }
      }

      if (state.selectedTeammateName) {
        const teammate = await window.electron.teams.getTeammate(state.selectedTeammateName);
        if (teammate) {
          set((current) => ({
            teammates: upsertTeammate(current.teammates, teammate),
          }));
        }
      }
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to refresh selected Teams item') });
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
      set({ error: getErrorMessage(error, 'Failed to start Teams daemon') });
    } finally {
      setOperation(set, 'ensuringDaemon', false);
    }
  },

  startPolling: async () => {
    if (!hasTeamsBridge() || get().pollingEnabled) {
      return;
    }

    const interval = await resolvePollInterval();
    set({
      pollingEnabled: true,
      basePollIntervalMs: interval,
      pollIntervalMs: interval,
    });
    scheduleNextPoll(set, get);
  },

  stopPolling: () => {
    clearPollTimer(set, get);
    set((state) => ({
      pollingEnabled: false,
      pollIntervalMs: state.basePollIntervalMs,
    }));
  },

  selectTeammate: (name) => {
    set({
      selectedEntityType: 'teammate',
      selectedTeammateName: name,
    });
    void get().refreshSelected();
  },

  selectTask: (id) => {
    const task = get().tasks.find((item) => item.id === id);
    set({
      selectedEntityType: 'task',
      selectedTaskId: id,
      selectedTeammateName: task?.teammateName ?? get().selectedTeammateName,
    });
    void get().refreshSelected();
  },

  setTaskFilter: (filter) => set({ taskFilter: filter }),

  followTask: (id) => {
    beginTaskFollow(id, set, get);
  },

  spawnTeammate: async (input) => {
    setOperation(set, 'spawning', true);

    try {
      await get().configure();
      const teammate = await window.electron.teams.spawnTeammate(input);
      set({
        selectedEntityType: 'teammate',
        selectedTeammateName: teammate.name,
      });
      await get().refresh({ silent: true });

      if (teammate.initTaskId) {
        get().followTask(teammate.initTaskId);
      }

      return teammate;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to spawn teammate');
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
      set({
        selectedEntityType: 'teammate',
        selectedTeammateName: teammate.name,
      });
      await get().refresh({ silent: true });
      return teammate;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to fork teammate');
      set({ error: message });
      throw error;
    }
  },

  reinitTeammate: async (name, prompt) => {
    try {
      await get().configure();
      const taskId = await window.electron.teams.reinitTeammate(name, prompt);
      set({
        selectedEntityType: 'task',
        selectedTaskId: taskId,
        selectedTeammateName: name,
      });
      get().followTask(taskId);
      await get().refresh({ silent: true });
      return taskId;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to reinitialize teammate');
      set({ error: message });
      throw error;
    }
  },

  dispatchTask: async (input) => {
    setOperation(set, 'dispatching', true);

    try {
      await get().configure();
      const dispatched = await window.electron.teams.dispatchTask(input);
      set({
        selectedEntityType: 'task',
        selectedTaskId: dispatched.taskId,
        selectedTeammateName: input.target.split('/')[0] || get().selectedTeammateName,
      });
      get().followTask(dispatched.taskId);
      await get().refresh({ silent: true });
      return dispatched;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to dispatch task');
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
      followTokens.delete(id);
      set((state) => ({
        trackedTaskIds: state.trackedTaskIds.filter((item) => item !== id),
      }));
      await get().refresh({ silent: true });
      return task;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to cancel task');
      set({ error: message });
      throw error;
    }
  },
}));

export function isTaskActive(task: TaskState): boolean {
  return ACTIVE_TASK_STATUSES.has(task.status);
}

export function isTaskCompleted(task: TaskState): boolean {
  return COMPLETED_TASK_STATUSES.has(task.status);
}

export function isTaskFailed(task: TaskState): boolean {
  return FAILED_TASK_STATUSES.has(task.status);
}
