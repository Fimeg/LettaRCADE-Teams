import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, Group as PanelGroup, Separator as Separator } from "react-resizable-panels";
import { useAppStore } from "../store/useAppStore";
import { useMessageWindow } from "../hooks/useMessageWindow";
import { useIPC } from "../hooks/useIPC";
import { useStreamingMessages } from "../hooks/useStreamingMessages";
import { useMessageHistory } from "../hooks/useMessageHistory";
import { agentsApi } from "../services/api";
import { slashCommandHandlers } from "../services/slashCommands";
import type { ClientEvent, ServerEvent } from "../types";
import { MessageCard } from "./EventCard";
import MDContent from "../render/markdown";
import { AgentMemoryPanel } from "./AgentMemoryPanel";
import ConnectionModeIndicator, { ConnectionMode } from "./ConnectionModeIndicator";
import { ConfirmDialog } from "./ConfirmDialog";
import { useAgentNickname } from "../hooks/useAgentNickname";

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
}

const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'doctor', desc: 'Audit and refine memory structure' },
  { id: 'clear', desc: 'Clear in-context messages' },
  { id: 'remember', desc: 'Remember something from conversation' },
  { id: 'recompile', desc: 'Recompile agent memory' },
];

// ═══ Settings Tabs ═══
type SettingsTab = 'config' | 'system' | 'tools';

// ═══ Tool Info ═══
interface ToolInfo {
  id: string;
  name: string;
  description: string | null;
  sourceType?: string | null;
  tags?: string[];
}

export function AgentWorkspace({ agentId, onBack, sendEvent: _sendEvent }: AgentWorkspaceProps) {
  // Store integration
  const agent = useAppStore((s) => s.agents[agentId]);
  const loadAgent = useAppStore((s) => s.loadAgent);
  const updateAgent = useAppStore((s) => s.updateAgent);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const setActiveConversationId = useAppStore((s) => s.setActiveConversationId);
  const createConversation = useAppStore((s) => s.createConversation);
  const deleteAgent = useAppStore((s) => s.deleteAgent);
  const deleteConversation = useAppStore((s) => s.deleteConversation);
  const handleServerEvent = useAppStore((s) => s.handleServerEvent);

  // Settings panel state
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('config');
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editingSystem, setEditingSystem] = useState(false);
  const [systemDraft, setSystemDraft] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [convDeleteId, setConvDeleteId] = useState<string | null>(null);
  const [convDeleting, setConvDeleting] = useState(false);

  // Per-agent UI nickname (localStorage-backed; does not modify the server agent)
  const { nickname, setNickname } = useAgentNickname(agentId);

  // Config form fields
  const [cfgName, setCfgName] = useState('');
  const [cfgDesc, setCfgDesc] = useState('');
  const [cfgModel, setCfgModel] = useState('');
  const [cfgEmbedding, setCfgEmbedding] = useState('');
  const [cfgContextWindow, setCfgContextWindow] = useState('');
  const [cfgMaxTokens, setCfgMaxTokens] = useState('');
  const [cfgEnableReasoner, setCfgEnableReasoner] = useState(false);
  const [cfgMaxReasoningTokens, setCfgMaxReasoningTokens] = useState('');
  const [cfgEffort, setCfgEffort] = useState('');
  const [cfgFreqPenalty, setCfgFreqPenalty] = useState('');
  const [cfgParallelToolCalls, setCfgParallelToolCalls] = useState(false);
  const [cfgSleeptime, setCfgSleeptime] = useState(false);
  const [cfgAutoclear, setCfgAutoclear] = useState(false);
  const [cfgTags, setCfgTags] = useState('');
  const [cfgModelEndpoint, setCfgModelEndpoint] = useState('');

  // Tools state
  const [agentTools, setAgentTools] = useState<ToolInfo[]>([]);
  const [allTools, setAllTools] = useState<ToolInfo[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [showToolBrowser, setShowToolBrowser] = useState(false);
  const [toolFilter, setToolFilter] = useState('');
  const [toolActionPending, setToolActionPending] = useState<string | null>(null);

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

  // Connection mode
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('server');

  // Input state
  const [inputValue, setInputValue] = useState('');
  const [showSlashCommands, setShowSlashCommands] = useState(false);

  // Hooks for messages and streaming
  const {
    messages,
    isLoading: isLoadingMessages,
    error: messagesError,
    loadMessages,
  } = useMessageHistory(activeConversationId);

  const {
    sendMessage: streamMessage,
    isStreaming,
  } = useStreamingMessages(agentId, activeConversationId);

  // Load agent if not loaded
  useEffect(() => {
    if (!agent?.loaded) {
      loadAgent(agentId);
    }
  }, [agentId, agent?.loaded, loadAgent]);

  // Populate form when agent loads
  useEffect(() => {
    if (agent?.raw) {
      populateConfigForm(agent.raw);
      setSystemDraft(String(agent.raw.system ?? ''));
    }
  }, [agent?.raw]);

  // Load agent tools
  useEffect(() => {
    if (agentId && settingsTab === 'tools') {
      loadAgentTools();
    }
  }, [agentId, settingsTab]);

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

  useIPC(onEvent);

  // Permission requests (managed via IPC/events)
  const permissionRequests: any[] = [];
  const isRunning = isStreaming;

  const {
    visibleMessages,
    hasMoreHistory,
    isLoadingHistory: isLoadingMoreHistory,
    loadMoreMessages,
    resetToLatest,
    totalMessages,
  } = useMessageWindow(messages, permissionRequests, activeConversationId);

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

  const scrollToBottom = useCallback(() => {
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    resetToLatest();
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [resetToLatest]);

  // ═══ CONFIG FORM ═══

  const populateConfigForm = useCallback((r: Record<string, unknown>) => {
    const llm = (r.llm_config as Record<string, unknown>) || {};
    setCfgName((r.name as string) || '');
    setCfgDesc((r.description as string) || '');
    setCfgModel((r.model as string) || (llm.handle as string) || (llm.model as string) || '');
    setCfgEmbedding((r.embedding as string) || '');
    setCfgContextWindow(
      (r.context_window_limit as number)?.toString() || (llm.context_window as number)?.toString() || ''
    );
    setCfgMaxTokens((llm.max_tokens as number)?.toString() || '');
    setCfgEnableReasoner((llm.enable_reasoner as boolean) || false);
    setCfgMaxReasoningTokens((llm.max_reasoning_tokens as number)?.toString() || '');
    setCfgEffort((llm.effort as string) || '');
    setCfgFreqPenalty((llm.frequency_penalty as number)?.toString() || '');
    setCfgParallelToolCalls((llm.parallel_tool_calls as boolean) || false);
    setCfgSleeptime((r.enable_sleeptime as boolean) || false);
    setCfgAutoclear((r.message_buffer_autoclear as boolean) || false);
    setCfgTags(((r.tags as string[]) || []).join(', '));
    setCfgModelEndpoint((llm.model_endpoint as string) || '');
  }, []);

  const saveConfig = async () => {
    if (!agent?.raw) return;
    setSavingConfig(true);
    setSaveMessage(null);
    try {
      const r = agent.raw;
      const llm = (r.llm_config as Record<string, unknown>) || {};

      const updates: Record<string, unknown> = {};

      if (cfgName !== ((r.name as string) || '')) updates.name = cfgName;
      if (cfgDesc !== ((r.description as string) || '')) updates.description = cfgDesc || null;
      if (cfgModel !== ((r.model as string) || (llm.handle as string) || (llm.model as string) || '')) {
        updates.model = cfgModel || null;
      }
      if (cfgEmbedding !== ((r.embedding as string) || '')) updates.embedding = cfgEmbedding || null;
      if (cfgSleeptime !== ((r.enable_sleeptime as boolean) || false)) updates.enable_sleeptime = cfgSleeptime;
      if (cfgAutoclear !== ((r.message_buffer_autoclear as boolean) || false)) {
        updates.message_buffer_autoclear = cfgAutoclear;
      }

      const newTags = cfgTags.split(',').map(t => t.trim()).filter(Boolean);
      const oldTags = ((r.tags as string[]) || []).join(', ');
      if (cfgTags !== oldTags) updates.tags = newTags;

      const cwl = cfgContextWindow ? parseInt(cfgContextWindow) : null;
      if (cwl !== ((r.context_window_limit as number) || null)) updates.context_window_limit = cwl;

      const llmUpdates: Record<string, unknown> = {};
      const mt = cfgMaxTokens ? parseInt(cfgMaxTokens) : null;
      if (mt !== ((llm.max_tokens as number) || null)) llmUpdates.max_tokens = mt;
      if (cfgEnableReasoner !== ((llm.enable_reasoner as boolean) || false)) llmUpdates.enable_reasoner = cfgEnableReasoner;
      const mrt = cfgMaxReasoningTokens ? parseInt(cfgMaxReasoningTokens) : undefined;
      if (mrt !== ((llm.max_reasoning_tokens as number) || undefined)) llmUpdates.max_reasoning_tokens = mrt;
      if (cfgEffort !== ((llm.effort as string) || '')) llmUpdates.effort = cfgEffort || null;
      const fp = cfgFreqPenalty ? parseFloat(cfgFreqPenalty) : null;
      if (fp !== ((llm.frequency_penalty as number) || null)) llmUpdates.frequency_penalty = fp;
      if (cfgParallelToolCalls !== ((llm.parallel_tool_calls as boolean) || false)) {
        llmUpdates.parallel_tool_calls = cfgParallelToolCalls;
      }
      if (cfgModelEndpoint !== ((llm.model_endpoint as string) || '')) llmUpdates.model_endpoint = cfgModelEndpoint || null;

      if (Object.keys(llmUpdates).length > 0) {
        updates.llm_config = { ...llm, ...llmUpdates };
      }

      if (Object.keys(updates).length === 0) {
        setSaveMessage('No changes');
        setSavingConfig(false);
        setTimeout(() => setSaveMessage(null), 2000);
        return;
      }

      await updateAgent(agentId, updates);
      setSaveMessage('Saved');
      loadAgent(agentId);
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setSaveMessage(`Error: ${err instanceof Error ? err.message : 'Failed to save'}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const saveSystem = async () => {
    if (!agent?.raw) return;
    setSavingConfig(true);
    try {
      await updateAgent(agentId, { system: systemDraft });
      setEditingSystem(false);
      loadAgent(agentId);
      setSaveMessage('System prompt saved');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setSaveMessage(`Error: ${err instanceof Error ? err.message : 'Failed to save'}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDeleteAgent = async () => {
    setDeleting(true);
    try {
      await deleteAgent(agentId);
      setShowDeleteConfirm(false);
      onBack();
    } catch (err) {
      setSaveMessage(`Delete failed: ${err instanceof Error ? err.message : 'Failed to delete'}`);
      setDeleting(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!convDeleteId) return;
    setConvDeleting(true);
    try {
      await deleteConversation(convDeleteId);
      setConvDeleteId(null);
    } finally {
      setConvDeleting(false);
    }
  };

  // ═══ TOOLS ═══

  const loadAgentTools = async () => {
    setLoadingTools(true);
    try {
      const [attached, all] = await Promise.all([
        agentsApi.getTools(agentId),
        agentsApi.listAllTools(),
      ]);
      setAgentTools(attached.map(t => ({
        id: t.id,
        name: t.name || 'unnamed',
        description: t.description || null,
        sourceType: (t as unknown as { source_type?: string }).source_type || null,
        tags: t.tags || [],
      })));
      setAllTools(all.map(t => ({
        id: t.id,
        name: t.name || 'unnamed',
        description: t.description || null,
        sourceType: (t as unknown as { source_type?: string }).source_type || null,
        tags: t.tags || [],
      })));
    } catch (err) {
      console.error('Failed to load tools:', err);
    } finally {
      setLoadingTools(false);
    }
  };

  const attachTool = async (toolId: string) => {
    setToolActionPending(toolId);
    try {
      await agentsApi.attachTool(agentId, toolId);
      await loadAgentTools();
    } catch (err) {
      console.error('Failed to attach tool:', err);
    } finally {
      setToolActionPending(null);
    }
  };

  const detachTool = async (toolId: string) => {
    setToolActionPending(toolId);
    try {
      await agentsApi.detachTool(agentId, toolId);
      setAgentTools(prev => prev.filter(t => t.id !== toolId));
    } catch (err) {
      console.error('Failed to detach tool:', err);
    } finally {
      setToolActionPending(null);
    }
  };

  // ═══ CONVERSATIONS ═══

  const handleCreateConversation = async () => {
    try {
      const conv = await createConversation(agentId);
      if (conv) {
        setActiveConversationId(conv.id);
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  // ═══ SLASH COMMAND HANDLERS ═══

  const handleSlashCommand = useCallback(async (cmd: string, args: string = '') => {
    const cmdDef = SLASH_COMMANDS.find(c => c.id === cmd);
    if (!cmdDef) {
      console.warn(`[AgentWorkspace] Unknown command: /${cmd}. Available: ${SLASH_COMMANDS.map(c => `/${c.id}`).join(', ')}`);
      return;
    }

    if (!activeConversationId && cmd !== 'doctor' && cmd !== 'recompile') {
      console.warn(`[AgentWorkspace] No active conversation. Cannot run /${cmd}.`);
      return;
    }

    console.log(`[AgentWorkspace] Running /${cmd}...`);

    try {
      const handler = slashCommandHandlers[cmd];
      if (!handler) throw new Error(`Unknown command: ${cmd}`);

      const result = await handler(agentId, activeConversationId, args);

      console.log(`[AgentWorkspace] /${cmd} ${result.success ? 'completed' : 'failed'}: ${result.message}`);

      if (result.success) {
        if (result.action === 'clear_messages') {
          await loadMessages(activeConversationId || '');
          loadAgent(agentId);
        } else if (result.action === 'reload_agent') {
          loadAgent(agentId);
        }
      }
    } catch (err) {
      console.error(`[AgentWorkspace] /${cmd} error:`, err);
    }
  }, [agentId, activeConversationId, loadAgent, loadMessages]);

  // ═══ MESSAGE SENDING WITH STREAMING ═══

  const handleInputSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;

    // Auto-create conversation if none exists
    let conversationId = activeConversationId;
    if (!conversationId) {
      try {
        const newConv = await createConversation(agentId);
        if (newConv) {
          conversationId = newConv.id;
          setActiveConversationId(newConv.id);
        } else {
          console.error('[AgentWorkspace] Failed to create conversation');
          return;
        }
      } catch (err) {
        console.error('[AgentWorkspace] Error creating conversation:', err);
        return;
      }
    }

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

    // Start streaming
    setShowPartialMessage(true);
    partialMessageRef.current = '';
    setPartialMessage('');

    try {
      const stream = streamMessage(userMsg);
      let assistantContent = '';

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'assistant':
            assistantContent += chunk.content;
            partialMessageRef.current = assistantContent;
            setPartialMessage(assistantContent);
            if (shouldAutoScroll) {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
            break;
          case 'reasoning':
            // Reasoning messages handled by hook - refresh messages to include them
            await loadMessages(conversationId);
            break;
          case 'tool_call':
            // Tool call messages handled by hook - refresh messages
            await loadMessages(conversationId);
            break;
          case 'tool_return':
            // Tool return messages handled by hook - refresh messages
            await loadMessages(conversationId);
            break;
          case 'error':
            // Error displayed in UI via toast or partial message
            partialMessageRef.current += `\n\nError: ${chunk.message}`;
            setPartialMessage(partialMessageRef.current);
            break;
        }
      }

      // Refresh messages to get the final assistant message from the server
      await loadMessages(conversationId);
    } catch (err) {
      console.error('[AgentWorkspace] Stream error:', err);
      partialMessageRef.current += `\n\nStream error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setPartialMessage(partialMessageRef.current);
    } finally {
      setShowPartialMessage(false);
      partialMessageRef.current = '';
      setPartialMessage('');
    }
  }, [inputValue, activeConversationId, isStreaming, handleSlashCommand, resetToLatest, shouldAutoScroll, agentId, createConversation, setActiveConversationId]);

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

  const llm = (agent.raw?.llm_config as Record<string, unknown>) || {};
  const attachedToolIds = new Set(agentTools.map(t => t.id));
  const availableTools = allTools.filter(t =>
    !attachedToolIds.has(t.id) &&
    (!toolFilter || t.name.toLowerCase().includes(toolFilter.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-ink-900/10 bg-surface shrink-0">
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

          <span className="px-2 py-0.5 text-xs font-medium bg-accent/10 text-accent rounded">
            {getModelDisplay(agent.model)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ConnectionModeIndicator
            mode={connectionMode}
            onModeChange={setConnectionMode}
          />

          {/* Conversation Selector */}
          {agent.conversations && agent.conversations.length > 0 && (
            <div className="flex items-center gap-1">
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
              {activeConversationId && (
                <button
                  onClick={() => setConvDeleteId(activeConversationId)}
                  title="Delete this conversation"
                  aria-label="Delete this conversation"
                  className="p-1.5 rounded-lg text-ink-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleCreateConversation}
            className="px-3 py-1.5 text-sm font-medium text-accent hover:text-accent-hover hover:bg-accent/10 rounded-lg transition-colors"
          >
            + New
          </button>

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
                {SLASH_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.id}
                    onClick={() => { handleSlashCommand(cmd.id, ''); setShowCommands(false); }}
                    className="w-full px-4 py-2 text-left text-sm flex items-center justify-between hover:bg-ink-900/5"
                    title={cmd.desc}
                  >
                    <span className="font-medium text-ink-900">/{cmd.id}</span>
                    <span className="text-xs text-ink-500">{cmd.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 3-Pane Layout */}
      <PanelGroup orientation="horizontal" className="flex-1 min-h-0">
        {/* Left: Settings Panel */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <div className="h-full flex flex-col bg-surface border-r border-ink-900/10">
            {/* Settings Tabs */}
            <div className="flex border-b border-ink-900/10">
              {(['config', 'system', 'tools'] as SettingsTab[]).map(t => (
                <button
                  key={t}
                  className={`flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors ${
                    settingsTab === t
                      ? 'bg-accent text-white'
                      : 'text-ink-600 hover:bg-ink-900/5'
                  }`}
                  onClick={() => setSettingsTab(t)}
                >
                  {t === 'config' ? 'Settings' : t === 'system' ? 'System' : `Tools (${agentTools.length})`}
                </button>
              ))}
            </div>

            {/* Settings Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {settingsTab === 'config' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-ink-700 uppercase tracking-wide">Identity</h4>
                    <ConfigField label="Name" value={cfgName} onChange={setCfgName} />
                    <ConfigField label="Description" value={cfgDesc} onChange={setCfgDesc} />
                    <ConfigField label="Tags" value={cfgTags} onChange={setCfgTags} hint="Comma-separated" />
                    <ConfigField
                      label="Chat nickname"
                      value={nickname}
                      onChange={setNickname}
                      hint="UI-only alias for this agent in chat; saved instantly (local to this browser)"
                    />
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-ink-700 uppercase tracking-wide">Inference</h4>
                    <ConfigField label="Model" value={cfgModel} onChange={setCfgModel} mono hint="provider/model-name" />
                    <ConfigField label="Endpoint" value={cfgModelEndpoint} onChange={setCfgModelEndpoint} mono hint="Custom API URL" />
                    <ConfigField label="Embedding" value={cfgEmbedding} onChange={setCfgEmbedding} mono />
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-ink-700 uppercase tracking-wide">Generation</h4>
                    <ConfigField label="Context Window" value={cfgContextWindow} onChange={setCfgContextWindow} type="number" />
                    <ConfigField label="Max Tokens" value={cfgMaxTokens} onChange={setCfgMaxTokens} type="number" />
                    <ConfigField label="Freq. Penalty" value={cfgFreqPenalty} onChange={setCfgFreqPenalty} type="number" hint="-2.0 to 2.0" />
                    <ConfigToggle label="Parallel Tools" value={cfgParallelToolCalls} onChange={setCfgParallelToolCalls} />
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-ink-700 uppercase tracking-wide">Reasoning</h4>
                    <ConfigToggle label="Reasoner" value={cfgEnableReasoner} onChange={setCfgEnableReasoner} />
                    <ConfigField label="Max Reasoning Tokens" value={cfgMaxReasoningTokens} onChange={setCfgMaxReasoningTokens} type="number" />
                    <ConfigSelect label="Effort" value={cfgEffort} onChange={setCfgEffort} options={['', 'low', 'medium', 'high', 'max']} />
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-ink-700 uppercase tracking-wide">Behavior</h4>
                    <ConfigToggle label="Sleeptime" value={cfgSleeptime} onChange={setCfgSleeptime} />
                    <ConfigToggle label="Autoclear Buffer" value={cfgAutoclear} onChange={setCfgAutoclear} />
                  </div>

                  <div className="space-y-3 pt-4 border-t border-ink-900/10">
                    <h4 className="text-xs font-semibold text-ink-700 uppercase tracking-wide">Info</h4>
                    <ReadonlyRow label="Agent ID" value={agentId} />
                    <ReadonlyRow label="Created" value={agent.raw?.created_at ? new Date(agent.raw.created_at as string).toLocaleString() : '—'} />
                    <ReadonlyRow label="Last Run" value={agent.raw?.last_run_completion ? new Date(agent.raw.last_run_completion as string).toLocaleString() : 'Never'} />
                    <ReadonlyRow label="Ctx Window (model)" value={(llm.context_window as number)?.toLocaleString() || '—'} />
                    <ReadonlyRow label="Endpoint Type" value={(llm.model_endpoint_type as string) || '—'} />
                  </div>

                  <div className="flex gap-2 pt-4 sticky bottom-0 bg-surface pb-2">
                    <button
                      onClick={saveConfig}
                      disabled={savingConfig}
                      className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      {savingConfig ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => populateConfigForm(agent.raw || {})}
                      className="px-3 py-2 text-xs font-medium rounded-lg bg-surface-tertiary text-ink-600 hover:bg-ink-900/10 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                  {saveMessage && (
                    <span className={`text-xs ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                      {saveMessage}
                    </span>
                  )}
                </div>
              )}

              {settingsTab === 'system' && (
                <div className="space-y-3">
                  {editingSystem ? (
                    <>
                      <textarea
                        value={systemDraft}
                        onChange={e => setSystemDraft(e.target.value)}
                        rows={20}
                        className="w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-xs font-mono text-ink-800 focus:border-accent focus:outline-none resize-vertical"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveSystem}
                          disabled={savingConfig}
                          className="px-3 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
                        >
                          {savingConfig ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setEditingSystem(false); setSystemDraft((agent.raw?.system as string) || ''); }}
                          className="px-3 py-2 text-xs font-medium rounded-lg bg-surface-tertiary text-ink-600 hover:bg-ink-900/10 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div
                      className="rounded-lg border border-ink-900/10 bg-surface-secondary p-3 cursor-pointer hover:border-accent/50 transition-colors"
                      onClick={() => setEditingSystem(true)}
                    >
                      <pre className="text-xs text-ink-700 font-mono whitespace-pre-wrap break-words">
                        {(agent.raw?.system as string) || '(no system prompt)'}
                      </pre>
                      <span className="text-xs text-accent mt-2 block">Click to edit</span>
                    </div>
                  )}
                </div>
              )}

              {settingsTab === 'tools' && (
                <div className="space-y-3">
                  {/* Attached tools */}
                  <div className="space-y-2">
                    {agentTools.length === 0 ? (
                      <p className="text-sm text-muted text-center py-4">No tools attached</p>
                    ) : agentTools.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-ink-900/10 bg-surface-secondary">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-ink-800 truncate">{t.name}</span>
                          {t.sourceType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{t.sourceType}</span>}
                        </div>
                        <button
                          onClick={() => detachTool(t.id)}
                          disabled={toolActionPending === t.id}
                          className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {toolActionPending === t.id ? '...' : '×'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Browse / attach tools */}
                  {showToolBrowser ? (
                    <div className="mt-4 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={toolFilter}
                          onChange={e => setToolFilter(e.target.value)}
                          placeholder="Filter tools..."
                          className="flex-1 rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-xs text-ink-800 focus:border-accent focus:outline-none"
                        />
                        <button
                          onClick={() => setShowToolBrowser(false)}
                          className="px-3 py-2 text-xs font-medium rounded-lg bg-surface-tertiary text-ink-600 hover:bg-ink-900/10 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {loadingTools ? (
                          <p className="text-sm text-muted text-center py-4">Loading...</p>
                        ) : availableTools.length === 0 ? (
                          <p className="text-sm text-muted text-center py-4">No unattached tools found</p>
                        ) : availableTools.map(t => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between p-2 rounded-lg border border-ink-900/10 bg-surface cursor-pointer hover:bg-accent/5 transition-colors"
                            onClick={() => attachTool(t.id)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-ink-800 truncate">{t.name}</span>
                              {t.sourceType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{t.sourceType}</span>}
                            </div>
                            <span className="text-xs text-accent">+ attach</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      className="w-full mt-4 px-3 py-2 text-xs font-medium rounded-lg bg-surface-tertiary text-ink-600 hover:bg-ink-900/10 transition-colors"
                      onClick={() => { setShowToolBrowser(true); loadAgentTools(); }}
                    >
                      + Attach Tool
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Delete Agent */}
            <div className="p-4 border-t border-ink-900/10">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete Agent
              </button>
            </div>
          </div>
        </Panel>

        <Separator className="w-1 bg-ink-900/10 hover:bg-accent/50 transition-colors" />

        {/* Center: Chat Panel */}
        <Panel defaultSize={50} minSize={30} maxSize={70}>
          <div className="h-full flex flex-col bg-surface-cream relative overflow-hidden">
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-6 pb-4 pt-4"
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

                {visibleMessages.length === 0 && !isLoadingMessages ? (
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
                      assistantName={nickname || agent.name || 'Assistant'}
                    />
                  ))
                )}

                {partialMessage && (
                  <div className="partial-message mt-4">
                    <div className="header text-accent">{nickname || agent.name || 'Assistant'}</div>
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

            {/* Input */}
            <div className="flex-shrink-0 bg-gradient-to-t from-surface via-surface to-transparent p-4">
              <div className="mx-auto w-full max-w-3xl">
                {showSlashCommands && inputValue.startsWith('/') && (
                  <div className="mb-2 bg-surface border border-ink-900/10 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                    {SLASH_COMMANDS
                      .filter(c => c.id.startsWith(inputValue.slice(1).toLowerCase()))
                      .map(cmd => (
                        <div
                          key={cmd.id}
                          className="px-4 py-2 flex items-center justify-between hover:bg-ink-900/5 cursor-pointer"
                          onClick={() => {
                            setInputValue(`/${cmd.id} `);
                            setShowSlashCommands(false);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-ink-900">/{cmd.id}</span>
                            <span className="text-xs text-ink-500">{cmd.desc}</span>
                          </div>
                        </div>
                      ))}
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
                    disabled={!activeConversationId || isStreaming}
                    style={{ minHeight: '24px', maxHeight: '200px' }}
                  />
                  <button
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleInputSend}
                    disabled={!activeConversationId || !inputValue.trim() || isStreaming}
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
                className="absolute bottom-24 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-accent-hover hover:scale-105"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
                <span>New messages</span>
              </button>
            )}
          </div>
        </Panel>

        <Separator className="w-1 bg-ink-900/10 hover:bg-accent/50 transition-colors" />

        {/* Right: Memory Panel */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <AgentMemoryPanel agentId={agentId} />
        </Panel>
      </PanelGroup>

      <ConfirmDialog
        open={showDeleteConfirm}
        variant="danger"
        title="Delete agent"
        message={`This will permanently delete "${agent.name}" along with all its conversations, memory blocks, and attached tools. This cannot be undone.`}
        requireTyped={agent.name}
        confirmLabel="Delete agent"
        busy={deleting}
        onConfirm={handleDeleteAgent}
        onCancel={() => !deleting && setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        open={convDeleteId !== null}
        variant="danger"
        title="Delete conversation"
        message={
          convDeleteId
            ? `Delete conversation ${convDeleteId.slice(0, 8)}? All messages in this conversation will be permanently lost. The agent and its memory are not affected.`
            : ''
        }
        confirmLabel="Delete conversation"
        busy={convDeleting}
        onConfirm={handleDeleteConversation}
        onCancel={() => !convDeleting && setConvDeleteId(null)}
      />
    </div>
  );
}

// ═══ Config Form Helpers ═══

function ConfigField({ label, value, onChange, type = 'text', mono, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; mono?: boolean; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-ink-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-xs text-ink-800 focus:border-accent focus:outline-none ${mono ? 'font-mono' : ''}`}
      />
      {hint && <span className="text-[10px] text-ink-500">{hint}</span>}
    </div>
  );
}

function ConfigToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs font-medium text-ink-700">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-accent' : 'bg-ink-900/20'}`}
      >
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function ConfigSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-ink-700">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-xs text-ink-800 focus:border-accent focus:outline-none"
      >
        {options.map(o => <option key={o} value={o}>{o || '(default)'}</option>)}
      </select>
    </div>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-ink-600">{label}</span>
      <span className="text-xs font-mono text-ink-800">{value}</span>
    </div>
  );
}
