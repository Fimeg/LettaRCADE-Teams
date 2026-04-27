import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  Copy,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  Wrench,
  Terminal,
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../composites/Card';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';
import { cn } from '../../../utils/cn';
import type {
  SDKAssistantMessage,
  SDKReasoningMessage,
  SDKToolCallMessage,
  SDKToolResultMessage,
  SDKInitMessage,
} from '../../../types';
import { useToolStatus, useSetToolStatus } from '../../../contexts';

// ============================================================================
// MESSAGE TYPE DEFINITIONS
// ============================================================================

/** Unified message type that MessageCard can render */
export type MessageCardMessage =
  | { type: 'user'; content: string; timestamp?: Date }
  | { type: 'assistant'; message: SDKAssistantMessage; timestamp?: Date }
  | { type: 'reasoning'; message: SDKReasoningMessage; timestamp?: Date }
  | { type: 'tool_call'; message: SDKToolCallMessage; timestamp?: Date }
  | { type: 'tool_result'; message: SDKToolResultMessage; timestamp?: Date }
  | { type: 'init'; message: SDKInitMessage; timestamp?: Date }
  | { type: 'error'; content: string; timestamp?: Date };

/** Props for rendering tool information */
export interface ToolCallInfo {
  name: string;
  input?: Record<string, unknown>;
  toolCallId?: string;
  status?: 'pending' | 'success' | 'error';
}

// ============================================================================
// VARIANT CONFIGURATION
// ============================================================================

const messageCardVariants = cva(
  'w-full transition-all duration-200',
  {
    variants: {
      variant: {
        default: '',
        compact: '',
        minimal: 'border-0 bg-transparent shadow-none',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// ============================================================================
// CONTENT EXTRACTION HELPER
// ============================================================================

function extractContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.value === 'string') return obj.value;
  }
  return '';
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Animated status dot for streaming indicators */
const StatusDot = ({
  variant = 'accent',
  isActive = false,
  isVisible = true,
}: {
  variant?: 'accent' | 'success' | 'error';
  isActive?: boolean;
  isVisible?: boolean;
}) => {
  if (!isVisible) return null;
  const colorClass =
    variant === 'success'
      ? 'bg-status-success'
      : variant === 'error'
      ? 'bg-status-error'
      : 'bg-accent';
  return (
    <span className="relative flex h-2 w-2">
      {isActive && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colorClass} opacity-75`}
        />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${colorClass}`} />
    </span>
  );
};

/** Avatar component for message senders */
const MessageCardAvatar = ({
  initials,
  src,
  color = 'accent',
  size = 'md',
  fallbackIcon: FallbackIcon = Bot,
}: {
  initials?: string;
  src?: string;
  color?: 'accent' | 'success' | 'muted';
  size?: 'sm' | 'md' | 'lg';
  fallbackIcon?: React.ComponentType<{ className?: string }>;
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  const colorClasses = {
    accent: 'bg-accent text-white',
    success: 'bg-status-success text-white',
    muted: 'bg-surface-tertiary text-ink-500',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={initials || 'Avatar'}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-medium',
        sizeClasses[size],
        colorClasses[color]
      )}
    >
      {initials ? (
        <span>{initials}</span>
      ) : (
        <FallbackIcon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      )}
    </div>
  );
};

/** Collapsible reasoning section */
const MessageCardReasoning = ({
  content,
  defaultExpanded = false,
  isStreaming = false,
}: {
  content: string;
  defaultExpanded?: boolean;
  isStreaming?: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="mt-3 rounded-xl bg-surface-tertiary/50 border border-ink-900/5 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-ink-500 hover:text-ink-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="font-medium">Thinking</span>
          {isStreaming && (
            <Loader2 className="h-3 w-3 animate-spin text-accent" />
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3">
          <div className="text-sm text-ink-600 italic whitespace-pre-wrap">
            {content}
          </div>
        </div>
      )}
    </div>
  );
};

/** Tool call display with status */
const MessageCardToolCall = ({
  message,
  isStreaming = false,
}: {
  message: SDKToolCallMessage;
  isStreaming?: boolean;
}) => {
  const toolStatus = useToolStatus(message.toolCallId);
  const setToolStatus = useSetToolStatus();
  const status = toolStatus || 'pending';
  const isPending = status === 'pending';

  useEffect(() => {
    if (message.toolCallId) {
      setToolStatus(message.toolCallId, 'pending');
    }
  }, [message.toolCallId, setToolStatus]);

  const getToolInfo = (): string | null => {
    const input = message.toolInput as Record<string, unknown> | undefined;
    switch (message.toolName) {
      case 'Bash':
        return (input?.command as string) || null;
      case 'Read':
      case 'Write':
      case 'Edit':
        return (input?.file_path as string) || null;
      case 'Glob':
      case 'Grep':
        return (input?.pattern as string) || null;
      case 'Task':
        return (input?.description as string) || null;
      case 'WebFetch':
        return (input?.url as string) || null;
      default:
        return null;
    }
  };

  const toolInfo = getToolInfo();

  return (
    <div className="mt-3 rounded-xl bg-surface-tertiary border border-ink-900/10 overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2">
        <StatusDot
          variant={status === 'error' ? 'error' : 'success'}
          isActive={isPending && isStreaming}
          isVisible={true}
        />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Wrench className="h-4 w-4 text-accent shrink-0" />
          <span className="font-medium text-ink-700 text-sm shrink-0">
            {message.toolName}
          </span>
          {toolInfo && (
            <span className="text-sm text-ink-500 truncate">{toolInfo}</span>
          )}
        </div>
      </div>
    </div>
  );
};

/** Tool result display with expandable output */
const MessageCardToolResult = ({
  message,
}: {
  message: SDKToolResultMessage;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const setToolStatus = useSetToolStatus();
  const MAX_VISIBLE_LINES = 3;

  const isError = message.isError;
  const contentText = extractContentText(message.content);
  const lines = contentText.split('\n');
  const hasMoreLines = lines.length > MAX_VISIBLE_LINES;
  const visibleContent =
    hasMoreLines && !isExpanded
      ? lines.slice(0, MAX_VISIBLE_LINES).join('\n')
      : contentText;

  useEffect(() => {
    if (message.toolCallId) {
      setToolStatus(message.toolCallId, isError ? 'error' : 'success');
    }
  }, [message.toolCallId, isError, setToolStatus]);

  useEffect(() => {
    if (!hasMoreLines || isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [hasMoreLines, isExpanded]);

  return (
    <div className="mt-2 rounded-xl bg-surface-tertiary border border-ink-900/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-900/5">
        <Terminal
          className={`h-4 w-4 ${isError ? 'text-status-error' : 'text-status-success'}`}
        />
        <span
          className={`text-xs font-medium ${
            isError ? 'text-status-error' : 'text-ink-500'
          }`}
        >
          {isError ? 'Error' : 'Output'}
        </span>
        {isError && <XCircle className="h-3 w-3 text-status-error ml-auto" />}
        {!isError && <CheckCircle className="h-3 w-3 text-status-success ml-auto" />}
      </div>
      <div className="p-3">
        <div
          className={`text-sm font-mono whitespace-pre-wrap break-words ${
            isError ? 'text-status-error' : 'text-ink-700'
          }`}
        >
          {visibleContent}
        </div>
        {hasMoreLines && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Show{' '}
                {lines.length - MAX_VISIBLE_LINES} more lines
              </>
            )}
          </button>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface MessageCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof messageCardVariants> {
  /** The message to display */
  message: MessageCardMessage;

  /** Visual variant determining styling */
  variant?: 'default' | 'compact' | 'minimal';

  /** Whether to show the reasoning section (if present) expanded */
  showReasoning?: boolean;

  /** Whether this is the last message in the stream (controls active indicators) */
  isLast?: boolean;

  /** Whether the conversation is currently streaming */
  isStreaming?: boolean;

  /** Display name for the assistant */
  assistantName?: string;

  /** Avatar configuration */
  avatar?: {
    initials?: string;
    src?: string;
    color?: 'accent' | 'success' | 'muted';
  };

  /** Callback when copy button is clicked - receives the content string */
  onCopyContent?: (content: string) => void;

  /** Whether to show timestamp */
  showTimestamp?: boolean;

  /** Custom timestamp formatter */
  formatTimestamp?: (date: Date) => string;
}

const MessageCard = React.forwardRef<HTMLDivElement, MessageCardProps>(
  (
    {
      className,
      variant = 'default',
      message,
      showReasoning = false,
      isLast = false,
      isStreaming = false,
      assistantName = 'Assistant',
      avatar,
      onCopyContent,
      showTimestamp = true,
      formatTimestamp = (date) =>
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...props
    },
    ref
  ) => {
    const [isCopied, setIsCopied] = useState(false);

    const showIndicator = isLast && isStreaming;

    // Extract content for copy functionality
    const getContentForCopy = (): string => {
      switch (message.type) {
        case 'user':
          return message.content;
        case 'assistant':
          return extractContentText(message.message.content);
        case 'reasoning':
          return extractContentText(message.message.content);
        case 'tool_result':
          return extractContentText(message.message.content);
        case 'error':
          return message.content;
        case 'init':
          return `Session started\nConversation ID: ${message.message.conversationId || '-'}\nModel: ${message.message.model || '-'}`;
        default:
          return '';
      }
    };

    const handleCopy = () => {
      const content = getContentForCopy();
      if (onCopyContent) {
        onCopyContent(content);
      } else {
        navigator.clipboard.writeText(content);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    };

    // Variant-based styling adjustments
    const isCompact = variant === 'compact';
    const isMinimal = variant === 'minimal';
    const headerPadding = isCompact ? 'p-3' : isMinimal ? 'px-0 py-2' : 'p-5';
    const contentPadding = isCompact
      ? 'px-3 pb-3'
      : isMinimal
      ? 'px-0 py-2'
      : 'px-5 pb-5';

    // Render user message
    if (message.type === 'user') {
      return (
        <Card
          ref={ref}
          className={cn(
            messageCardVariants({ variant }),
            'bg-accent/5 border-accent/10',
            className
          )}
          {...props}
        >
          <CardHeader className={cn('flex flex-row items-center gap-3', headerPadding)}>
            <MessageCardAvatar
              initials={avatar?.initials || 'ME'}
              src={avatar?.src}
              color={avatar?.color || 'accent'}
              size={isCompact ? 'sm' : 'md'}
              fallbackIcon={User}
            />
            <div className="flex-1">
              <div className="font-medium text-ink-900">You</div>
              {showTimestamp && message.timestamp && (
                <div className="text-xs text-ink-500">
                  {formatTimestamp(message.timestamp)}
                </div>
              )}
            </div>
            {!isMinimal && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopy}
                title={isCopied ? 'Copied!' : 'Copy message'}
              >
                <Icon
                  icon={isCopied ? CheckCircle : Copy}
                  size="sm"
                  className={isCopied ? 'text-status-success' : 'text-ink-500'}
                />
              </Button>
            )}
          </CardHeader>
          <CardContent className={contentPadding}>
            <div className="whitespace-pre-wrap">{message.content}</div>
          </CardContent>
        </Card>
      );
    }

    // Render assistant message
    if (message.type === 'assistant') {
      const contentText = extractContentText(message.message.content);

      return (
        <Card
          ref={ref}
          className={cn(messageCardVariants({ variant }), className)}
          {...props}
        >
          <CardHeader className={cn('flex flex-row items-center gap-3', headerPadding)}>
            <MessageCardAvatar
              initials={avatar?.initials || assistantName.slice(0, 2).toUpperCase()}
              src={avatar?.src}
              color={avatar?.color || 'success'}
              size={isCompact ? 'sm' : 'md'}
              fallbackIcon={Bot}
            />
            <div className="flex-1">
              <div className="font-medium text-ink-900 flex items-center gap-2">
                {assistantName}
                <StatusDot
                  variant="success"
                  isActive={showIndicator}
                  isVisible={showIndicator}
                />
              </div>
              {showTimestamp && message.timestamp && (
                <div className="text-xs text-ink-500">
                  {formatTimestamp(message.timestamp)}
                </div>
              )}
            </div>
            {!isMinimal && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopy}
                title={isCopied ? 'Copied!' : 'Copy message'}
              >
                <Icon
                  icon={isCopied ? CheckCircle : Copy}
                  size="sm"
                  className={isCopied ? 'text-status-success' : 'text-ink-500'}
                />
              </Button>
            )}
          </CardHeader>
          <CardContent className={contentPadding}>
            <div className="whitespace-pre-wrap">{contentText}</div>
          </CardContent>
        </Card>
      );
    }

    // Render reasoning message
    if (message.type === 'reasoning') {
      const contentText = extractContentText(message.message.content);

      return (
        <Card
          ref={ref}
          className={cn(
            messageCardVariants({ variant }),
            'bg-surface-tertiary/30 border-ink-900/5',
            className
          )}
          {...props}
        >
          <CardContent className={cn(contentPadding, 'pt-4')}>
            <MessageCardReasoning
              content={contentText}
              defaultExpanded={showReasoning}
              isStreaming={showIndicator}
            />
          </CardContent>
        </Card>
      );
    }

    // Render tool call message
    if (message.type === 'tool_call') {
      return (
        <Card
          ref={ref}
          className={cn(
            messageCardVariants({ variant }),
            'bg-surface-tertiary/30 border-ink-900/5',
            className
          )}
          {...props}
        >
          <CardContent className={cn(contentPadding, 'pt-4')}>
            <MessageCardToolCall
              message={message.message}
              isStreaming={isStreaming}
            />
          </CardContent>
        </Card>
      );
    }

    // Render tool result message
    if (message.type === 'tool_result') {
      return (
        <Card
          ref={ref}
          className={cn(
            messageCardVariants({ variant }),
            'border-ink-900/5',
            className
          )}
          {...props}
        >
          <CardContent className={cn(contentPadding, 'pt-4')}>
            <MessageCardToolResult message={message.message} />
          </CardContent>
        </Card>
      );
    }

    // Render init message
    if (message.type === 'init') {
      return (
        <Card
          ref={ref}
          className={cn(
            messageCardVariants({ variant }),
            'bg-surface-secondary border-ink-900/10',
            className
          )}
          {...props}
        >
          <CardHeader className={cn('flex flex-row items-center gap-3', headerPadding)}>
            <div className="flex items-center gap-2 text-accent">
              <StatusDot
                variant="success"
                isActive={showIndicator}
                isVisible={showIndicator}
              />
              <span className="font-medium">Session Started</span>
            </div>
          </CardHeader>
          <CardContent className={contentPadding}>
            <div className="space-y-1 text-sm">
              <div className="flex gap-4">
                <span className="text-ink-500">Conversation ID</span>
                <span className="text-ink-700">
                  {message.message.conversationId || '-'}
                </span>
              </div>
              <div className="flex gap-4">
                <span className="text-ink-500">Model</span>
                <span className="text-ink-700">{message.message.model || '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Render error message
    if (message.type === 'error') {
      return (
        <Card
          ref={ref}
          className={cn(
            messageCardVariants({ variant }),
            'bg-status-error/5 border-status-error/20',
            className
          )}
          {...props}
        >
          <CardHeader className={cn('flex flex-row items-center gap-3', headerPadding)}>
            <XCircle className="h-5 w-5 text-status-error" />
            <div className="font-medium text-status-error">Error</div>
          </CardHeader>
          <CardContent className={contentPadding}>
            <div className="text-sm text-status-error/80 whitespace-pre-wrap">
              {message.content}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Unknown message type
    return null;
  }
);

MessageCard.displayName = 'MessageCard';

// ============================================================================
// EXPORTS
// ============================================================================

export { MessageCard };
export default MessageCard;
