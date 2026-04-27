import * as React from 'react';
import { useState, useCallback } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { BookOpen, Edit2, Trash2, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../composites/Card';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';
import { cn } from '../../../utils/cn';
import type { MemoryBlock as MemoryBlockType } from '../../../store/useAppStore';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MemoryBlockProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSubmit'>,
    VariantProps<typeof memoryBlockVariants> {
  /** Memory block data */
  block: MemoryBlockType;

  /** Whether block is in edit mode */
  isEditing?: boolean;

  /** Whether block is expanded to show full content */
  isExpanded?: boolean;

  /** Whether this is a sacred/protected block */
  isSacred?: boolean;

  /** Whether to show sacred toggle */
  showSacredToggle?: boolean;

  /** Whether block is read-only */
  isReadOnly?: boolean;

  /** Character limit for the block */
  limit?: number;

  /** Current character count (if tracked externally) */
  charCount?: number;

  /** Pressure ratio for health indicator (0-1) */
  pressureRatio?: number;

  /** Callback when save is triggered */
  onSave?: (blockId: string, value: string) => void | Promise<void>;

  /** Callback when delete is triggered */
  onDelete?: (blockId: string) => void;

  /** Callback when edit mode is requested */
  onEditStart?: (blockId: string) => void;

  /** Callback when edit is cancelled */
  onEditCancel?: (blockId: string) => void;

  /** Callback when expansion is toggled */
  onExpandToggle?: (blockId: string, expanded: boolean) => void;

  /** Callback when sacred status is toggled */
  onSacredToggle?: (blockId: string, sacred: boolean) => void;

  /** Additional actions to show in header */
  headerActions?: React.ReactNode;

  /** Custom render for content preview */
  renderPreview?: (content: string, expanded: boolean) => React.ReactNode;
}

// ============================================================================
// VARIANT CONFIGURATION
// ============================================================================

const memoryBlockVariants = cva(
  'transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'border-ink-900/5 bg-surface-secondary hover:border-ink-900/10',
        sacred: 'border-amber-200 bg-amber-50/30 hover:border-amber-300',
        highPressure: 'border-red-200 bg-red-50/20 hover:border-red-300',
        editing: 'border-accent/20 bg-surface shadow-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const pressureIndicatorVariants = cva(
  'h-1 rounded-full transition-all duration-300',
  {
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
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Extract text content from block (handles both value and content fields) */
export function extractBlockText(block: MemoryBlockType): string {
  if (block.value !== undefined) return block.value;
  if (typeof block.content === 'string') return block.content;
  if (block.content && typeof block.content === 'object') {
    const content = block.content as { text?: string };
    return content.text || '';
  }
  return '';
}

/** Get pressure level from ratio */
export function getPressureLevel(ratio: number): 'low' | 'medium' | 'high' {
  if (ratio > 0.9) return 'high';
  if (ratio > 0.7) return 'medium';
  return 'low';
}

/** Truncate text with ellipsis */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/** Format character count with limit */
function formatCharCount(current: number, limit?: number): string {
  if (!limit) return `${current} chars`;
  return `${current}/${limit}`;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Pressure bar indicator */
const PressureBar = ({ ratio, className }: { ratio: number; className?: string }) => {
  const level = getPressureLevel(ratio);
  const percentage = Math.min(Math.max(ratio * 100, 0), 100);

  return (
    <div className={cn('w-full h-1 bg-ink-200 rounded-full overflow-hidden', className)}>
      <div
        className={cn(pressureIndicatorVariants({ level }))}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

/** Character count indicator */
const CharCount = ({
  current,
  limit,
  showWarning = true,
}: {
  current: number;
  limit?: number;
  showWarning?: boolean;
}) => {
  const isNearLimit = limit && current > limit * 0.9;
  const isOverLimit = limit && current > limit;

  return (
    <span
      className={cn(
        'text-xs px-1.5 py-0.5 rounded bg-surface-tertiary',
        isOverLimit && showWarning && 'bg-red-100 text-red-700',
        isNearLimit && !isOverLimit && showWarning && 'bg-amber-100 text-amber-700',
        !isNearLimit && 'text-muted'
      )}
    >
      {formatCharCount(current, limit)}
    </span>
  );
};

/** Sacred badge */
const SacredBadge = ({ isSacred, onToggle, disabled }: { isSacred: boolean; onToggle?: () => void; disabled?: boolean }) => {
  return (
    <button
      onClick={onToggle}
      disabled={disabled || !onToggle}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors',
        isSacred
          ? 'bg-amber-100 text-amber-700 border border-amber-200'
          : 'bg-surface-tertiary text-ink-500 border border-ink-900/10',
        onToggle && !disabled && 'hover:opacity-80 cursor-pointer',
        !onToggle && 'cursor-default'
      )}
      title={isSacred ? 'Sacred block (protected from auto-truncation)' : 'Regular block'}
    >
      <Lock className="h-3 w-3" />
      {isSacred ? 'Sacred' : 'Standard'}
    </button>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MemoryBlock = React.forwardRef<HTMLDivElement, MemoryBlockProps>(
  (
    {
      block,
      isEditing = false,
      isExpanded = false,
      isSacred = false,
      showSacredToggle = false,
      isReadOnly = false,
      limit,
      charCount,
      pressureRatio,
      onSave,
      onDelete,
      onEditStart,
      onEditCancel,
      onExpandToggle,
      onSacredToggle,
      headerActions,
      renderPreview,
      className,
      variant,
      ...props
    },
    ref
  ) => {
    // Internal state for edit mode
    const [draftValue, setDraftValue] = useState(extractBlockText(block));
    const [isSaving, setIsSaving] = useState(false);

    // Update draft when block changes externally
    React.useEffect(() => {
      if (!isEditing) {
        setDraftValue(extractBlockText(block));
      }
    }, [block, isEditing]);

    // Content handling
    const content = extractBlockText(block);
    const currentCharCount = charCount ?? content.length;
    const shouldTruncate = content.length > 100;
    const displayContent = isExpanded || !shouldTruncate
      ? content
      : truncateText(content, 100);

    // Determine variant based on state
    const computedVariant = variant ?? (isEditing ? 'editing' : isSacred ? 'sacred' : 'default');

    // Handlers
    const handleEditStart = useCallback(() => {
      setDraftValue(content);
      onEditStart?.(block.id);
    }, [block.id, content, onEditStart]);

    const handleEditCancel = useCallback(() => {
      setDraftValue(content);
      onEditCancel?.(block.id);
    }, [block.id, content, onEditCancel]);

    const handleSave = useCallback(async () => {
      if (!onSave) return;
      setIsSaving(true);
      try {
        await onSave(block.id, draftValue);
      } finally {
        setIsSaving(false);
      }
    }, [block.id, draftValue, onSave]);

    const handleExpandToggle = useCallback(() => {
      onExpandToggle?.(block.id, !isExpanded);
    }, [block.id, isExpanded, onExpandToggle]);

    const handleSacredToggle = useCallback(() => {
      onSacredToggle?.(block.id, !isSacred);
    }, [block.id, isSacred, onSacredToggle]);

    return (
      <Card
        ref={ref}
        variant="default"
        className={cn(memoryBlockVariants({ variant: computedVariant }), className)}
        {...props}
      >
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between gap-2 py-3 px-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon icon={BookOpen} size="sm" className="text-accent shrink-0" />
            <span className="text-sm font-medium text-ink-800 truncate">
              {block.label}
            </span>
            {showSacredToggle && (
              <SacredBadge
                isSacred={isSacred}
                onToggle={!isReadOnly ? handleSacredToggle : undefined}
                disabled={isEditing}
              />
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Limit indicator */}
            {(limit !== undefined || charCount !== undefined) && !isEditing && (
              <CharCount current={currentCharCount} limit={limit} />
            )}

            {/* Custom actions */}
            {headerActions}

            {/* Edit button */}
            {!isReadOnly && !isEditing && onEditStart && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleEditStart}
                aria-label={`Edit ${block.label}`}
              >
                <Icon icon={Edit2} size="sm" className="text-ink-500" />
              </Button>
            )}

            {/* Delete button */}
            {!isReadOnly && !isEditing && onDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(block.id)}
                aria-label={`Delete ${block.label}`}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <Icon icon={Trash2} size="sm" />
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="py-0 px-3">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-xs font-mono text-ink-800 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 resize-vertical"
                placeholder="Enter block content..."
              />
              <div className="flex items-center justify-between">
                <CharCount current={draftValue.length} limit={limit} />
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleEditCancel}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isSaving}
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {renderPreview ? (
                renderPreview(content, isExpanded)
              ) : (
                <div
                  className={cn(
                    'text-xs text-ink-600 font-mono whitespace-pre-wrap break-words leading-relaxed',
                    !isReadOnly && onEditStart && 'cursor-pointer hover:text-ink-800'
                  )}
                  onClick={() => !isReadOnly && onEditStart && handleEditStart()}
                >
                  {displayContent}
                </div>
              )}

              {shouldTruncate && (
                <button
                  onClick={handleExpandToggle}
                  className="mt-2 flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
                >
                  <Icon icon={isExpanded ? ChevronUp : ChevronDown} size="sm" />
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          )}
        </CardContent>

        {/* Footer - Pressure indicator */}
        {pressureRatio !== undefined && (
          <CardFooter className="py-3 px-3 border-t border-ink-900/5">
            <div className="w-full space-y-1">
              <div className="flex justify-between text-[10px] text-ink-500">
                <span>Memory pressure</span>
                <span>{Math.round(pressureRatio * 100)}%</span>
              </div>
              <PressureBar ratio={pressureRatio} />
            </div>
          </CardFooter>
        )}
      </Card>
    );
  }
);

MemoryBlock.displayName = 'MemoryBlock';

// ============================================================================
// EXPORTS
// ============================================================================

export { MemoryBlock, PressureBar, CharCount, SacredBadge };
export default MemoryBlock;
