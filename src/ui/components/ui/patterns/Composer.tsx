/**
 * Composer Component - Rich message input with auto-resize and slash commands
 *
 * Features:
 * - Auto-resizing textarea
 * - Submit button with loading state
 * - Attachment/upload button slot
 * - Character count with limit indicator
 * - Keyboard shortcuts: Enter to submit, Shift+Enter for newline
 * - Slash command hint display
 * - Disabled state
 *
 * Uses TextArea primitive + Button primitive.
 * Reference existing AgentWorkspace input area.
 */

import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { cva } from 'class-variance-authority';
import { Send } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Button } from '../primitives/Button';

// ============================================================================
// 1. TYPE DEFINITIONS
// ============================================================================

interface SlashCommand {
  id: string;
  label: string;
  description?: string;
}

interface ComposerProps {
  /** Current value of the textarea */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Callback when submitting */
  onSubmit: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state for submit button */
  loading?: boolean;
  /** Maximum character length */
  maxLength?: number;
  /** Show character count */
  showCharacterCount?: boolean;
  /** Label for submit button (accessibility) */
  submitLabel?: string;
  /** Keyboard shortcut hint to display */
  submitShortcut?: string;
  /** Custom element for attachment/upload button */
  attachmentSlot?: React.ReactNode;
  /** Available slash commands */
  slashCommands?: SlashCommand[];
  /** Callback when a slash command is selected */
  onSlashCommand?: (commandId: string) => void;
  /** Minimum rows for textarea */
  minRows?: number;
  /** Maximum rows for textarea (before scrolling) */
  maxRows?: number;
  /** Additional className */
  className?: string;
  /** Composer size variant */
  size?: 'sm' | 'md' | 'lg';
}

interface ComposerSlashMenuProps {
  /** Available commands */
  commands: SlashCommand[];
  /** Command selection callback */
  onSelect: (commandId: string) => void;
  /** Close menu callback */
  onClose: () => void;
  /** Current filter text */
  filterText: string;
}

// ============================================================================
// 2. VARIANT CONFIGURATION (cva)
// ============================================================================

const composerVariants = cva('flex flex-col gap-2 w-full', {
  variants: {
    size: {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    },
    disabled: {
      true: 'opacity-60 cursor-not-allowed',
      false: '',
    },
  },
  defaultVariants: {
    size: 'md',
    disabled: false,
  },
});

const composerInputContainerVariants = cva(
  'flex items-end gap-3 rounded-2xl border border-ink-900/10 bg-surface px-4 py-3 shadow-card transition-colors focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20',
  {
    variants: {
      disabled: {
        true: 'bg-surface-tertiary border-ink-900/5',
        false: '',
      },
      isOverLimit: {
        true: 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20',
        false: '',
      },
    },
    defaultVariants: {
      disabled: false,
      isOverLimit: false,
    },
  }
);

const composerTextareaVariants = cva(
  'flex-1 resize-none bg-transparent text-ink-800 placeholder:text-ink-400 focus:outline-none disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'py-1 text-xs',
        md: 'py-1.5 text-sm',
        lg: 'py-2 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const slashMenuVariants = cva(
  'absolute bottom-full left-0 right-0 mb-2 bg-surface border border-ink-900/10 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto z-50'
);

const slashMenuItemVariants = cva(
  'px-4 py-2 flex items-center justify-between cursor-pointer transition-colors',
  {
    variants: {
      highlighted: {
        true: 'bg-accent/10',
        false: 'hover:bg-ink-900/5',
      },
    },
    defaultVariants: {
      highlighted: false,
    },
  }
);

// ============================================================================
// 3. UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate the number of rows for auto-resizing textarea
 */
function calculateRows(value: string, minRows: number, maxRows: number): number {
  const lineBreaks = (value.match(/\n/g) || []).length;
  const rows = Math.max(minRows, Math.min(lineBreaks + 1, maxRows));
  return rows;
}

/**
 * Filter slash commands based on input text
 */
function filterSlashCommands(
  commands: SlashCommand[],
  filter: string
): SlashCommand[] {
  const normalizedFilter = filter.toLowerCase().trim();
  if (!normalizedFilter) return commands;

  return commands.filter(
    (cmd) =>
      cmd.id.toLowerCase().includes(normalizedFilter) ||
      cmd.label.toLowerCase().includes(normalizedFilter) ||
      (cmd.description?.toLowerCase().includes(normalizedFilter) ?? false)
  );
}

// ============================================================================
// 4. SUB-COMPONENTS
// ============================================================================

/**
 * Slash command menu popup
 */
function ComposerSlashMenu({
  commands,
  onSelect,
  onClose,
  filterText,
}: ComposerSlashMenuProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const filteredCommands = useMemo(
    () => filterSlashCommands(commands, filterText),
    [commands, filterText]
  );

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filterText]);

  // Handle keyboard navigation within the menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredCommands.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          onSelect(filteredCommands[highlightedIndex].id);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredCommands, highlightedIndex, onSelect, onClose]);

  if (filteredCommands.length === 0) {
    return (
      <div className={cn(slashMenuVariants())}>
        <div className="px-4 py-3 text-sm text-ink-500 italic">
          No matching commands
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(slashMenuVariants())}
      role="listbox"
      aria-label="Slash commands"
    >
      {filteredCommands.map((cmd: SlashCommand, index: number) => (
        <div
          key={cmd.id}
          className={cn(
            slashMenuItemVariants({ highlighted: index === highlightedIndex })
          )}
          onClick={() => onSelect(cmd.id)}
          onMouseEnter={() => setHighlightedIndex(index)}
          role="option"
          aria-selected={index === highlightedIndex}
        >
          <div className="flex items-center gap-3">
            <span className="font-medium text-ink-900">/{cmd.label}</span>
            {cmd.description && (
              <span className="text-xs text-ink-500">{cmd.description}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 5. MAIN COMPONENT
// ============================================================================

function Composer({
  className,
  size,
  value,
  onChange,
  onSubmit,
  placeholder = 'Type a message...',
  disabled = false,
  loading = false,
  maxLength,
  showCharacterCount = false,
  submitLabel = 'Send message',
  submitShortcut = 'Enter',
  attachmentSlot,
  slashCommands = [],
  onSlashCommand,
  minRows = 1,
  maxRows = 8,
  ...props
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');

  // Check if over character limit
  const isOverLimit =
    maxLength !== undefined && value.length > maxLength;
  const characterCount = value.length;
  const characterCountColor = isOverLimit
    ? 'text-red-600'
    : maxLength && characterCount > maxLength * 0.9
      ? 'text-amber-600'
      : 'text-ink-500';

  // Determine if slash menu should be shown
  const isSlashActive = value.startsWith('/') && showSlashMenu;

  // Auto-resize textarea
  const rows = calculateRows(value, minRows, maxRows);

  // Handle value changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Show slash menu when typing "/"
    if (newValue.startsWith('/')) {
      setShowSlashMenu(true);
      const filterText = newValue.slice(1).split(/\s/)[0];
      setSlashFilter(filterText);
    } else {
      setShowSlashMenu(false);
      setSlashFilter('');
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to submit (unless Shift is held for newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      // Don't submit if slash menu is open (let it handle Enter)
      if (isSlashActive && slashCommands.length > 0) {
        return;
      }

      e.preventDefault();
      if (!disabled && !loading && value.trim() && !isOverLimit) {
        onSubmit();
        setShowSlashMenu(false);
      }
    }

    // Escape to close slash menu
    if (e.key === 'Escape') {
      setShowSlashMenu(false);
    }
  };

  // Handle slash command selection
  const handleSlashSelect = (commandId: string) => {
    if (onSlashCommand) {
      onSlashCommand(commandId);
    }
    // Insert the command into the input
    onChange(`/${commandId} `);
    setShowSlashMenu(false);
    textareaRef.current?.focus();
  };

  // Handle submit button click
  const handleSubmit = () => {
    if (!disabled && !loading && value.trim() && !isOverLimit) {
      onSubmit();
      setShowSlashMenu(false);
    }
  };

  // Close slash menu when clicking outside
  useEffect(() => {
    if (!showSlashMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (textareaRef.current && !textareaRef.current.contains(target)) {
        setShowSlashMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSlashMenu]);

  return (
    <div
      className={cn(composerVariants({ size, disabled }), className)}
      {...props}
    >
      {/* Slash Command Menu */}
      {isSlashActive && slashCommands.length > 0 && (
        <div className="relative">
          <ComposerSlashMenu
            commands={slashCommands}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlashMenu(false)}
            filterText={slashFilter}
          />
        </div>
      )}

      {/* Input Container */}
      <div
        className={cn(
          composerInputContainerVariants({ disabled, isOverLimit })
        )}
      >
        {/* Attachment Slot (left side) */}
        {attachmentSlot && (
          <div className="flex-shrink-0 pb-1">{attachmentSlot}</div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={rows}
          className={cn(composerTextareaVariants({ size }))}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          style={{
            minHeight: `${minRows * 1.5}rem`,
            maxHeight: `${maxRows * 1.5}rem`,
          }}
          aria-label={placeholder}
          aria-describedby={
            showCharacterCount ? 'composer-char-count' : undefined
          }
        />

        {/* Submit Button */}
        <Button
          variant="primary"
          size="icon-sm"
          onClick={handleSubmit}
          disabled={disabled || loading || !value.trim() || isOverLimit}
          isLoading={loading}
          className="rounded-full flex-shrink-0"
          aria-label={submitLabel}
          title={`${submitLabel} (${submitShortcut})`}
        >
          {!loading && <Send className="h-4 w-4" />}
        </Button>
      </div>

      {/* Character Count & Hint */}
      {(showCharacterCount || submitShortcut) && (
        <div className="flex items-center justify-between px-1">
          {showCharacterCount && maxLength !== undefined && (
            <span
              id="composer-char-count"
              className={cn('text-xs transition-colors', characterCountColor)}
            >
              {characterCount}
              <span className="text-ink-400">/{maxLength}</span>
            </span>
          )}
          {showCharacterCount && maxLength === undefined && (
            <span className="text-xs text-ink-400">
              {characterCount} characters
            </span>
          )}
          {!showCharacterCount && <div />}

          {submitShortcut && (
            <span className="text-xs text-ink-400">
              {submitShortcut} to send, Shift+Enter for new line
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. EXPORTS
// ============================================================================

export {
  Composer,
  ComposerSlashMenu,
  composerVariants,
  composerInputContainerVariants,
  composerTextareaVariants,
};

export type { ComposerProps, ComposerSlashMenuProps, SlashCommand };
export default Composer;
