import type { TaskState, TeammateState } from 'letta-teams-sdk';
import { Bot, Radio, Send, Users } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { TeamsSelectionType, TeamsTaskFilter } from '../../store/useTeamsStore';
import { isTaskActive, isTaskCompleted, isTaskFailed } from '../../store/useTeamsStore';
import { formatTaskPreview, formatTimestamp, getTaskDisplayName, taskStatusClasses, teammateStatusClasses } from './utils';

interface TeamsSidebarProps {
  teammates: TeammateState[];
  tasks: TaskState[];
  trackedTaskIds: string[];
  selectedEntityType: TeamsSelectionType;
  selectedTaskId: string | null;
  selectedTeammateName: string | null;
  taskFilter: TeamsTaskFilter;
  onSelectTeammate: (name: string) => void;
  onSelectTask: (id: string) => void;
  onSetTaskFilter: (filter: TeamsTaskFilter) => void;
  onDispatchTarget: (target: string) => void;
}

const taskFilters: Array<{ value: TeamsTaskFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'Review' },
  { value: 'completed', label: 'Done' },
  { value: 'failed', label: 'Failed' },
];

function matchesTaskFilter(task: TaskState, filter: TeamsTaskFilter): boolean {
  switch (filter) {
    case 'active':
      return isTaskActive(task);
    case 'review':
      return task.status === 'pending_review' || task.status === 'reviewing' || !!task.requiresReview;
    case 'completed':
      return isTaskCompleted(task);
    case 'failed':
      return isTaskFailed(task);
    case 'all':
    default:
      return true;
  }
}

export function TeamsSidebar({
  teammates,
  tasks,
  trackedTaskIds,
  selectedEntityType,
  selectedTaskId,
  selectedTeammateName,
  taskFilter,
  onSelectTeammate,
  onSelectTask,
  onSetTaskFilter,
  onDispatchTarget,
}: TeamsSidebarProps) {
  const visibleTasks = tasks.filter((task) => matchesTaskFilter(task, taskFilter));

  return (
    <div className="flex h-full min-h-0 flex-col bg-white/60">
      <div className="border-b border-ink-900/10 px-4 py-4">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-accent" />
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Live monitor</h3>
            <p className="text-xs text-ink-500">Select a teammate or task to inspect live state.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <h4 className="text-sm font-semibold text-ink-900">Teammates</h4>
            </div>
            <span className="rounded-full bg-surface-cream px-2.5 py-1 text-[11px] font-medium text-ink-600">
              {teammates.length}
            </span>
          </div>

          <div className="space-y-2">
            {teammates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-900/15 bg-surface-cream px-4 py-5 text-sm text-ink-600">
                No teammates yet.
              </div>
            ) : teammates.map((teammate) => {
              const isSelected = selectedEntityType === 'teammate' && selectedTeammateName === teammate.name;
              const statusClassName = teammateStatusClasses[teammate.status] ?? teammateStatusClasses.idle;

              return (
                <div
                  key={teammate.name}
                  className={cn(
                    'rounded-xl border px-3 py-3 transition-colors',
                    isSelected
                      ? 'border-accent bg-accent/5 shadow-sm'
                      : 'border-ink-900/10 bg-surface hover:border-accent/40 hover:bg-accent/5',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectTeammate(teammate.name)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink-900">{teammate.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClassName}`}>
                          {teammate.status}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-600">
                        {teammate.statusSummary?.message || teammate.role}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
                        <span>{teammate.targets?.length ?? 0} targets</span>
                        <span>{formatTimestamp(teammate.statusSummary?.lastHeartbeatAt ?? teammate.lastUpdated)}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDispatchTarget(teammate.name)}
                      className="rounded-lg border border-ink-900/10 px-2 py-1 text-[11px] font-medium text-ink-700 hover:border-accent/30 hover:bg-accent/5"
                    >
                      Target
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-accent" />
              <h4 className="text-sm font-semibold text-ink-900">Tasks</h4>
            </div>
            <span className="rounded-full bg-surface-cream px-2.5 py-1 text-[11px] font-medium text-ink-600">
              {visibleTasks.length}/{tasks.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {taskFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => onSetTaskFilter(filter.value)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  taskFilter === filter.value
                    ? 'bg-accent text-white'
                    : 'bg-surface-cream text-ink-600 hover:bg-accent/10 hover:text-accent',
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {visibleTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-900/15 bg-surface-cream px-4 py-5 text-sm text-ink-600">
                No tasks match the current filter.
              </div>
            ) : visibleTasks.map((task) => {
              const isSelected = selectedEntityType === 'task' && selectedTaskId === task.id;
              const isTracked = trackedTaskIds.includes(task.id);
              const statusClassName = taskStatusClasses[task.status] ?? taskStatusClasses.pending;

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelectTask(task.id)}
                  className={cn(
                    'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                    isSelected
                      ? 'border-accent bg-accent/5 shadow-sm'
                      : 'border-ink-900/10 bg-surface hover:border-accent/40 hover:bg-accent/5',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink-900">{getTaskDisplayName(task)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClassName}`}>
                          {task.status}
                        </span>
                        {isTracked && (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                            live
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-600">{formatTaskPreview(task)}</p>
                    </div>

                    <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
                    <span className="break-all">{task.id}</span>
                    <span>{formatTimestamp(task.completedAt ?? task.startedAt ?? task.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default TeamsSidebar;
