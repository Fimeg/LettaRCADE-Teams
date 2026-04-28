import type { TaskState, TaskStatus, TeammateState } from 'letta-teams-sdk';

export const teammateStatusClasses: Record<TeammateState['status'], string> = {
  idle: 'bg-slate-100 text-slate-700',
  working: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export const taskStatusClasses: Record<TaskStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  running: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
  pending_review: 'bg-purple-100 text-purple-700',
  reviewing: 'bg-purple-100 text-purple-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

export const initStatusClasses: Record<NonNullable<TeammateState['initStatus']> | 'unknown', string> = {
  pending: 'bg-amber-100 text-amber-700',
  running: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
  skipped: 'bg-slate-100 text-slate-700',
  unknown: 'bg-slate-100 text-slate-700',
};

export const councilStatusClasses: Record<TeamsCouncilSessionStatus, string> = {
  running: 'bg-blue-100 text-blue-700',
  decided: 'bg-green-100 text-green-700',
  max_turns: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
};

export function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function formatTaskPreview(task: TaskState): string {
  if (task.error) return task.error;
  if (task.result) return task.result;
  return task.message;
}

export function formatProgress(progress?: number): string {
  if (typeof progress !== 'number' || Number.isNaN(progress)) {
    return '—';
  }

  const normalized = progress <= 1 ? progress * 100 : progress;
  return `${Math.max(0, Math.min(100, Math.round(normalized)))}%`;
}

export function getTaskDisplayName(task: TaskState): string {
  return task.targetName ?? task.teammateName;
}

export function getReviewGateLabel(gate?: 'on_success' | 'always'): string {
  switch (gate) {
    case 'always':
      return 'Always review';
    case 'on_success':
      return 'Review on success';
    default:
      return '—';
  }
}

export function getReviewGateHelpText(gate: 'on_success' | 'always'): string {
  return gate === 'always'
    ? 'The reviewer will run even if the worker task errors.'
    : 'The reviewer will only run after successful worker completion.';
}

export function formatCouncilStatus(status: TeamsCouncilSessionStatus): string {
  return status.replace('_', ' ');
}
