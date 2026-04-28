import type { TaskState } from 'letta-teams-sdk';
import { Bot, MessageSquareText, Square, Workflow } from 'lucide-react';
import { Button } from '../ui/primitives/Button';
import { isTaskActive } from '../../store/useTeamsStore';
import { formatTaskPreview, formatTimestamp, getTaskDisplayName, taskStatusClasses } from './utils';

interface TeamsTaskDetailProps {
  task: TaskState;
  tracked: boolean;
  onCancel: (id: string) => void;
  onSelectTeammate: (name: string) => void;
  onSelectTask: (taskId: string) => void;
}

export function TeamsTaskDetail({
  task,
  tracked,
  onCancel,
  onSelectTeammate,
  onSelectTask,
}: TeamsTaskDetailProps) {
  const statusClassName = taskStatusClasses[task.status] ?? taskStatusClasses.pending;
  const canCancel = isTaskActive(task);

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-ink-900">{getTaskDisplayName(task)}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClassName}`}>
                      {task.status}
                    </span>
                    {tracked && (
                      <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                        live follow
                      </span>
                    )}
                    {task.kind && (
                      <span className="rounded-full bg-surface-cream px-2.5 py-1 text-xs font-medium text-ink-600">
                        {task.kind}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 break-all text-sm text-ink-500">{task.id}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" leftIcon={Bot} onClick={() => onSelectTeammate(task.teammateName)}>
                View teammate
              </Button>
              {task.reviewTaskId && (
                <Button size="sm" variant="secondary" onClick={() => onSelectTask(task.reviewTaskId!)}>
                  Open review task
                </Button>
              )}
              {canCancel && (
                <Button size="sm" variant="ghost" leftIcon={Square} onClick={() => onCancel(task.id)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          <dl className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Target</dt>
              <dd className="mt-1 text-sm text-ink-900">{task.targetName ?? task.teammateName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Pipeline</dt>
              <dd className="mt-1 text-sm text-ink-900">{task.pipelineId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Conversation</dt>
              <dd className="mt-1 break-all text-sm text-ink-900">{task.conversationId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Root teammate</dt>
              <dd className="mt-1 text-sm text-ink-900">{task.rootTeammateName ?? task.teammateName}</dd>
            </div>
          </dl>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-accent" />
                <h4 className="text-base font-semibold text-ink-900">Message</h4>
              </div>
              <pre className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-surface px-4 py-4 text-sm text-ink-800">
                {task.message}
              </pre>
            </div>

            <div className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
              <h4 className="text-base font-semibold text-ink-900">Outcome</h4>
              <pre className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-surface px-4 py-4 text-sm text-ink-800">
                {formatTaskPreview(task)}
              </pre>
            </div>

            <div className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
              <h4 className="text-base font-semibold text-ink-900">Tool calls</h4>

              <div className="mt-4 space-y-3">
                {(task.toolCalls?.length ?? 0) === 0 ? (
                  <p className="text-sm text-ink-600">No tool calls recorded.</p>
                ) : task.toolCalls!.map((toolCall, index) => (
                  <div key={`${toolCall.name}-${index}`} className="rounded-xl border border-ink-900/10 bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink-900">{toolCall.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toolCall.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {toolCall.success ? 'success' : 'failed'}
                      </span>
                    </div>
                    {toolCall.input && <p className="mt-2 text-sm text-ink-700">{toolCall.input}</p>}
                    {toolCall.error && <p className="mt-2 text-sm text-red-700">{toolCall.error}</p>}
                  </div>
                ))}
              </div>
            </div>

            {task.initEvents?.length ? (
              <div className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
                <h4 className="text-base font-semibold text-ink-900">Init transcript</h4>

                <div className="mt-4 space-y-3">
                  {task.initEvents.map((event, index) => (
                    <div key={`${event.timestamp}-${index}`} className="rounded-xl border border-ink-900/10 bg-surface px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                        <span className="rounded-full bg-surface-cream px-2 py-0.5 font-medium text-ink-600">{event.type}</span>
                        <span>{formatTimestamp(event.timestamp)}</span>
                        {event.toolName && <span>{event.toolName}</span>}
                      </div>
                      {event.content && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-800">{event.content}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
              <h4 className="text-base font-semibold text-ink-900">Timing</h4>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Created</dt>
                  <dd className="mt-1 text-sm text-ink-900">{formatTimestamp(task.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Started</dt>
                  <dd className="mt-1 text-sm text-ink-900">{formatTimestamp(task.startedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Completed</dt>
                  <dd className="mt-1 text-sm text-ink-900">{formatTimestamp(task.completedAt)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
              <h4 className="text-base font-semibold text-ink-900">Review metadata</h4>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Requires review</dt>
                  <dd className="mt-1 text-sm text-ink-900">{task.requiresReview ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Review target</dt>
                  <dd className="mt-1 text-sm text-ink-900">{task.reviewTarget ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Review status</dt>
                  <dd className="mt-1 text-sm text-ink-900">{task.reviewStatus ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Review task</dt>
                  <dd className="mt-1 break-all text-sm text-ink-900">{task.reviewTaskId ?? '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default TeamsTaskDetail;
