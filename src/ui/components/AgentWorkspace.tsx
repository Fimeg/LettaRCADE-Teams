import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { useAppStore } from "../store/useAppStore";
import { useMessageWindow } from "../hooks/useMessageWindow";
import { useIPC } from "../hooks/useIPC";
import { useLettaCodeWs, LettaCodeMessage } from "../hooks/useLettaCodeWs";
import { chatApi, getApiBase } from "../services/api";
import type { ClientEvent, ServerEvent, StreamMessage } from "../types";
import { MessageCard } from "./EventCard";
import MDContent from "../render/markdown";
import { AgentMemoryPanel } from "./AgentMemoryPanel";
import { AgentConfigPanel } from "./AgentConfigPanel";
import ConnectionModeIndicator, { ConnectionMode } from "./ConnectionModeIndicator";

const SCROLL_THRESHOLD = 50;

interface AgentWorkspaceProps {
  agentId: string;
  onBack: () => void;
  sendEvent: (event: ClientEvent) => void;
}

// ═══ Slash Commands ═══
interface SlashCommand {
  id: string;
  desc: string;
  requires: 'local' | 'any';
}

const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'doctor', desc: 'Audit and refine memory structure', requires: 'local' },
  { id: 'clear', desc: 'Clear in-context messages', requires: 'any' },
  { id: 'remember', desc: 'Remember something from conversation', requires: 'local' },
  { id: 'recompile', desc: 'Recompile agent memory', requires: 'any' },
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

  // Connection mode for slash commands
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('server');
  const [lettaCodeUrl, setLettaCodeUrl] = useState('ws://localhost:8283/ws');

  // Input state for slash commands
  const [inputValue, setInputValue] = useState('');
  const [showSlashCommands, setShowSlashCommands] = useState(false);

  // Letta-code WebSocket connection
  const {
    status: lettaCodeStatus,
    deviceStatus,
    subscribe: subscribeLettaCode,
    connect: connectLettaCode,
    disconnect: disconnectLettaCode,
    executeCommand,
  } = useLettaCodeWs(connectionMode === 'local' ? lettaCodeUrl : null);

  // API-loaded messages state
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Load agent if not loaded
  useEffect(() => {
    if (!agent?.loaded) {
      loadAgent(agentId);
    }
  }, [agentId, agent?.loaded, loadAgent]);

  // Load messages from API when conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      setMessagesError(null);
      try {
        const apiMessages = await chatApi.getMessages(activeConversationId);
        // Convert API messages to StreamMessage format
        const streamMessages: StreamMessage[] = apiMessages.map((msg): StreamMessage => {
          // Handle different content formats
          let content = '';
          if (typeof msg.content === 'string') {
            content = msg.content;
          } else if (msg.content && typeof msg.content === 'object') {
            if ('text' in msg.content && typeof msg.content.text === 'string') {
              content = msg.content.text;
            } else if (Array.isArray(msg.content)) {
              // Handle array format (e.g., content blocks)
              content = msg.content
                .filter(c => c.type === 'text' || typeof c.text === 'string')
                .map(c => c.text || '')
                .join('');
            }
          }

          const baseMessage = {
            uuid: msg.id,
            createdAt: msg.created_at ? new Date(msg.created_at).getTime() : Date.now(),
          };

          if (msg.role === 'user') {
            return { ...baseMessage, type: 'user_prompt' as const, prompt: content };
          } else if (msg.role === 'assistant') {
            return { ...baseMessage, type: 'assistant' as const, content };
          } else if (msg.role === 'system') {
            return { ...baseMessage, type: 'system' as const, content };
          } else {
            // Default to assistant for unknown roles
            return { ...baseMessage, type: 'assistant' as const, content };
          }
        });
        setMessages(streamMessages);
      } catch (err) {
        setMessagesError(err instanceof Error ? err.message : 'Failed to load messages');
        console.error('[AgentWorkspace] Failed to load messages:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [activeConversationId]);

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

  // IPC connection handled at App level
  useIPC(onEvent);

  // Permission requests and running state (managed via IPC/events)
  const permissionRequests: any[] = [];
  const isRunning = false;

  const {
    visibleMessages,
    hasMoreHistory,
    isLoadingHistory: isLoadingMoreHistory,
    loadMoreMessages,
    resetToLatest,
    totalMessages,
  } = useMessageWindow(messages, permissionRequests, activeConversationId);

  // Combined loading state (initial load or loading more history)
  const isLoadingHistory = isLoadingMessages || isLoadingMoreHistory;

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

  // Letta-code WebSocket events
  useEffect(() => {
    if (connectionMode !== 'local' || lettaCodeStatus !== 'connected') return;

    const unsubscribe = subscribeLettaCode((msg: LettaCodeMessage) => {
      // Handle stream_delta for command responses
      if (msg.type === 'stream_delta' && msg.delta) {
        const delta = msg.delta;
        if (delta.message_type === 'assistant_message') {
          const text = delta.content || '';
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.type === 'assistant' && last.uuid === delta.id) {
              return [...prev.slice(0, -1), { ...last, content: last.content + text }];
            }
            return [...prev, {
              uuid: delta.id || `msg-${Date.now()}`,
              createdAt: Date.now(),
              type: 'assistant',
              content: text,
            }];
          });
        } else if (delta.message_type === 'reasoning_message') {
          setMessages(prev => [...prev, {
            uuid: `reasoning-${Date.now()}`,
            createdAt: Date.now(),
            type: 'system',
            content: delta.reasoning || '',
          }]);
        }
      }
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [connectionMode, lettaCodeStatus, subscribeLettaCode]);

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

  // Handle sending input with slash command detection
  const handleInputSend = useCallback(async () => {
    if (!inputValue.trim() || !activeConversationId) return;

    const userMsg = inputValue.trim();
    setInputValue('');
    setShowSlashCommands(false);
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    resetToLatest();

    // Check for slash command
    if (userMsg.startsWith('/')) {
      const [cmd, ...args] = userMsg.slice(1).split(/\s+/);
      await handleSlashCommand(cmd, args.join(' '));
      return;
    }

    // Regular message - send via IPC
    sendEvent({
      type: 'session.continue',
      payload: {
        sessionId: activeConversationId,
        prompt: userMsg,
      }
    });
  }, [inputValue, activeConversationId, handleSlashCommand, resetToLatest, sendEvent]);

  // Handle slash command
  const handleCommand = useCallback((command: string) => {
    setShowCommands(false);
    // TODO: Implement command handling
    console.log("Command:", command);
  }, []);

  // ═══ SLASH COMMAND HANDLERS ═══

  const handleSlashCommand = useCallback(async (cmd: string, args: string) => {
    const cmdDef = SLASH_COMMANDS.find(c => c.id === cmd);

    if (!cmdDef) {
      setMessages(prev => [...prev, {
        uuid: `error-${Date.now()}`,
        createdAt: Date.now(),
        type: 'system' as const,
        content: `Unknown command: /${cmd}. Available: ${SLASH_COMMANDS.map(c => `/${c.id}`).join(', ')}`,
      }]);
      return;
    }

    // Check if command requires local mode
    if (cmdDef.requires === 'local' && connectionMode !== 'local') {
      setMessages(prev => [...prev, {
        uuid: `error-${Date.now()}`,
        createdAt: Date.now(),
        type: 'system' as const,
        content: `/${cmd} requires local mode. Switch to local mode first.`,
      }]);
      return;
    }

    // Check if letta-code is connected for local commands
    if (cmdDef.requires === 'local' && lettaCodeStatus !== 'connected') {
      setMessages(prev => [...prev, {
        uuid: `error-${Date.now()}`,
        createdAt: Date.now(),
        type: 'system' as const,
        content: `/${cmd} requires letta-code connection. Current status: ${lettaCodeStatus}`,
      }]);
      return;
    }

    // Execute via appropriate path
    if (connectionMode === 'local' && lettaCodeStatus === 'connected' && activeConversationId) {
      // Send via letta-code WebSocket
      setMessages(prev => [...prev, {
        uuid: `system-${Date.now()}`,
        createdAt: Date.now(),
        type: 'system' as const,
        content: `Running /${cmd}...`,
      }]);

      const success = executeCommand({
        commandId: cmd,
        agentId,
        conversationId: activeConversationId,
        args: args || undefined,
      });

      if (!success) {
        setMessages(prev => [...prev, {
          uuid: `error-${Date.now()}`,
          createdAt: Date.now(),
          type: 'system' as const,
          content: `/${cmd} failed: Could not send to letta-code`,
        }]);
      }
    } else if (connectionMode === 'local') {
      // Server mode fallback for commands that support it
      if (cmd === 'recompile' || cmd === 'clear') {
        await runServerCommand(cmd);
      } else {
        setMessages(prev => [...prev, {
          uuid: `error-${Date.now()}`,
          createdAt: Date.now(),
          type: 'system' as const,
          content: `/${cmd} requires local mode.`,
        }]);
      }
    }
  }, [connectionMode, lettaCodeStatus, activeConversationId, agentId, executeCommand]);

  const runServerCommand = useCallback(async (cmd: string) => {
    if (!activeConversationId) return;

    setMessages(prev => [...prev, {
      uuid: `system-${Date.now()}`,
      createdAt: Date.now(),
      type: 'system' as const,
      content: `Running /${cmd}...`,
    }]);

    try {
      // Use the chatApi service - need to add command endpoint
      const res = await fetch(`/api/commands/${cmd}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, conversationId: activeConversationId }),
      });
      const json = await res.json();

      if (json.success) {
        setMessages(prev => [...prev, {
          uuid: `system-${Date.now()}`,
          createdAt: Date.now(),
          type: 'system' as const,
          content: `/${cmd} completed: ${json.message || 'OK'}`,
        }]);

        if (cmd === 'clear') {
          // Reload messages after clear
          setMessages([]);
        }
      } else {
        setMessages(prev => [...prev, {
          uuid: `error-${Date.now()}`,
          createdAt: Date.now(),
          type: 'system' as const,
          content: `/${cmd} failed: ${json.error || 'Unknown error'}`,
        }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        uuid: `error-${Date.now()}`,
        createdAt: Date.now(),
        type: 'system' as const,
        content: `/${cmd} error: ${err.message}`,
      }]);
    }
  }, [agentId, activeConversationId, setMessages]);

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
          {/* Connection Mode Indicator */}
          <ConnectionModeIndicator
            mode={connectionMode}
            onModeChange={setConnectionMode}
            lettaCodeStatus={lettaCodeStatus}
            lettaCodeUrl={lettaCodeUrl}
            onLettaCodeUrlChange={setLettaCodeUrl}
            onConnect={connectLettaCode}
            onDisconnect={disconnectLettaCode}
            supportedCommands={deviceStatus?.supported_commands}
          />

          {/* Conversation Selector */}
          {agent.conversations && agent.conversations.length > 0 && (
            <select
              value={activeConversationId || ""}
              onChange={(e) => setActiveConversationId(e.target.value || null)}
              className="px-3 py-1.5 text-sm bg-surface-cream border border-ink-900/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {agent.conversations.map((conv) => (
                <option key={conv.id} value={conv.id}>
                  {`Conversation ${conv.id.slice(0, 8)}`}
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
              <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-ink-900/10 rounded-lg shadow-lg z-50 py-1">
                {SLASH_COMMANDS.map((cmd) => {
                  const isLocalOnly = cmd.requires === 'local';
                  const isDisabled = isLocalOnly && connectionMode !== 'local';
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => !isDisabled && handleSlashCommand(cmd.id, '')}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${
                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ink-900/5'
                      }`}
                      disabled={isDisabled}
                      title={isDisabled ? 'Requires local mode' : cmd.desc}
                    >
                      <span className="font-medium text-ink-900">/{cmd.id}</span>
                      <span className="text-xs text-ink-500">{cmd.desc}</span>
                      {isLocalOnly && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-ink-900/10 rounded text-ink-500">
                          local
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 3-Pane Layout */}
      <PanelGroup orientation="horizontal" className="flex-1">
        {/* Left: Memory Panel */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <AgentMemoryPanel agentId={agentId} apiUrl={getApiBase()} />
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

                {messagesError && (
                  <div className="flex items-center justify-center py-4 mb-4">
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4m0 4h.01" />
                      </svg>
                      <span>{messagesError}</span>
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

            {/* Input with slash command autocomplete */}
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface to-transparent pb-6 px-2 lg:pb-8 pt-8 lg:ml-[280px]">
              <div className="mx-auto w-full max-w-full lg:max-w-3xl">
                {/* Slash command autocomplete */}
                {showSlashCommands && inputValue.startsWith('/') && (
                  <div className="mb-2 bg-surface border border-ink-900/10 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                    {SLASH_COMMANDS
                      .filter(c => c.id.startsWith(inputValue.slice(1).toLowerCase()))
                      .map(cmd => {
                        const isLocalOnly = cmd.requires === 'local';
                        const isDisabled = isLocalOnly && connectionMode !== 'local';
                        return (
                          <div
                            key={cmd.id}
                            className={`px-4 py-2 flex items-center justify-between ${
                              isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ink-900/5 cursor-pointer'
                            }`}
                            onClick={() => {
                              if (!isDisabled) {
                                setInputValue(`/${cmd.id} `);
                                setShowSlashCommands(false);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-ink-900">/{cmd.id}</span>
                              <span className="text-xs text-ink-500">{cmd.desc}</span>
                            </div>
                            {isLocalOnly && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded">
                                local
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}

                <div className="flex w-full items-end gap-3 rounded-2xl border border-ink-900/10 bg-surface px-4 py-3 shadow-card">
                  <textarea
                    rows={1}
                    className="flex-1 resize-none bg-transparent py-1.5 text-sm text-ink-800 placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder={!activeConversationId ? "Select a conversation..." : "Type a message... (try /doctor, /clear)"}
                    value={inputValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      setInputValue(value);
                      setShowSlashCommands(value.startsWith('/'));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleInputSend();
                      }
                      if (e.key === 'Escape') {
                        setShowSlashCommands(false);
                      }
                    }}
                    disabled={!activeConversationId}
                    style={{ minHeight: '24px', maxHeight: '200px' }}
                  />
                  <button
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleInputSend}
                    disabled={!activeConversationId || !inputValue.trim()}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path d="M3.4 20.6 21 12 3.4 3.4l2.8 7.2L16 12l-9.8 1.4-2.8 7.2Z" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

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
