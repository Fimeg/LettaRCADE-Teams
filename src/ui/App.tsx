import { useCallback, useEffect, useRef, useState } from "react";
import type { CanUseToolResponse } from "./types";
import { useIPC } from "./hooks/useIPC";
import { useMessageWindow } from "./hooks/useMessageWindow";
import { useAppStore, type TopTab } from "./store/useAppStore";
import type { ServerEvent } from "./types";
import { AgentsBrowser } from "./components/AgentsBrowser";
import { AgentWorkspace } from "./components/AgentWorkspace";
import { StartSessionModal } from "./components/StartSessionModal";
import { PromptInput, usePromptActions } from "./components/PromptInput";
import { MessageCard } from "./components/EventCard";
import MDContent from "./render/markdown";
import { apiClient } from "./services/api";

const SCROLL_THRESHOLD = 50;

/** Legacy chat view for direct session access (non-agent workspace) */
function LegacyChatView({
  activeSession,
  isRunning,
  permissionRequests,
  visibleMessages,
  hasMoreHistory,
  isLoadingHistory,
  totalMessages,
  partialMessage,
  showPartialMessage,
  hasNewMessages,
  scrollContainerRef,
  topSentinelRef,
  messagesEndRef,
  onScroll,
  onScrollToBottom,
  onPermissionResult,
  sendEvent,
  onSendMessage,
}: {
  activeSession: ReturnType<typeof useAppStore.getState>["sessions"][string] | undefined;
  isRunning: boolean;
  permissionRequests: ReturnType<typeof useAppStore.getState>["sessions"][string]["permissionRequests"];
  visibleMessages: ReturnType<typeof useMessageWindow>["visibleMessages"];
  hasMoreHistory: boolean;
  isLoadingHistory: boolean;
  totalMessages: number;
  partialMessage: string;
  showPartialMessage: boolean;
  hasNewMessages: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  topSentinelRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  onScrollToBottom: () => void;
  onPermissionResult: (toolUseId: string, result: CanUseToolResponse) => void;
  sendEvent: (event: ServerEvent) => void;
  onSendMessage: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col h-full bg-surface-cream">
      <div
        className="flex items-center justify-center h-12 border-b border-ink-900/10 bg-surface-cream select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-sm font-medium text-ink-700">{activeSession?.title || "Letta Community ADE"}</span>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-8 pb-40 pt-6"
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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Loading...</span>
              </div>
            </div>
          )}

          {visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-lg font-medium text-ink-700">No messages yet</div>
              <p className="mt-2 text-sm text-muted">Start a conversation with Letta Cowork</p>
            </div>
          ) : (
            visibleMessages.map((item, idx) => (
              <MessageCard
                key={`${activeSession?.id}-msg-${item.originalIndex}`}
                message={item.message}
                isLast={idx === visibleMessages.length - 1}
                isRunning={isRunning}
                permissionRequest={permissionRequests[0]}
                onPermissionResult={onPermissionResult}
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

      <PromptInput sendEvent={sendEvent} onSendMessage={onSendMessage} disabled={visibleMessages.length === 0} />

      {hasNewMessages && (
        <button
          onClick={onScrollToBottom}
          className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-accent-hover hover:scale-105 animate-bounce-subtle"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          <span>New messages</span>
        </button>
      )}
    </main>
  );
}

function App() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const partialMessageRef = useRef("");
  const [partialMessage, setPartialMessage] = useState("");
  const [showPartialMessage, setShowPartialMessage] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevMessagesLengthRef = useRef(0);
  const scrollHeightBeforeLoadRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);

  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const showStartModal = useAppStore((s) => s.showStartModal);
  const setShowStartModal = useAppStore((s) => s.setShowStartModal);
  const globalError = useAppStore((s) => s.globalError);
  const setGlobalError = useAppStore((s) => s.setGlobalError);
  const historyRequested = useAppStore((s) => s.historyRequested);
  const markHistoryRequested = useAppStore((s) => s.markHistoryRequested);
  const resolvePermissionRequest = useAppStore((s) => s.resolvePermissionRequest);
  const handleServerEvent = useAppStore((s) => s.handleServerEvent);
  const prompt = useAppStore((s) => s.prompt);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const cwd = useAppStore((s) => s.cwd);
  const setCwd = useAppStore((s) => s.setCwd);
  const pendingStart = useAppStore((s) => s.pendingStart);

  // New agent-focused state
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const setSelectedAgentId = useAppStore((s) => s.setSelectedAgentId);
  const agentList = useAppStore((s) => s.agentList);
  const agentsLoading = useAppStore((s) => s.agentsLoading);
  const loadAgentList = useAppStore((s) => s.loadAgentList);
  const loadAgent = useAppStore((s) => s.loadAgent);
  const serverConnected = useAppStore((s) => s.serverConnected);
  const setServerConnected = useAppStore((s) => s.setServerConnected);

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

  // Event handler
  const onEvent = useCallback((event: ServerEvent) => {
    handleServerEvent(event);
    handlePartialMessages(event);
  }, [handleServerEvent, handlePartialMessages]);

  const { connected, sendEvent } = useIPC(onEvent);
  const { handleStartFromModal } = usePromptActions(sendEvent);

  const activeSession = activeSessionId ? sessions[activeSessionId] : undefined;
  const messages = activeSession?.messages ?? [];
  const permissionRequests = activeSession?.permissionRequests ?? [];
  const isRunning = activeSession?.status === "running";

  const {
    visibleMessages,
    hasMoreHistory,
    isLoadingHistory,
    loadMoreMessages,
    resetToLatest,
    totalMessages,
  } = useMessageWindow(messages, permissionRequests, activeSessionId);

  // Check server connection and load agents on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await apiClient.getHealth();
        setServerConnected(true);
        loadAgentList();
      } catch {
        setServerConnected(false);
      }
    };
    checkConnection();
  }, [setServerConnected, loadAgentList]);

  // Load selected agent details when agent is selected
  useEffect(() => {
    if (selectedAgentId) {
      loadAgent(selectedAgentId);
    }
  }, [selectedAgentId, loadAgent]);

  // Legacy session handling
  useEffect(() => {
    if (connected) sendEvent({ type: "session.list" });
  }, [connected, sendEvent]);

  useEffect(() => {
    if (!activeSessionId || !connected) return;
    const session = sessions[activeSessionId];
    if (session && !session.hydrated && !historyRequested.has(activeSessionId)) {
      markHistoryRequested(activeSessionId);
      sendEvent({ type: "session.history", payload: { sessionId: activeSessionId } });
    }
  }, [activeSessionId, connected, sessions, historyRequested, markHistoryRequested, sendEvent]);

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

  // Set up IntersectionObserver for top sentinel
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

    return () => {
      observer.disconnect();
    };
  }, [hasMoreHistory, isLoadingHistory, loadMoreMessages]);

  // Restore scroll position after loading history
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

  // Reset scroll state on session change
  useEffect(() => {
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    prevMessagesLengthRef.current = 0;
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, 100);
  }, [activeSessionId]);

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

  const handleNewSession = useCallback(() => {
    useAppStore.getState().setActiveSessionId(null);
    setShowStartModal(true);
  }, [setShowStartModal]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    sendEvent({ type: "session.delete", payload: { sessionId } });
  }, [sendEvent]);

  const handlePermissionResult = useCallback((toolUseId: string, result: CanUseToolResponse) => {
    if (!activeSessionId) return;
    sendEvent({ type: "permission.response", payload: { sessionId: activeSessionId, toolUseId, result } });
    resolvePermissionRequest(activeSessionId, toolUseId);
  }, [activeSessionId, sendEvent, resolvePermissionRequest]);

  const handleSendMessage = useCallback(() => {
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    resetToLatest();
  }, [resetToLatest]);

  const onSelectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setActiveTab('agents');
  }, [setSelectedAgentId, setActiveTab]);

  const onBackToBrowser = useCallback(() => {
    setSelectedAgentId(null);
  }, [setSelectedAgentId]);

  // Tab button component
  const TabButton = ({ tab, label, icon }: { tab: TopTab; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
        activeTab === tab
          ? 'text-accent border-b-2 border-accent'
          : 'text-ink-600 hover:text-ink-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  // Determine main content based on state
  const renderMainContent = () => {
    // If an agent is selected, show the workspace
    if (selectedAgentId) {
      return (
        <AgentWorkspace
          agentId={selectedAgentId}
          onBack={onBackToBrowser}
          sendEvent={sendEvent}
        />
      );
    }

    // Otherwise show browser or other tabs
    switch (activeTab) {
      case 'agents':
        return (
          <AgentsBrowser
            agents={agentList}
            loading={agentsLoading}
            onSelectAgent={onSelectAgent}
            onCreateAgent={() => { /* TODO: create agent modal */ }}
          />
        );
      case 'models':
        return (
          <div className="flex flex-col items-center justify-center h-full text-ink-600">
            <div className="text-lg font-medium">Models</div>
            <p className="text-sm mt-2">Model management coming soon</p>
          </div>
        );
      case 'settings':
        return (
          <div className="flex flex-col items-center justify-center h-full text-ink-600">
            <div className="text-lg font-medium">Settings</div>
            <p className="text-sm mt-2">Global settings coming soon</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-surface">
      {/* Header with tabs and connection status */}
      <header className="flex items-center justify-between h-14 border-b border-ink-900/10 bg-surface select-none px-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${serverConnected === true ? 'bg-green-500' : serverConnected === false ? 'bg-red-500' : 'bg-amber-500'}`} />
            <span className="text-sm font-semibold text-ink-900">Letta ADE</span>
          </div>
          <nav className="flex items-center">
            <TabButton
              tab="agents"
              label="Agents"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            />
            <TabButton
              tab="models"
              label="Models"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
            />
            <TabButton
              tab="settings"
              label="Settings"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {selectedAgentId && (
            <button
              onClick={onBackToBrowser}
              className="flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to Agents
            </button>
          )}
          <span className={`text-xs ${serverConnected ? 'text-green-600' : 'text-red-600'}`}>
            {serverConnected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {renderMainContent()}
      </div>

      {/* Legacy session modal */}
      {showStartModal && (
        <StartSessionModal
          cwd={cwd}
          prompt={prompt}
          pendingStart={pendingStart}
          onCwdChange={setCwd}
          onPromptChange={setPrompt}
          onStart={handleStartFromModal}
          onClose={() => setShowStartModal(false)}
        />
      )}

      {/* Global error */}
      {globalError && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-error/20 bg-error-light px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-error">{globalError}</span>
            <button className="text-error hover:text-error/80" onClick={() => setGlobalError(null)}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
