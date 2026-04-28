import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { DispatchTaskInput, SpawnTeammateInput } from 'letta-teams-sdk';
import { AlertCircle, FolderOpen, Play, RefreshCw, Send, Server, Users } from 'lucide-react';
import { Button } from './ui/primitives/Button';
import { Input } from './ui/primitives/Input';
import { SplitPaneDivider, SplitPaneGroup, SplitPanePanel } from './ui/layout/SplitPane';
import { isTaskActive, useTeamsStore } from '../store/useTeamsStore';
import { TeamsSidebar } from './teams/TeamsSidebar';
import { TeamsTaskDetail } from './teams/TeamsTaskDetail';
import { TeamsTeammateDetail } from './teams/TeamsTeammateDetail';
import { getReviewGateHelpText } from './teams/utils';

const daemonStatusClasses: Record<string, string> = {
  stopped: 'bg-slate-100 text-slate-700',
  starting: 'bg-amber-100 text-amber-700',
  running: 'bg-green-100 text-green-700',
  stopping: 'bg-orange-100 text-orange-700',
  crashed: 'bg-red-100 text-red-700',
};

export function TeamsView() {
  const supported = useTeamsStore((state) => state.supported);
  const bootstrapped = useTeamsStore((state) => state.bootstrapped);
  const configured = useTeamsStore((state) => state.configured);
  const snapshot = useTeamsStore((state) => state.snapshot);
  const daemon = useTeamsStore((state) => state.daemon);
  const teammates = useTeamsStore((state) => state.teammates);
  const tasks = useTeamsStore((state) => state.tasks);
  const trackedTaskIds = useTeamsStore((state) => state.trackedTaskIds);
  const selectedEntityType = useTeamsStore((state) => state.selectedEntityType);
  const selectedTaskId = useTeamsStore((state) => state.selectedTaskId);
  const selectedTeammateName = useTeamsStore((state) => state.selectedTeammateName);
  const taskFilter = useTeamsStore((state) => state.taskFilter);
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
  const selectTeammate = useTeamsStore((state) => state.selectTeammate);
  const selectTask = useTeamsStore((state) => state.selectTask);
  const setTaskFilter = useTeamsStore((state) => state.setTaskFilter);
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
    reviewEnabled: false,
    reviewer: '',
    reviewGate: 'on_success' as 'on_success' | 'always',
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
  const activeTaskCount = useMemo(() => tasks.filter((task) => isTaskActive(task)).length, [tasks]);
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );
  const selectedTeammate = useMemo(
    () => teammates.find((teammate) => teammate.name === selectedTeammateName) ?? null,
    [teammates, selectedTeammateName],
  );
  const reviewTargetOptions = useMemo(() => {
    const options = new Set<string>();

    teammates.forEach((teammate) => {
      options.add(teammate.name);
      teammate.targets?.forEach((target) => options.add(target.name));
    });

    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [teammates]);

  const handleApplyProjectDir = async () => {
    if (!projectDirInput.trim()) return;
    await setProjectDir(projectDirInput);
  };

  const handleSpawn = async (event: FormEvent) => {
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

    const teammate = await spawnTeammate(input);
    setSpawnForm((current) => ({ ...current, name: '', role: '', model: '' }));
    setDispatchForm((current) => ({ ...current, target: current.target || teammate.name }));
  };

  const handleDispatch = async (event: FormEvent) => {
    event.preventDefault();

    const target = dispatchForm.target.trim();
    const message = dispatchForm.message.trim();
    const reviewer = dispatchForm.reviewer.trim();

    const input: DispatchTaskInput = {
      target,
      message,
    };

    if (!input.target || !input.message) {
      return;
    }

    if (dispatchForm.reviewEnabled) {
      if (!reviewer) {
        return;
      }

      input.options = {
        pipelineId: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? `pipeline-${crypto.randomUUID()}`
          : `pipeline-${Date.now()}`,
        review: {
          reviewer,
          gate: dispatchForm.reviewGate,
          assignments: [
            {
              name: target,
              message,
            },
          ],
        },
      };
    }

    await dispatchTask(input);
    setDispatchForm((current) => ({ ...current, message: '' }));
  };

  const handleDispatchTarget = (target: string) => {
    setDispatchForm((current) => ({ ...current, target }));
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
                    Monitoring {teammates.length} teammates and {tasks.length} tasks with a live cadence of {Math.round(pollIntervalMs / 1000)}s.
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
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Active tasks</dt>
                  <dd className="mt-1 text-sm text-ink-900">{activeTaskCount}</dd>
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

        <div className="grid gap-6 xl:grid-cols-2">
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

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Model (optional)</label>
                  <Input
                    value={spawnForm.model}
                    onChange={(event) => setSpawnForm((current) => ({ ...current, model: event.target.value }))}
                    placeholder="anthropic/claude-sonnet-4"
                  />
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-ink-900/10 bg-surface-cream px-3 py-2 text-sm text-ink-700 md:self-end">
                  <input
                    type="checkbox"
                    checked={spawnForm.memfsEnabled}
                    onChange={(event) => setSpawnForm((current) => ({ ...current, memfsEnabled: event.target.checked }))}
                    className="h-4 w-4 rounded border-ink-900/20 text-accent focus:ring-accent/50"
                  />
                  Enable memfs
                </label>
              </div>

              <Button type="submit" className="w-full" isLoading={operations.spawning} disabled={!configured}>
                Spawn teammate
              </Button>
            </form>
          </section>

          <section className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-4 w-4 text-accent" />
              <h3 className="text-base font-semibold text-ink-900">Dispatch task</h3>
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

              <div className="rounded-xl border border-ink-900/10 bg-surface-cream/70 p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
                  <input
                    type="checkbox"
                    checked={dispatchForm.reviewEnabled}
                    onChange={(event) => setDispatchForm((current) => ({
                      ...current,
                      reviewEnabled: event.target.checked,
                      reviewer: event.target.checked ? current.reviewer : '',
                    }))}
                    className="h-4 w-4 rounded border-ink-900/20 text-accent focus:ring-accent/50"
                  />
                  Require review for this dispatch
                </label>

                {dispatchForm.reviewEnabled && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Reviewer</label>
                      <select
                        value={dispatchForm.reviewer}
                        onChange={(event) => setDispatchForm((current) => ({ ...current, reviewer: event.target.value }))}
                        className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-accent/50"
                      >
                        <option value="">Select reviewer</option>
                        {reviewTargetOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Review gate</label>
                      <select
                        value={dispatchForm.reviewGate}
                        onChange={(event) => setDispatchForm((current) => ({
                          ...current,
                          reviewGate: event.target.value as 'on_success' | 'always',
                        }))}
                        className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-accent/50"
                      >
                        <option value="on_success">Review on success</option>
                        <option value="always">Always review</option>
                      </select>
                    </div>

                    <p className="text-xs text-ink-600">
                      {getReviewGateHelpText(dispatchForm.reviewGate)}
                    </p>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" isLoading={operations.dispatching} disabled={!configured}>
                {dispatchForm.reviewEnabled ? 'Dispatch with review' : 'Dispatch task'}
              </Button>
            </form>
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-ink-900/10 bg-white/80 shadow-sm backdrop-blur-sm">
          <div className="border-b border-ink-900/10 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink-900">Task monitoring</h3>
                <p className="text-sm text-ink-600">
                  Track active work, inspect teammate execution state, and follow task outcomes in one place.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-surface-cream px-2.5 py-1 font-medium text-ink-600">
                  {trackedTaskIds.length} live follows
                </span>
                <span className="rounded-full bg-surface-cream px-2.5 py-1 font-medium text-ink-600">
                  {activeTaskCount} active tasks
                </span>
              </div>
            </div>
          </div>

          <div className="h-[760px]">
            <SplitPaneGroup orientation="horizontal" defaultLayout={[34, 66]} storageKey="teams-monitoring-pane">
              <SplitPanePanel minSize={28} defaultSize={34}>
                <TeamsSidebar
                  teammates={teammates}
                  tasks={tasks}
                  trackedTaskIds={trackedTaskIds}
                  selectedEntityType={selectedEntityType}
                  selectedTaskId={selectedTaskId}
                  selectedTeammateName={selectedTeammateName}
                  taskFilter={taskFilter}
                  onSelectTeammate={selectTeammate}
                  onSelectTask={selectTask}
                  onSetTaskFilter={setTaskFilter}
                  onDispatchTarget={handleDispatchTarget}
                />
              </SplitPanePanel>
              <SplitPaneDivider orientation="horizontal" />
              <SplitPanePanel minSize={40} defaultSize={66}>
                {selectedEntityType === 'task' && selectedTask ? (
                  <TeamsTaskDetail
                    task={selectedTask}
                    allTasks={tasks}
                    tracked={trackedTaskIds.includes(selectedTask.id)}
                    onCancel={(id) => void cancelTask(id)}
                    onSelectTeammate={selectTeammate}
                    onSelectTask={selectTask}
                  />
                ) : selectedTeammate ? (
                  <TeamsTeammateDetail
                    teammate={selectedTeammate}
                    onFork={(name) => void handleFork(name)}
                    onReinit={(name) => void handleReinit(name)}
                    onDispatchTarget={handleDispatchTarget}
                    onSelectTask={selectTask}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-surface px-6 py-10 text-center">
                    <div className="max-w-md space-y-3">
                      <h4 className="text-lg font-semibold text-ink-900">Nothing selected yet</h4>
                      <p className="text-sm text-ink-600">
                        Pick a teammate or task from the left pane to inspect its live state.
                      </p>
                    </div>
                  </div>
                )}
              </SplitPanePanel>
            </SplitPaneGroup>
          </div>
        </section>
      </div>
    </div>
  );
}

export default TeamsView;
