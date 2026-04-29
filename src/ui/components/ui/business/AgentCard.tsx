/**
 * AgentCard Component - Business layer card for displaying agent information
 *
 * Displays agent details including avatar, status, tools, memory info,
 * and favorite status. Supports compact and full variants.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Star, ChevronRight, Wrench, Clock, AlertTriangle, Database, Users } from 'lucide-react';
import { cn } from '../../../utils/cn';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
} from '../composites/Card';
import { Icon } from '../primitives/Icon';
import { Button } from '../primitives/Button';

// ============================================================================
// 1. TYPE DEFINITIONS
// ============================================================================

/** Agent data shape (minimal for card display) */
export interface AgentCardAgent {
  id: string;
  name: string;
  description?: string | null;
  model?: string | null;
  toolCount?: number;
  createdAt?: string | null;
  lastRun?: string | null;
  memfsEnabled?: boolean;
  staleConversationCount?: number;
  /** If this agent is also a Teams teammate, the teammate name. */
  teammateName?: string;
  // Optional health data for memory pressure display
  health?: {
    memoryPressure: number; // 0-100
    status: 'active' | 'idle' | 'stale' | 'unknown';
  };
}

// ============================================================================
// 2. VARIANT CONFIGURATION (cva)
// ============================================================================

/** Main card container variants */
const agentCardVariants = cva(
  'group relative flex flex-col cursor-pointer transition-all duration-200 rounded-xl border bg-surface',
  {
    variants: {
      variant: {
        compact: 'p-3 gap-2',
        full: 'p-4 gap-3',
      },
      isSelected: {
        true: 'border-accent/30 bg-accent-subtle ring-1 ring-accent/20',
        false: 'border-ink-900/10 hover:border-accent/50 hover:shadow-card',
      },
      isDisabled: {
        true: 'opacity-50 cursor-not-allowed hover:border-ink-900/10 hover:shadow-none',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'full',
      isSelected: false,
      isDisabled: false,
    },
  }
);

/** Avatar variants based on card size */
const avatarVariants = cva(
  'relative shrink-0 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-semibold',
  {
    variants: {
      variant: {
        compact: 'w-8 h-8 text-xs',
        full: 'w-10 h-10 text-sm',
      },
    },
    defaultVariants: {
      variant: 'full',
    },
  }
);

/** Status dot variants */
const statusDotVariants = cva(
  'absolute rounded-full border-2 border-surface',
  {
    variants: {
      variant: {
        compact: '-bottom-0.5 -right-0.5 w-2.5 h-2.5',
        full: '-bottom-0.5 -right-0.5 w-3 h-3',
      },
      status: {
        active: 'bg-green-500',
        idle: 'bg-amber-500',
        stale: 'bg-ink-400',
        unknown: 'bg-ink-400',
      },
    },
    defaultVariants: {
      variant: 'full',
      status: 'unknown',
    },
  }
);

/** Memory pressure bar variants */
const memoryPressureVariants = cva('h-1 rounded-full', {
  variants: {
    level: {
      low: 'bg-green-500',
      medium: 'bg-amber-500',
      high: 'bg-red-500',
    },
  },
  defaultVariants: {
    level: 'low',
  },
});

// ============================================================================
// 3. HELPER FUNCTIONS
// ============================================================================

/** Get initials from agent name (first 2 characters, uppercase) */
function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

/** Format relative time from ISO string */
function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return 'just now';
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Derive status from last run time */
function deriveStatus(lastRun?: string | null): { status: 'active' | 'idle' | 'stale' | 'unknown'; label: string } {
  if (!lastRun) return { status: 'unknown', label: 'Never run' };
  const diff = Date.now() - new Date(lastRun).getTime();
  const hr = 60 * 60 * 1000;
  if (diff < 6 * hr) return { status: 'active', label: 'Active' };
  if (diff < 7 * 24 * hr) return { status: 'idle', label: 'Idle' };
  return { status: 'stale', label: 'Stale' };
}

/** Get memory pressure level */
function getMemoryPressureLevel(pressure: number): 'low' | 'medium' | 'high' {
  if (pressure > 80) return 'high';
  if (pressure > 50) return 'medium';
  return 'low';
}

// ============================================================================
// 4. COMPONENT INTERFACE
// ============================================================================

export interface AgentCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof agentCardVariants> {
  /** Agent data to display */
  agent: AgentCardAgent;

  /** Whether this agent is marked as favorite */
  isFavorite?: boolean;

  /** Click handler for card selection (navigates to agent) */
  onSelect?: () => void;

  /** Toggle favorite status - if omitted, favorite button hidden */
  onToggleFavorite?: (e: React.MouseEvent) => void;

  /** Visual density variant */
  variant?: 'compact' | 'full';

  /** Whether card is in selected state (for multi-select contexts) */
  isSelected?: boolean;

  /** Optional additional actions shown on hover (React nodes) */
  hoverActions?: React.ReactNode;

  /** Disable all interactions */
  isDisabled?: boolean;
}

// ============================================================================
// 5. COMPONENT IMPLEMENTATION
// ============================================================================

const AgentCard = React.forwardRef<HTMLDivElement, AgentCardProps>(
  (
    {
      className,
      agent,
      isFavorite,
      onSelect,
      onToggleFavorite,
      variant = 'full',
      isSelected,
      isDisabled,
      hoverActions,
      ...props
    },
    ref
  ) => {
    // Determine status (from health if provided, otherwise derive from lastRun)
    const status = agent.health?.status ?? deriveStatus(agent.lastRun).status;
    const statusLabel = agent.health?.status
      ? agent.health.status.charAt(0).toUpperCase() + agent.health.status.slice(1)
      : deriveStatus(agent.lastRun).label;

    // Memory pressure (only shown if health data provided)
    const memoryPressure = agent.health?.memoryPressure;
    const pressureLevel = memoryPressure !== undefined
      ? getMemoryPressureLevel(memoryPressure)
      : null;

    // Time display (prefer lastRun, fallback to createdAt)
    const timeDisplay = relativeTime(agent.lastRun) ?? relativeTime(agent.createdAt);

    return (
      <Card
        ref={ref}
        className={cn(agentCardVariants({ variant, isSelected, isDisabled }), className)}
        onClick={isDisabled ? undefined : onSelect}
        {...props}
      >
        {/* Header: Avatar + Info + Actions */}
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-0">
          {/* Avatar with Status Dot */}
          <div className={cn(avatarVariants({ variant }))}>
            {getInitials(agent.name)}
            <span className={cn(statusDotVariants({ variant, status }))} />
          </div>

          {/* Agent Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-semibold leading-tight text-ink-900 line-clamp-1">
                {agent.name}
              </CardTitle>
              {agent.memfsEnabled && (
                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-emerald-100 text-emerald-700">
                  <Icon icon={Database} size="sm" className="mr-0.5 h-3 w-3" />
                  memfs
                </span>
              )}
              {agent.teammateName && (
                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-purple-100 text-purple-700">
                  <Icon icon={Users} size="sm" className="mr-0.5 h-3 w-3" />
                  team
                </span>
              )}
            </div>
            {agent.model && (
              <p className="text-xs text-ink-500 font-mono mt-0.5 line-clamp-1">
                {agent.model}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {hoverActions}
            {onToggleFavorite && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(e);
                }}
                className={cn(
                  'text-ink-400 hover:text-amber-400',
                  isFavorite && 'text-amber-400 opacity-100'
                )}
              >
                <Icon
                  icon={Star}
                  size="sm"
                  className={cn('transition-all', isFavorite && 'fill-current')}
                />
              </Button>
            )}
            <Icon
              icon={ChevronRight}
              size="sm"
              className="text-ink-400"
            />
          </div>
        </CardHeader>

        {/* Description (full variant only, or compact if space permits) */}
        {agent.description && variant === 'full' && (
          <CardContent className="p-0 pt-0">
            <p className="text-xs text-ink-600 line-clamp-2 min-h-[2rem]">
              {agent.description}
            </p>
          </CardContent>
        )}

        {/* Footer: Metadata */}
        <CardFooter className="flex flex-col gap-2 p-0 mt-auto border-t border-ink-900/5 pt-2">
          {/* Metadata Row */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              {/* Tool Count */}
              {agent.toolCount !== undefined && agent.toolCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-ink-500">
                  <Icon icon={Wrench} size="sm" />
                  {agent.toolCount}
                </span>
              )}

              {/* Stale Conversations */}
              {agent.staleConversationCount !== undefined && agent.staleConversationCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-500">
                  <Icon icon={AlertTriangle} size="sm" />
                  {agent.staleConversationCount}
                </span>
              )}

              {/* Time Display */}
              {timeDisplay && (
                <span className="flex items-center gap-1 text-xs text-ink-500">
                  <Icon icon={Clock} size="sm" />
                  {timeDisplay}
                </span>
              )}
            </div>

            {/* Status Label */}
            <span className="text-[10px] uppercase font-medium text-ink-400">
              {statusLabel}
            </span>
          </div>

          {/* Memory Pressure Bar (full variant only, if health provided) */}
          {variant === 'full' && pressureLevel && memoryPressure !== undefined && (
            <div className="w-full">
              <div className="flex justify-between text-[10px] text-ink-500 mb-1">
                <span>Memory</span>
                <span>{Math.round(memoryPressure)}%</span>
              </div>
              <div className="w-full h-1 bg-ink-200 rounded-full overflow-hidden">
                <div
                  className={cn(memoryPressureVariants({ level: pressureLevel }))}
                  style={{ width: `${Math.min(memoryPressure, 100)}%` }}
                />
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    );
  }
);

AgentCard.displayName = 'AgentCard';

// ============================================================================
// 6. EXPORTS
// ============================================================================

export { AgentCard };
export default AgentCard;
