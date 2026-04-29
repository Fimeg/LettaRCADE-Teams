import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { DispatchTaskInput, SpawnTeammateInput } from 'letta-teams/types';
import { AlertCircle, FolderOpen, Play, RefreshCw, Send, Server, Users } from 'lucide-react';
import { Button } from './ui/primitives/Button';
import { Input } from './ui/primitives/Input';
import { FormField } from './ui/composites/FormField';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from './ui/composites/Modal';
import { SplitPaneDivider, SplitPaneGroup, SplitPanePanel } from './ui/layout/SplitPane';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/layout/Tabs';
import { isTaskActive, useTeamsStore } from '../store/useTeamsStore';
import { TeamsSidebar } from './teams/TeamsSidebar';
import { TeamsTaskDetail } from './teams/TeamsTaskDetail';
import { TeamsTeammateDetail } from './teams/TeamsTeammateDetail';
import TeamsCouncilsView from './teams/TeamsCouncilsView';
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
  const teamsViewMode = useTeamsStore((state) => state.teamsViewMode);
  const councilSessions = useTeamsStore((state) => state.councilSessions);
  const selectedCouncilSessionId = useTeamsStore((state) => state.selectedCouncilSessionId);
  const selectedCouncilSessionDetail = useTeamsStore((state) => state.selectedCouncilSessionDetail);
  const error = useTeamsStore((state) => state.error);
  const operations = useTeamsStore((state) => state.operations);
  const pollIntervalMs = useTeamsStore((state) => state.pollIntervalMs);
  const clearError = useTeamsStore((state) => state.clearError);
  const bootstrap = useTeamsStore((state) => state.bootstrap);
  const refresh = useTeamsStore((state) => state.refresh);
  const refreshCouncils = useTeamsStore((state) => state.refreshCouncils);
  const ensureDaemonRunning = useTeamsStore((state) => state.ensureDaemonRunning);
  const setProjectDir = useTeamsStore((state) => state.setProjectDir);
  const pickProjectDir = useTeamsStore((state) => state.pickProjectDir);
  const startPolling = useTeamsStore((state) => state.startPolling);
  const stopPolling = useTeamsStore((state) => state.stopPolling);
  const setTeamsViewMode = useTeamsStore((state) => state.setTeamsViewMode);
  const selectTeammate = useTeamsStore((state) => state.selectTeammate);
  const selectTask = useTeamsStore((state) => state.selectTask);
  const setTaskFilter = useTeamsStore((state) => state.setTaskFilter);
  const selectCouncilSession = useTeamsStore((state) => state.selectCouncilSession);
  const spawnTeammate = useTeamsStore((state) => state.spawnTeammate);
  const forkTeammate = useTeamsStore((state) => state.forkTeammate);
  const reinitTeammate = useTeamsStore((state) => state.reinitTeammate);
  const dispatchTask = useTeamsStore((state) => state.dispatchTask);
  const startCouncil = useTeamsStore((state) => state.startCouncil);
  const cancelTask = useTeamsStore((state) => state.cancelTask);

  const [projectDirInput, setProjectDirInput] = useState('');
  const [spawnForm, setSpawnForm] = useState({
    name: '',
    role: '',
    model: '',
    memfsEnabled: false,
  });
  const [spawnErrors, setSpawnErrors] = useState<{ name?: string; role?: string }>({});
  const [dispatchForm, setDispatchForm] = useState({
    target: '',
    message: '',
    reviewEnabled: false,
    reviewer: '',
    reviewGate: 'on_success' as 'on_success' | 'always',
  });
  const [dispatchErrors, setDispatchErrors] = useState<{ target?: string; message?: string; reviewer?: string }>({});
  const [forkModal, setForkModal] = useState<{ name: string; forkName: string } | null>(null);
  const [reinitModal, setReinitModal] = useState<{ name: string; prompt: string } | null>(null);

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

  useEffect(() => {
    if (teamsViewMode === 'councils') {
      void refreshCouncils({ silent: councilSessions.length > 0 });
    }
  }, [teamsViewMode, refreshCouncils]);

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
    setSpawnErrors({});

    const name = spawnForm.name.trim();
    const role = spawnForm.role.trim();

    const errors: { name?: string; role?: string } = {};
    if (!name) errors.name = 'Teammate name is required';
    if (!role) errors.role = 'Teammate role is required';

    if (Object.keys(errors).length > 0) {
      setSpawnErrors(errors);
      return;
    }

    const input: SpawnTeammateInput = { name, role, model: spawnForm.model.trim() || undefined, memfsEnabled: spawnForm.memfsEnabled };
    const teammate = await spawnTeammate(input);
    setSpawnForm((current) => ({ ...current, name: '', role: '', model: '' }));
    setSpawnErrors({});
    setDispatchForm((current) => ({ ...current, target: current.target || teammate.name }));
  };

  const handleDispatch = async (event: FormEvent) => {
    event.preventDefault();
    setDispatchErrors({});

    const target = dispatchForm.target.trim();
    const message = dispatchForm.message.trim();
    const reviewer = dispatchForm.reviewer.trim();

    const errors: { target?: string; message?: string; reviewer?: string } = {};
    if (!target) errors.target = 'Target teammate is required';
    if (!message) errors.message = 'Task message is required';

    if (Object.keys(errors).length > 0) {
      setDispatchErrors(errors);
      return;
    }

    const input: DispatchTaskInput = { target, message };

    if (dispatchForm.reviewEnabled) {
      if (!reviewer) {
        setDispatchErrors((prev) => ({ ...prev, reviewer: 'Reviewer is required when review is enabled' }));
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
    setForkModal({ name, forkName: `${name}-memory` });
  };

  const handleReinit = async (name: string) => {
    setReinitModal({ name, prompt: '' });
  };

  const doFork = async () => {
    if (!forkModal) return;
    const name = forkModal.name;
    const forkName = forkModal.forkName.trim();
    if (!forkName) return;
    setForkModal(null);
    await forkTeammate(name, forkName);
  };

  const doReinit = async () => {
    if (!reinitModal) return;
    const name = reinitModal.name;
    const prompt = reinitModal.prompt.trim() || undefined;
    setReinitModal(null);
    await reinitTeammate(name, prompt);
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
                The Teams runtime depends on the Electron main-process IPC bridge. Open this app in the desktop shell to manage teammates, tasks, and council sessions.
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
                    Monitoring {teammates.length} teammates, {tasks.length} tasks, and {councilSessions.length} council sessions with a live cadence of {Math.round(pollIntervalMs / 1000)}s.
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
                  Refresh tasks
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

        <Tabs value={teamsViewMode} onValueChange={(value) => setTeamsViewMode(value as 'monitor' | 'councils')}>
          <TabsList>
            <TabsTrigger value="monitor">Monitor</TabsTrigger>
            <TabsTrigger value="councils" badge={councilSessions.length}>Councils</TabsTrigger>
          </TabsList>

          <TabsContent value="monitor" className="mt-6 space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-accent" />
                  <h3 className="text-base font-semibold text-ink-900">Spawn teammate</h3>
                </div>

                <form className="space-y-3" onSubmit={handleSpawn}>
                  <FormField label="Name" error={spawnErrors.name}>
                    <Input
                      value={spawnForm.name}
                      onChange={(event) => { setSpawnForm((current) => ({ ...current, name: event.target.value })); setSpawnErrors((prev) => ({ ...prev, name: undefined })); }}
                      placeholder="researcher"
                    />
                  </FormField>

                  <FormField label="Role" error={spawnErrors.role}>
                    <textarea
                      value={spawnForm.role}
                      onChange={(event) => { setSpawnForm((current) => ({ ...current, role: event.target.value })); setSpawnErrors((prev) => ({ ...prev, role: undefined })); }}
                      placeholder="Investigates implementation details and reports findings."
                      className="min-h-24 w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-accent/50"
                    />
                  </FormField>

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
                  <FormField label="Target" error={dispatchErrors.target}>
                    <Input
                      value={dispatchForm.target}
                      onChange={(event) => { setDispatchForm((current) => ({ ...current, target: event.target.value })); setDispatchErrors((prev) => ({ ...prev, target: undefined })); }}
                      placeholder="researcher or researcher/memory"
                    />
                  </FormField>
                  <FormField label="Message" error={dispatchErrors.message}>
                    <textarea
                      value={dispatchForm.message}
                      onChange={(event) => { setDispatchForm((current) => ({ ...current, message: event.target.value })); setDispatchErrors((prev) => ({ ...prev, message: undefined })); }}
                      placeholder="Investigate why the build is failing and report back with root cause."
                      className="min-h-28 w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-accent/50"
                    />
                  </FormField>

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
                        <FormField label="Reviewer" error={dispatchErrors.reviewer}>
                          <select
                            value={dispatchForm.reviewer}
                            onChange={(event) => { setDispatchForm((current) => ({ ...current, reviewer: event.target.value })); setDispatchErrors((prev) => ({ ...prev, reviewer: undefined })); }}
                            className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-accent/50"
                          >
                            <option value="">Select reviewer</option>
                            {reviewTargetOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Review gate">
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
                        </FormField>

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
          </TabsContent>

          <TabsContent value="councils" className="mt-6">
            <TeamsCouncilsView
              teammates={teammates}
              sessions={councilSessions}
              selectedSessionId={selectedCouncilSessionId}
              selectedSessionDetail={selectedCouncilSessionDetail}
              isStartingCouncil={operations.startingCouncil}
              isRefreshingCouncils={operations.councilRefreshing}
              onRefreshCouncils={() => void refreshCouncils()}
              onSelectCouncilSession={(sessionId) => void selectCouncilSession(sessionId)}
              onStartCouncil={async (input) => {
                await startCouncil(input);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <Modal open={forkModal !== null} onOpenChange={() => setForkModal(null)}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Fork teammate</ModalTitle>
            <ModalDescription>
              Create a named fork of <strong>{forkModal?.name}</strong>. This creates a separate conversation target branching from the teammate's root memory.
            </ModalDescription>
          </ModalHeader>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Fork name</label>
            <Input
              value={forkModal?.forkName ?? ''}
              onChange={(event) => setForkModal((prev) => prev ? { ...prev, forkName: event.target.value } : null)}
              placeholder="memory-review"
            />
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setForkModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void doFork()} disabled={!forkModal?.forkName.trim()}>
              Fork
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={reinitModal !== null} onOpenChange={() => setReinitModal(null)}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Reinitialize teammate</ModalTitle>
            <ModalDescription>
              Reinitialize <strong>{reinitModal?.name}</strong>. This will refresh the teammate's memory and system prompts.
            </ModalDescription>
          </ModalHeader>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Reinit prompt (optional)</label>
            <textarea
              value={reinitModal?.prompt ?? ''}
              onChange={(event) => setReinitModal((prev) => prev ? { ...prev, prompt: event.target.value } : null)}
              placeholder="Focus on improving code quality workflows."
              className="min-h-24 w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setReinitModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void doReinit()}>
              Reinitialize
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default TeamsView;
