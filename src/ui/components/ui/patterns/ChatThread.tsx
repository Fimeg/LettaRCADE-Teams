/**
 * ChatThread Component - Virtualized message list with auto-scroll and date separators
 *
 * Features:
 * - Message list container with proper scrolling
 * - Auto-scroll to bottom on new messages
 * - Scroll-to-bottom button
 * - Date separators between days
 * - Typing indicator slot
 * - Empty state (no messages yet)
 * - Load more/history pagination
 *
 * Uses MessageCard business component.
 * Reference existing AgentWorkspace message list for behavior patterns.
 */

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { cva } from 'class-variance-authority';
import { ChevronDown, Calendar, Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

// ============================================================================
// 1. TYPE DEFINITIONS
// ============================================================================

interface ChatThreadProps<T> {
  /** Messages to display */
  messages: T[];
  /** Render function for each message */
  renderMessage: (message: T, index: number) => React.ReactNode;
  /** Unique key extractor */
  keyExtractor: (message: T) => string;
  /** Typing indicator content */
  typingIndicator?: React.ReactNode;
  /** Custom empty state content */
  emptyState?: React.ReactNode;
  /** Whether there are more messages to load */
  hasMore?: boolean;
  /** Load more callback */
  onLoadMore?: () => void;
  /** Loading more state */
  isLoadingMore?: boolean;
  /** Whether to auto-scroll on new messages */
  scrollToBottomOnNew?: boolean;
  /** Enable date separators between days */
  enableDateSeparators?: boolean;
  /** Get date from message for separators */
  getMessageDate?: (message: T) => Date | null;
  /** Additional className */
  className?: string;
  /** Thread size variant */
  size?: 'sm' | 'md' | 'lg';
}

interface ChatThreadDateSeparatorProps {
  /** Date to display */
  date: Date;
}

interface ChatThreadScrollButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Unread count to display */
  unreadCount?: number;
}

// ============================================================================
// 2. VARIANT CONFIGURATION (cva)
// ============================================================================

const chatThreadVariants = cva(
  'flex flex-col overflow-hidden bg-surface',
  {
    variants: {
      size: {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const scrollButtonVariants = cva(
  'absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-2 rounded-full bg-accent text-white shadow-lg hover:bg-accent-hover transition-all',
  {
    variants: {
      visible: {
        true: 'opacity-100 translate-y-0',
        false: 'opacity-0 translate-y-4 pointer-events-none',
      },
    },
    defaultVariants: {
      visible: true,
    },
  }
);

const dateSeparatorVariants = cva(
  'flex items-center justify-center py-4 sticky top-0 z-10'
);

// ============================================================================
// 3. UTILITY FUNCTIONS
// ============================================================================

/**
 * Format date for separator display
 */
function formatDateSeparator(date: Date): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Check if two dates are on different days
 */
function isDifferentDay(date1: Date | null, date2: Date | null): boolean {
  if (!date1 || !date2) return false;
  return date1.toDateString() !== date2.toDateString();
}

// ============================================================================
// 4. SUB-COMPONENTS
// ============================================================================

/**
 * Date separator between message days
 */
function ChatThreadDateSeparator({ date }: ChatThreadDateSeparatorProps) {
  return (
    <div className={cn(dateSeparatorVariants())}>
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-secondary border border-ink-900/10 shadow-sm">
        <Calendar className="h-3 w-3 text-ink-400" />
        <span className="text-xs font-medium text-ink-600">
          {formatDateSeparator(date)}
        </span>
      </div>
    </div>
  );
}

/**
 * Scroll to bottom button
 */
function ChatThreadScrollButton({
  onClick,
  unreadCount,
}: ChatThreadScrollButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(scrollButtonVariants({ visible: true }))}
    >
      {unreadCount !== undefined && unreadCount > 0 && (
        <span className="text-xs font-medium bg-white/20 px-1.5 py-0.5 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      <ChevronDown className="h-4 w-4" />
    </button>
  );
}

/**
 * Default empty state
 */
function ChatThreadEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-secondary flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-ink-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
      <h3 className="text-base font-medium text-ink-900 mb-1">
        No messages yet
      </h3>
      <p className="text-sm text-ink-500 max-w-xs">
        Send a message to start the conversation.
      </p>
    </div>
  );
}

/**
 * Typing indicator component
 */
function ChatThreadTypingIndicator({ name }: { name?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      {name && (
        <span className="text-xs text-ink-500">{name} is typing...</span>
      )}
    </div>
  );
}

/**
 * Loading more indicator
 */
function ChatThreadLoadingMore() {
  return (
    <div className="flex items-center justify-center py-4">
      <Loader2 className="h-5 w-5 animate-spin text-accent" />
      <span className="ml-2 text-sm text-ink-500">Loading more...</span>
    </div>
  );
}

// ============================================================================
// 5. MAIN COMPONENT
// ============================================================================

function ChatThread<T>({
  messages,
  renderMessage,
  keyExtractor,
  typingIndicator,
  emptyState,
  hasMore,
  onLoadMore,
  isLoadingMore,
  scrollToBottomOnNew = true,
  enableDateSeparators = true,
  getMessageDate,
  className,
  size,
}: ChatThreadProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastMessageCount = useRef(messages.length);
  const isScrolledToBottom = useRef(true);

  // Check if scrolled to bottom
  const checkScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const threshold = 100; // pixels from bottom
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;

    isScrolledToBottom.current = isNearBottom;
    setShowScrollButton(!isNearBottom);
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
    setShowScrollButton(false);
    setUnreadCount(0);
    isScrolledToBottom.current = true;
  }, []);

  // Handle scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkScrollPosition();

      // Load more when scrolled to top
      if (container.scrollTop < 50 && hasMore && !isLoadingMore && onLoadMore) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [checkScrollPosition, hasMore, isLoadingMore, onLoadMore]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > lastMessageCount.current) {
      const newMessages = messages.length - lastMessageCount.current;

      if (isScrolledToBottom.current && scrollToBottomOnNew) {
        // Small delay to allow render
        setTimeout(scrollToBottom, 50);
      } else {
        // Show unread indicator
        setUnreadCount((prev) => prev + newMessages);
      }
    }

    lastMessageCount.current = messages.length;
  }, [messages.length, scrollToBottomOnNew, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    if (scrollToBottomOnNew && messages.length > 0) {
      scrollToBottom();
    }
  }, []); // Only on mount

  // Empty state
  if (messages.length === 0 && !typingIndicator) {
    return (
      <div className={cn(chatThreadVariants({ size }), 'h-full', className)}>
        {emptyState || <ChatThreadEmptyState />}
      </div>
    );
  }

  // Render messages with date separators
  const renderMessagesWithSeparators = () => {
    const result: React.ReactNode[] = [];
    let lastDate: Date | null = null;

    messages.forEach((message, index) => {
      const messageDate = getMessageDate?.(message) || null;

      // Add date separator if different day
      if (
        enableDateSeparators &&
        messageDate &&
        isDifferentDay(messageDate, lastDate)
      ) {
        result.push(
          <ChatThreadDateSeparator key={`date-${index}`} date={messageDate} />
        );
      }

      lastDate = messageDate;

      // Add message
      result.push(
        <div key={keyExtractor(message)} className="px-4">
          {renderMessage(message, index)}
        </div>
      );
    });

    return result;
  };

  return (
    <div className={cn(chatThreadVariants({ size }), 'relative h-full', className)}>
      {/* Message list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1"
      >
        {/* Load more indicator */}
        {isLoadingMore && <ChatThreadLoadingMore />}

        {/* Messages */}
        {renderMessagesWithSeparators()}

        {/* Typing indicator */}
        {typingIndicator && (
          <div className="px-4">
            {typingIndicator}
          </div>
        )}

        {/* Bottom spacer for scroll */}
        <div className="h-2" />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <ChatThreadScrollButton
          onClick={scrollToBottom}
          unreadCount={unreadCount > 0 ? unreadCount : undefined}
        />
      )}
    </div>
  );
}

// ============================================================================
// 6. EXPORTS
// ============================================================================

export {
  ChatThread,
  ChatThreadDateSeparator,
  ChatThreadScrollButton,
  ChatThreadEmptyState,
  ChatThreadTypingIndicator,
  ChatThreadLoadingMore,
  chatThreadVariants,
  dateSeparatorVariants,
  scrollButtonVariants,
};

export type { ChatThreadProps, ChatThreadDateSeparatorProps, ChatThreadScrollButtonProps };
export default ChatThread;
