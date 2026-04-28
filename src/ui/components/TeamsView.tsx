import { useEffect, useMemo, useState } from 'react';
import type { DispatchTaskInput, SpawnTeammateInput } from 'letta-teams-sdk';
import {
  AlertCircle,
  Bot,
  FolderOpen,
  GitFork,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  Square,
  Users,
} from 'lucide-react';
import { Button } from './ui/primitives/Button';
import { Input } from './ui/primitives/Input';
import { useTeamsStore } from '../store/useTeamsStore';

const teammateStatusClasses: Record<string, string> = {
  idle: 'bg-slate-100 text-slate-700',
  working: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

const taskStatusClasses: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  running: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
  pending_review: 'bg-purple-100 text-purple-700',
  reviewing: 'bg-purple-100 text-purple-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

const daemonStatusClasses: Record<string, string> = {
  stopped: 'bg-slate-100 text-slate-700',
  starting: 'bg-amber-100 text-amber-700',
  running: 'bg-green-100 text-green-700',
  stopping: 'bg-orange-100 text-orange-700',
  crashed: 'bg-red-100 text-red-700',
};

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatTaskPreview(task: TeamsTaskState): string {
  if (task.error) return task.error;
  if (task.result) return task.result;
  return task.message;
}

export function TeamsView() {
  const supported = useTeamsStore((state) => state.supported);
  const bootstrapped = useTeamsStore((state) => state.bootstrapped);
  const configured = useTeamsStore((state) => state.configured);
  const snapshot = useTeamsStore((state) => state.snapshot);
  const daemon = useTeamsStore((state) => state.daemon);
  const teammates = useTeamsStore((state) => state.teammates);
  const tasks = useTeamsStore((state) => state.tasks);
  const error = useTeamsStore((state) => state.error);
  const operations = useTeamsStore((state) => state.operations);
  const pollIntervalMs = useTeamsStore((state) => state.pollIntervalMs);
  const clearError = useTeamsStore((state) => state.clearError);
  const bootstrap = useTeamsStore((state) => state.bootstrap);
  const refresh = useTeamsStore((state) => state.refresh);
  const ensureDaemonRunning = useTeamsStore((state) => state.ensureDaemonRunning);
  const setProjectDir = useTeamsStore((state) => state.setProjectDir);
  const pickProjectDir = useTeamsStore((state) => state.pickProjectDir);
  const startPolling = useTeamsStore((state) => state.startPolling);
  const stopPolling = useTeamsStore((state) => state.stopPolling);
  const spawnTeammate = useTeamsStore((state) => state.spawnTeammate);
  const forkTeammate = useTeamsStore((state) => state.forkTeammate);
  const reinitTeammate = useTeamsStore((state) => state.reinitTeammate);
  const dispatchTask = useTeamsStore((state) => state.dispatchTask);
  const cancelTask = useTeamsStore((state) => state.cancelTask);

  const [projectDirInput, setProjectDirInput] = useState('');
  const [spawnForm, setSpawnForm] = useState({
    name: '',
    role: '',
    model: '',
    memfsEnabled: false,
  });
  const [dispatchForm, setDispatchForm] = useState({
    target: '',
    message: '',
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await bootstrap();
      if (cancelled) return;
      await refresh();
      if (cancelled) return;
      await startPolling();
    })();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [bootstrap, refresh, startPolling, stopPolling]);

  useEffect(() => {
    setProjectDirInput(snapshot?.config.projectDir ?? '');
  }, [snapshot?.config.projectDir]);

  const daemonStatus = daemon?.status ?? 'stopped';
  const daemonClassName = daemonStatusClasses[daemonStatus] ?? daemonStatusClasses.stopped;

  const recentTasks = useMemo(() => tasks.slice(0, 12), [tasks]);

  const handleApplyProjectDir = async () => {
    if (!projectDirInput.trim()) return;
    await setProjectDir(projectDirInput);
  };

  const handleSpawn = async (event: React.FormEvent) => {
    event.preventDefault();

    const input: SpawnTeammateInput = {
      name: spawnForm.name.trim(),
      role: spawnForm.role.trim(),
      model: spawnForm.model.trim() || undefined,
      memfsEnabled: spawnForm.memfsEnabled,
    };

    if (!input.name || !input.role) {
      return;
    }

    await spawnTeammate(input);
    setSpawnForm({ name: '', role: '', model: '', memfsEnabled: spawnForm.memfsEnabled });
  };

  const handleDispatch = async (event: React.FormEvent) => {
    event.preventDefault();

    const input: DispatchTaskInput = {
      target: dispatchForm.target.trim(),
      message: dispatchForm.message.trim(),
    };

    if (!input.target || !input.message) {
      return;
    }

    await dispatchTask(input);
    setDispatchForm((current) => ({ ...current, message: '' }));
  };

  const handleFork = async (name: string) => {
    const forkName = window.prompt(`Fork ${name} as:`, `${name}-memory`)?.trim();
    if (!forkName) return;
    await forkTeammate(name, forkName);
  };

  const handleReinit = async (name: string) => {
    const prompt = window.prompt(`Optional reinit prompt for ${name}:`, '')?.trim();
    await reinitTeammate(name, prompt || undefined);
  };

  if (bootstrapped && !supported) {
    return (
      <div className="h-full bg-surface px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5" />
            <div>
              <h2 className="text-lg font-semibold">Teams is only available in Electron</h2>
              <p className="mt-2 text-sm text-amber-800">
                The Teams runtime depends on the Electron main-process IPC bridge. Open this app in the desktop shell to manage teammates and tasks.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-surface px-6 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink-900">Runtime</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${daemonClassName}`}>
                      {daemonStatus}
                    </span>
                  </div>
                  <p className="text-sm text-ink-600">
                    Configure the project directory, keep the daemon alive, and poll teammate/task state every {Math.round(pollIntervalMs / 1000)}s.
                  </p>
                </div>
              </div>

              <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Base URL</dt>
                  <dd className="mt-1 break-all text-sm text-ink-900">{snapshot?.config.baseUrl ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Port</dt>
                  <dd className="mt-1 text-sm text-ink-900">{daemon?.port ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">PID</dt>
                  <dd className="mt-1 text-sm text-ink-900">{daemon?.pid ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Log path</dt>
                  <dd className="mt-1 break-all text-sm text-ink-900">{daemon?.logPath ?? '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="flex min-w-0 flex-col gap-3 xl:w-[420px]">
              <label className="text-xs font-medium uppercase tracking-wide text-ink-500">Project directory</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={projectDirInput}
                  onChange={(event) => setProjectDirInput(event.target.value)}
                  placeholder="C:/path/to/project"
                />
                <div className="flex gap-2">
                  <Button variant="secondary" size="md" onClick={() => void pickProjectDir()} leftIcon={FolderOpen}>
                    Browse
                  </Button>
                  <Button variant="secondary" size="md" onClick={() => void handleApplyProjectDir()}>
                    Apply
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  leftIcon={Play}
                  onClick={() => void ensureDaemonRunning()}
                  isLoading={operations.ensuringDaemon}
                >
                  Start daemon
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={RefreshCw}
                  onClick={() => void refresh()}
                  isLoading={operations.refreshing || operations.bootstrapping}
                >
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
              <button className="text-red-700 hover:text-red-900" onClick={clearError}>
                Dismiss
              </button>
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <h3 className="text-base font-semibold text-ink-900">Spawn teammate</h3>
            </div>

            <form className="space-y-3" onSubmit={handleSpawn}>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Name</label>
                <Input
                  value={spawnForm.name}
                  onChange={(event) => setSpawnForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="researcher"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Role</label>
                <textarea
                  value={spawnForm.role}
                  onChange={(event) => setSpawnForm((current) => ({ ...current, role: event.target.value }))}
                  placeholder="Investigates implementation details and reports findings."
                  className="min-h-24 w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-accent/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Model (optional)</label>
                <Input
                  value={spawnForm.model}
                  onChange={(event) => setSpawnForm((current) => ({ ...current, model: event.target.value }))}
                  placeholder="anthropic/claude-sonnet-4"
                />
              </div>

              <label className="flex items-center gap-2 rounded-lg border border-ink-900/10 bg-surface-cream px-3 py-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={spawnForm.memfsEnabled}
                  onChange={(event) => setSpawnForm((current) => ({ ...current, memfsEnabled: event.target.checked }))}
                  className="h-4 w-4 rounded border-ink-900/20 text-accent focus:ring-accent/50"
                />
                Enable memfs for this teammate
              </label>

              <Button type="submit" className="w-full" isLoading={operations.spawning} disabled={!configured}>
                Spawn teammate
              </Button>
            </form>
          </section>

          <section className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent" />
                <h3 className="text-base font-semibold text-ink-900">Teammates</h3>
              </div>
              <span className="rounded-full bg-surface-cream px-2.5 py-1 text-xs font-medium text-ink-600">
                {teammates.length}
              </span>
            </div>

            <div className="space-y-3">
              {teammates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-900/15 bg-surface-cream px-4 py-6 text-sm text-ink-600">
                  No teammates yet. Spawn one to start dispatching work.
                </div>
              ) : (
                teammates.map((teammate) => {
                  const statusClassName = teammateStatusClasses[teammate.status] ?? teammateStatusClasses.idle;

                  return (
                    <div key={teammate.name} className="rounded-xl border border-ink-900/10 bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-ink-900">{teammate.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClassName}`}>
                              {teammate.status}
                            </span>
                            {teammate.memfsEnabled && (
                              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                                memfs
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-ink-600">{teammate.role}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" leftIcon={Send} onClick={() => setDispatchForm((current) => ({ ...current, target: teammate.name }))}>
                            Target
                          </Button>
                          <Button size="sm" variant="secondary" leftIcon={GitFork} onClick={() => void handleFork(teammate.name)}>
                            Fork
                          </Button>
                          <Button size="sm" variant="secondary" leftIcon={RotateCcw} onClick={() => void handleReinit(teammate.name)}>
                            Reinit
                          </Button>
                        </div>
                      </div>

                      <dl className="mt-3 grid gap-3 text-xs text-ink-600 sm:grid-cols-2">
                        <div>
                          <dt className="font-medium uppercase tracking-wide text-ink-500">Agent ID</dt>
                          <dd className="mt-1 break-all text-ink-800">{teammate.agentId}</dd>
                        </div>
                        <div>
                          <dt className="font-medium uppercase tracking-wide text-ink-500">Model</dt>
                          <dd className="mt-1 break-all text-ink-800">{teammate.model ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium uppercase tracking-wide text-ink-500">Targets</dt>
                          <dd className="mt-1 text-ink-800">{teammate.targets?.length ?? 0}</dd>
                        </div>
                        <div>
                          <dt className="font-medium uppercase tracking-wide text-ink-500">Updated</dt>
                          <dd className="mt-1 text-ink-800">{formatTimestamp(teammate.lastUpdated)}</dd>
                        </div>
                      </dl>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-4 w-4 text-accent" />
              <h3 className="text-base font-semibold text-ink-900">Dispatch & tasks</h3>
            </div>

            <form className="space-y-3" onSubmit={handleDispatch}>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Target</label>
                <Input
                  value={dispatchForm.target}
                  onChange={(event) => setDispatchForm((current) => ({ ...current, target: event.target.value }))}
                  placeholder="researcher or researcher/memory"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Message</label>
                <textarea
                  value={dispatchForm.message}
                  onChange={(event) => setDispatchForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Investigate why the build is failing and report back with root cause."
                  className="min-h-28 w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <Button type="submit" className="w-full" isLoading={operations.dispatching} disabled={!configured}>
                Dispatch task
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-ink-900">Recent tasks</h4>
                <span className="rounded-full bg-surface-cream px-2.5 py-1 text-xs font-medium text-ink-600">
                  {tasks.length}
                </span>
              </div>

              {recentTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-900/15 bg-surface-cream px-4 py-6 text-sm text-ink-600">
                  No tasks yet. Dispatch work to a teammate to populate the queue.
                </div>
              ) : (
                recentTasks.map((task) => {
                  const statusClassName = taskStatusClasses[task.status] ?? taskStatusClasses.pending;
                  const canCancel = task.status === 'pending' || task.status === 'running';

                  return (
                    <div key={task.id} className="rounded-xl border border-ink-900/10 bg-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-ink-900">{task.targetName ?? task.teammateName}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClassName}`}>
                              {task.status}
                            </span>
                          </div>
                          <p className="mt-1 break-all text-xs text-ink-500">{task.id}</p>
                        </div>
                        {canCancel && (
                          <Button size="sm" variant="ghost" leftIcon={Square} onClick={() => void cancelTask(task.id)}>
                            Cancel
                          </Button>
                        )}
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm text-ink-700">{formatTaskPreview(task)}</p>

                      <dl className="mt-3 grid gap-3 text-xs text-ink-600 sm:grid-cols-2">
                        <div>
                          <dt className="font-medium uppercase tracking-wide text-ink-500">Created</dt>
                          <dd className="mt-1 text-ink-800">{formatTimestamp(task.createdAt)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium uppercase tracking-wide text-ink-500">Completed</dt>
                          <dd className="mt-1 text-ink-800">{formatTimestamp(task.completedAt)}</dd>
                        </div>
                      </dl>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TeamsView;
