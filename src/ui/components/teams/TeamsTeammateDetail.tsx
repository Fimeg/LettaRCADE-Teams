import type { TeammateState } from 'letta-teams/types';
import { Bot, GitFork, RotateCcw, Send, Target } from 'lucide-react';
import { Button } from '../ui/primitives/Button';
import { formatProgress, formatTimestamp, initStatusClasses, teammateStatusClasses } from './utils';

interface TeamsTeammateDetailProps {
  teammate: TeammateState;
  onFork: (name: string) => void;
  onReinit: (name: string) => void;
  onDispatchTarget: (target: string) => void;
  onSelectTask: (taskId: string) => void;
}

export function TeamsTeammateDetail({
  teammate,
  onFork,
  onReinit,
  onDispatchTarget,
  onSelectTask,
}: TeamsTeammateDetailProps) {
  const statusClassName = teammateStatusClasses[teammate.status] ?? teammateStatusClasses.idle;
  const initStatus = teammate.initStatus ?? 'unknown';
  const initStatusClassName = initStatusClasses[initStatus] ?? initStatusClasses.unknown;
  const recentEvents = [...(teammate.statusEvents ?? [])].slice(-8).reverse();

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-ink-900/10 bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-ink-900">{teammate.name}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClassName}`}>
                      {teammate.status}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${initStatusClassName}`}>
                      init {initStatus}
                    </span>
                    {teammate.memfsEnabled && (
                      <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                        memfs
                      </span>
                    )}
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-ink-600">{teammate.role}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" leftIcon={Send} onClick={() => onDispatchTarget(teammate.name)}>
                Target teammate
              </Button>
              <Button size="sm" variant="secondary" leftIcon={GitFork} onClick={() => onFork(teammate.name)}>
                Fork
              </Button>
              <Button size="sm" variant="secondary" leftIcon={RotateCcw} onClick={() => onReinit(teammate.name)}>
                Reinit
              </Button>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Agent ID</dt>
              <dd className="mt-1 break-all text-sm text-ink-900">{teammate.agentId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Model</dt>
              <dd className="mt-1 break-all text-sm text-ink-900">{teammate.model ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Context window</dt>
              <dd className="mt-1 text-sm text-ink-900">{teammate.contextWindowLimit ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Updated</dt>
              <dd className="mt-1 text-sm text-ink-900">{formatTimestamp(teammate.lastUpdated)}</dd>
            </div>
          </dl>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-900/10 bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-base font-semibold text-ink-900">Execution summary</h4>
                <span className="text-xs text-ink-500">
                  heartbeat {formatTimestamp(teammate.statusSummary?.lastHeartbeatAt)}
                </span>
              </div>

              {teammate.statusSummary ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-ink-800">{teammate.statusSummary.phase}</span>
                      <span className="text-xs text-ink-500">progress {formatProgress(teammate.statusSummary.progress)}</span>
                    </div>
                    <p className="mt-2 text-sm text-ink-700">{teammate.statusSummary.message}</p>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-surface-cream">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: formatProgress(teammate.statusSummary.progress) === '—' ? '0%' : formatProgress(teammate.statusSummary.progress) }}
                    />
                  </div>

                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Last code change</dt>
                      <dd className="mt-1 text-sm text-ink-900">{formatTimestamp(teammate.statusSummary.lastCodeChangeAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Current TODO</dt>
                      <dd className="mt-1 text-sm text-ink-900">{teammate.statusSummary.currentTodoId ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink-600">No execution heartbeat yet.</p>
              )}
            </div>

            <div className="rounded-2xl border border-ink-900/10 bg-surface p-5 shadow-sm">
              <h4 className="text-base font-semibold text-ink-900">TODO items</h4>

              <div className="mt-4 space-y-3">
                {(teammate.todoItems?.length ?? 0) === 0 ? (
                  <p className="text-sm text-ink-600">No TODO items reported yet.</p>
                ) : teammate.todoItems!.map((todo) => (
                  <div key={todo.id} className="rounded-xl border border-ink-900/10 bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink-900">{todo.title}</span>
                      <span className="rounded-full bg-surface-cream px-2 py-0.5 text-[11px] font-medium text-ink-600">
                        {todo.state}
                      </span>
                      {todo.priority && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                          {todo.priority}
                        </span>
                      )}
                    </div>
                    {todo.notes && <p className="mt-2 text-sm text-ink-700">{todo.notes}</p>}
                    {todo.blockedReason && <p className="mt-2 text-sm text-red-700">Blocked: {todo.blockedReason}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-ink-900/10 bg-surface p-5 shadow-sm">
              <h4 className="text-base font-semibold text-ink-900">Recent status events</h4>

              <div className="mt-4 space-y-3">
                {recentEvents.length === 0 ? (
                  <p className="text-sm text-ink-600">No execution events yet.</p>
                ) : recentEvents.map((event) => (
                  <div key={event.id} className="rounded-xl border border-ink-900/10 bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <span className="rounded-full bg-surface-cream px-2 py-0.5 font-medium text-ink-600">{event.type}</span>
                      <span>{event.phase}</span>
                      <span>{formatTimestamp(event.ts)}</span>
                    </div>
                    <p className="mt-2 text-sm text-ink-800">{event.message}</p>
                    {event.filesTouched?.length ? (
                      <p className="mt-2 text-xs text-ink-500">Files: {event.filesTouched.join(', ')}</p>
                    ) : null}
                    {event.testsRun && <p className="mt-2 text-xs text-ink-500">Tests: {event.testsRun}</p>}
                    {event.blockedReason && <p className="mt-2 text-xs text-red-700">Blocked: {event.blockedReason}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-900/10 bg-surface p-5 shadow-sm">
              <h4 className="text-base font-semibold text-ink-900">Targets</h4>

              <div className="mt-4 space-y-3">
                {(teammate.targets?.length ?? 0) === 0 ? (
                  <p className="text-sm text-ink-600">No targets recorded yet.</p>
                ) : teammate.targets!.map((target) => (
                  <div key={target.name} className="rounded-xl border border-ink-900/10 bg-surface px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink-900">{target.name}</span>
                          <span className="rounded-full bg-surface-cream px-2 py-0.5 text-[11px] font-medium text-ink-600">
                            {target.kind}
                          </span>
                          {target.status && (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                              {target.status}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-ink-500">Updated {formatTimestamp(target.lastActiveAt)}</p>
                      </div>

                      <Button size="sm" variant="secondary" leftIcon={Target} onClick={() => onDispatchTarget(target.name)}>
                        Use target
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-ink-900/10 bg-surface p-5 shadow-sm">
              <h4 className="text-base font-semibold text-ink-900">Initialization</h4>

              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Init task</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm text-ink-900">
                    <span className="break-all">{teammate.initTaskId ?? '—'}</span>
                    {teammate.initTaskId && (
                      <Button size="sm" variant="ghost" onClick={() => onSelectTask(teammate.initTaskId!)}>
                        Open task
                      </Button>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Selected specialization</dt>
                  <dd className="mt-1 text-sm text-ink-900">{teammate.selectedSpecTitle ?? teammate.selectedSpecId ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Started</dt>
                  <dd className="mt-1 text-sm text-ink-900">{formatTimestamp(teammate.initStartedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Completed</dt>
                  <dd className="mt-1 text-sm text-ink-900">{formatTimestamp(teammate.initCompletedAt)}</dd>
                </div>
                {teammate.initError && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Init error</dt>
                    <dd className="mt-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      {teammate.initError}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default TeamsTeammateDetail;
