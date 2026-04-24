import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAppStore } from "../store/useAppStore";
import { useMessageWindow } from "../hooks/useMessageWindow";
import { useIPC } from "../hooks/useIPC";
import type { ServerEvent } from "../types";
import { MessageCard } from "./EventCard";
import { PromptInput } from "./PromptInput";
import MDContent from "../render/markdown";
import { AgentMemoryPanel } from "./AgentMemoryPanel";
import { AgentConfigPanel } from "./AgentConfigPanel";

const SCROLL_THRESHOLD = 50;

interface AgentWorkspaceProps {
  agentId: string;
  onBack: () => void;
  sendEvent: (event: ServerEvent) => void;
}

// Placeholder for slash commands - can be extended
const SLASH_COMMANDS = [
  { command: "/clear", description: "Clear conversation" },
  { command: "/doctor", description: "Run diagnostics" },
  { command: "/memory", description: "View memory" },
];

export function AgentWorkspace({ agentId, onBack, sendEvent }: AgentWorkspaceProps) {
  // Store integration
  const agent = useAppStore((s) => s.agents[agentId]);
  const loadAgent = useAppStore((s) => s.loadAgent);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const setActiveConversationId = useAppStore((s) => s.setActiveConversationId);
  const handleServerEvent = useAppStore((s) => s.handleServerEvent);

  // Chat state
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const partialMessageRef = useRef("");
  const [partialMessage, setPartialMessage] = useState("");
  const [showPartialMessage, setShowPartialMessage] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const scrollHeightBeforeLoadRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);
  const prevMessagesLengthRef = useRef(0);

  // Load agent if not loaded
  useEffect(() => {
    if (!agent?.loaded) {
      loadAgent(agentId);
    }
  }, [agentId, agent?.loaded, loadAgent]);

  // Handle partial messages from stream events
  const handlePartialMessages = useCallback((partialEvent: ServerEvent) => {
    if (partialEvent.type !== "stream.message" || partialEvent.payload.message.type !== "stream_event") return;

    const message = partialEvent.payload.message as { type: "stream_event"; event: { type: string; delta?: { text?: string; reasoning?: string } } };
    const event = message.event;

    if (event.type === "content_block_start") {
      partialMessageRef.current = "";
      setPartialMessage(partialMessageRef.current);
      setShowPartialMessage(true);
    }

    if (event.type === "content_block_delta" && event.delta) {
      const text = event.delta.text || event.delta.reasoning || "";
      partialMessageRef.current += text;
      setPartialMessage(partialMessageRef.current);
      if (shouldAutoScroll) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        setHasNewMessages(true);
      }
    }

    if (event.type === "content_block_stop") {
      setShowPartialMessage(false);
      setTimeout(() => {
        partialMessageRef.current = "";
        setPartialMessage(partialMessageRef.current);
      }, 500);
    }
  }, [shouldAutoScroll]);

  // Event handler for IPC
  const onEvent = useCallback((event: ServerEvent) => {
    handleServerEvent(event);
    handlePartialMessages(event);
  }, [handleServerEvent, handlePartialMessages]);

  const { connected } = useIPC(onEvent);

  // Get active conversation messages
  const activeConversation = agent?.conversations?.find(c => c.id === activeConversationId);
  const messages = activeConversation?.messages ?? [];
  const permissionRequests = activeConversation?.permissionRequests ?? [];
  const isRunning = activeConversation?.status === "running";

  const {
    visibleMessages,
    hasMoreHistory,
    isLoadingHistory,
    loadMoreMessages,
    resetToLatest,
    totalMessages,
  } = useMessageWindow(messages, permissionRequests, activeConversationId);

  // Scroll handling
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - SCROLL_THRESHOLD;

    if (isAtBottom !== shouldAutoScroll) {
      setShouldAutoScroll(isAtBottom);
      if (isAtBottom) {
        setHasNewMessages(false);
      }
    }
  }, [shouldAutoScroll]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMoreHistory && !isLoadingHistory) {
          scrollHeightBeforeLoadRef.current = container.scrollHeight;
          shouldRestoreScrollRef.current = true;
          loadMoreMessages();
        }
      },
      {
        root: container,
        rootMargin: "100px 0px 0px 0px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreHistory, isLoadingHistory, loadMoreMessages]);

  // Restore scroll after loading history
  useEffect(() => {
    if (shouldRestoreScrollRef.current && !isLoadingHistory) {
      const container = scrollContainerRef.current;
      if (container) {
        const newScrollHeight = container.scrollHeight;
        const scrollDiff = newScrollHeight - scrollHeightBeforeLoadRef.current;
        container.scrollTop += scrollDiff;
      }
      shouldRestoreScrollRef.current = false;
    }
  }, [visibleMessages, isLoadingHistory]);

  // Reset scroll on conversation change
  useEffect(() => {
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    prevMessagesLengthRef.current = 0;
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, 100);
  }, [activeConversationId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (messages.length > prevMessagesLengthRef.current && prevMessagesLengthRef.current > 0) {
      setHasNewMessages(true);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, partialMessage, shouldAutoScroll]);

  const scrollToBottom = useCallback(() => {
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    resetToLatest();
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [resetToLatest]);

  const handleSendMessage = useCallback(() => {
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    resetToLatest();
  }, [resetToLatest]);

  // Handle slash command
  const handleCommand = useCallback((command: string) => {
    setShowCommands(false);
    // TODO: Implement command handling
    console.log("Command:", command);
  }, []);

  // Get display model name
  const getModelDisplay = (model: string) => {
    if (!model) return "Unknown";
    return model.split('/').pop()?.split(':')[0] || model;
  };

  if (!agent?.loaded) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-cream">
        <div className="flex items-center gap-3 text-ink-600">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading agent...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Agent Header */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-ink-900/10 bg-surface">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm">
              {agent.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-ink-900">{agent.name}</h1>
              <span className="text-xs text-ink-500">{getModelDisplay(agent.model)}</span>
            </div>
          </div>

          {/* Model Badge */}
          <span className="px-2 py-0.5 text-xs font-medium bg-accent/10 text-accent rounded">
            {getModelDisplay(agent.model)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Conversation Selector */}
          {agent.conversations && agent.conversations.length > 0 && (
            <select
              value={activeConversationId || ""}
              onChange={(e) => setActiveConversationId(e.target.value || null)}
              className="px-3 py-1.5 text-sm bg-surface-cream border border-ink-900/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {agent.conversations.map((conv) => (
                <option key={conv.id} value={conv.id}>
                  {conv.name || `Conversation ${conv.id.slice(0, 8)}`}
                </option>
              ))}
            </select>
          )}

          {/* Slash Commands Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowCommands(!showCommands)}
              className="px-3 py-1.5 text-sm font-medium text-ink-600 hover:text-ink-900 hover:bg-ink-900/5 rounded-lg transition-colors"
            >
              / Commands
            </button>
            {showCommands && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-ink-900/10 rounded-lg shadow-lg z-50 py-1">
                {SLASH_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.command}
                    onClick={() => handleCommand(cmd.command)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-ink-900/5 flex items-center justify-between"
                  >
                    <span className="font-medium text-ink-900">{cmd.command}</span>
                    <span className="text-xs text-ink-500">{cmd.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 3-Pane Layout */}
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left: Memory Panel */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <AgentMemoryPanel agentId={agentId} />
        </Panel>

        <PanelResizeHandle className="w-1 bg-ink-900/10 hover:bg-accent/50 transition-colors" />

        {/* Center: Chat Panel */}
        <Panel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-surface-cream">
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-6 pb-32 pt-4"
            >
              <div className="mx-auto max-w-3xl">
                <div ref={topSentinelRef} className="h-1" />

                {!hasMoreHistory && totalMessages > 0 && (
                  <div className="flex items-center justify-center py-4 mb-4">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <div className="h-px w-12 bg-ink-900/10" />
                      <span>Beginning of conversation</span>
                      <div className="h-px w-12 bg-ink-900/10" />
                    </div>
                  </div>
                )}

                {isLoadingHistory && (
                  <div className="flex items-center justify-center py-4 mb-4">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Loading...</span>
                    </div>
                  </div>
                )}

                {visibleMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="text-lg font-medium text-ink-700">No messages yet</div>
                    <p className="mt-2 text-sm text-muted">Start a conversation with {agent.name}</p>
                  </div>
                ) : (
                  visibleMessages.map((item, idx) => (
                    <MessageCard
                      key={`${activeConversationId}-msg-${item.originalIndex}`}
                      message={item.message}
                      isLast={idx === visibleMessages.length - 1}
                      isRunning={isRunning}
                      permissionRequest={permissionRequests[0]}
                      onPermissionResult={() => {}}
                    />
                  ))
                )}

                {partialMessage && (
                  <div className="partial-message mt-4">
                    <div className="header text-accent">Assistant</div>
                    <MDContent text={partialMessage} />
                  </div>
                )}
                {showPartialMessage && !partialMessage && (
                  <div className="mt-3 flex flex-col gap-2 px-1">
                    <div className="relative h-3 w-2/12 overflow-hidden rounded-full bg-ink-900/10">
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                    </div>
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <PromptInput
              sendEvent={sendEvent}
              onSendMessage={handleSendMessage}
              disabled={!activeConversationId}
            />

            {hasNewMessages && (
              <button
                onClick={scrollToBottom}
                className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-accent-hover hover:scale-105"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
                <span>New messages</span>
              </button>
            )}
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-ink-900/10 hover:bg-accent/50 transition-colors" />

        {/* Right: Config Panel */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <AgentConfigPanel agentId={agentId} />
        </Panel>
      </PanelGroup>
    </div>
  );
}
