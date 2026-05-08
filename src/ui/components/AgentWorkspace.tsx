import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { SplitPanePanel, SplitPaneGroup, SplitPaneDivider } from "./ui/layout/SplitPane";
import { useAppStore, isMemfsEnabledAgent, isConversationStale } from "../store/useAppStore";
import { useMessageWindow } from "../hooks/useMessageWindow";
import { useIPC } from "../hooks/useIPC";
import { useStreamingMessages } from "../hooks/useStreamingMessages";
import { useMessageHistory } from "../hooks/useMessageHistory";
import { getLettaClient, getConnectionMode } from "../services/api";
import type { Letta } from "@letta-ai/letta-client";
import { slashCommandHandlers } from "../services/slashCommands";
import type { ClientEvent, ServerEvent } from "../types";
import MDContent from "../render/markdown";
import { AgentMemoryPanel } from "./AgentMemoryPanel";
import { ToolApprovalDialog } from "./ToolApprovalDialog";
import { MessageCard } from "./EventCard";
import ConnectionModeIndicator, { ConnectionMode } from "./ConnectionModeIndicator";
import { ConfirmDialog } from "./ConfirmDialog";
import { useAgentNickname } from "../hooks/useAgentNickname";
import { Input } from "./ui/primitives/Input";
import { FormField } from "./ui/composites/FormField";
import { inputVariants } from "./ui/primitives/Input";
import { ToolStatusProvider } from "../contexts";

const SCROLL_THRESHOLD = 50;
const STALE_CONVERSATION_DAYS = 14;

// Tool output limits - prevent UI freeze on large outputs
const TOOL_OUTPUT_LIMIT = 30000; // 30K chars max for display
const DEFAULT_COLLAPSED_LINES = 3;
const DEFAULT_MAX_CHARS = 300;

/**
 * Sanitize tool output for safe rendering.
 * Removes control characters, null bytes, and terminal escape codes.
 */
function sanitizeToolOutput(output: string): string {
  if (!output || typeof output !== 'string') return '';

  // Remove null bytes (binary indicator)
  let sanitized = output.replace(/\x00/g, '');

  // Remove terminal escape sequences (ANSI codes)
  // Pattern matches CSI sequences like \x1b[31m (colors) and other escape codes
  sanitized = sanitized.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  sanitized = sanitized.replace(/\x1b][0-9];.*?\x07/g, ''); // OSC sequences
  sanitized = sanitized.replace(/\x1b[()][0-9A-Za-z]/g, ''); // Character set sequences

  // Remove other control characters except common whitespace
  // Keep: \n (10), \r (13), \t (9)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Clip tool output for display with line and character limits.
 * Similar to letta-code's clipToolReturn - prevents UI freeze on large outputs.
 *
 * @param text - Raw tool output
 * @param maxLines - Max lines to show (default 3)
 * @param maxChars - Max characters (default 300)
 * @returns Object with clipped text and metadata
 */
function clipToolOutput(
  text: string,
  maxLines: number = DEFAULT_COLLAPSED_LINES,
  maxChars: number = DEFAULT_MAX_CHARS
): { display: string; totalLines: number; hiddenLines: number; clipped: boolean } {
  if (!text) return { display: '', totalLines: 0, hiddenLines: 0, clipped: false };

  const totalLines = text.split('\n').length;

  // Don't clip user rejection reasons - they contain important feedback
  if (text.includes('request to call tool denied')) {
    return { display: text, totalLines, hiddenLines: 0, clipped: false };
  }

  // Hard limit for absolute safety
  const HARD_LIMIT = 10000;
  let clipped = text.length > HARD_LIMIT ? text.slice(0, HARD_LIMIT) : text;

  // Apply character limit
  if (clipped.length > maxChars) {
    clipped = clipped.slice(0, maxChars);
  }

  // Split into lines and limit
  let lines = clipped.split('\n');

  // Remove trailing empty line from final newline
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  const hiddenLines = Math.max(0, lines.length - maxLines);
  const visibleLines = lines.slice(0, maxLines);
  let display = visibleLines.join('\n');

  const wasClipped = text.length > maxChars || totalLines > maxLines;

  // Add ellipsis if truncated
  if (wasClipped || display.length < text.length) {
    // Try to break at word boundary if possible
    const lastSpace = display.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.8 && display.length > maxChars) {
      display = display.slice(0, lastSpace);
    }
    display += '…';
  }

  return { display, totalLines, hiddenLines, clipped: wasClipped };
}

/**
 * Safe tool output display component with error boundary pattern.
 * Prevents blank screen crashes by catching render errors.
 */
interface SafeToolOutputProps {
  output: string;
  maxLines?: number;
  maxChars?: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClippedInfo?: (info: { totalLines: number; hiddenLines: number; clipped: boolean }) => void;
}

function SafeToolOutput({
  output,
  maxLines = DEFAULT_COLLAPSED_LINES,
  maxChars = DEFAULT_MAX_CHARS,
  isExpanded,
  onToggleExpand,
  onClippedInfo,
}: SafeToolOutputProps) {
  console.log('[SAFETOOL] ========== COMPONENT RENDER ==========');
  console.log('[SAFETOOL] Props received - output length:', output?.length, 'isExpanded:', isExpanded);

  // Compute clipped output
  const clipped = useMemo(() => {
    console.log('[SAFETOOL] useMemo: computing clipped output...');
    console.log('[SAFETOOL] Input output length:', output.length);
    const sanitized = sanitizeToolOutput(output);
    console.log('[SAFETOOL] After sanitize, length:', sanitized.length);
    if (isExpanded) {
      // When expanded, just apply hard char limit for safety
      if (sanitized.length > TOOL_OUTPUT_LIMIT) {
        const hardClipped = sanitized.slice(0, TOOL_OUTPUT_LIMIT);
        const omitted = sanitized.length - TOOL_OUTPUT_LIMIT;
        console.log('[SAFETOOL] Expanded view, hard-clipped to', TOOL_OUTPUT_LIMIT);
        return {
          display: hardClipped + `\n\n[Output truncated: ${omitted.toLocaleString()} more characters]`,
          totalLines: sanitized.split('\n').length,
          hiddenLines: 0,
          clipped: true,
        };
      }
      console.log('[SAFETOOL] Expanded view, showing full sanitized');
      return {
        display: sanitized,
        totalLines: sanitized.split('\n').length,
        hiddenLines: 0,
        clipped: false,
      };
    }
    const result = clipToolOutput(sanitized, maxLines, maxChars);
    console.log('[SAFETOOL] Collapsed view - clipped result:', { totalLines: result.totalLines, hiddenLines: result.hiddenLines, clipped: result.clipped, displayLength: result.display.length });
    return result;
  }, [output, isExpanded, maxLines, maxChars]);

  // Notify parent of clipped info
  useEffect(() => {
    console.log('[SAFETOOL] Effect: notifying parent of clipped info', { totalLines: clipped.totalLines, hiddenLines: clipped.hiddenLines });
    onClippedInfo?.({
      totalLines: clipped.totalLines,
      hiddenLines: clipped.hiddenLines,
      clipped: clipped.clipped,
    });
  }, [clipped, onClippedInfo]);

  const shouldShowExpandButton = clipped.clipped || output.length > maxChars || clipped.totalLines > maxLines;
  console.log('[SAFETOOL] shouldShowExpandButton:', shouldShowExpandButton);
  console.log('[SAFETOOL] About to return JSX...');

  return (
    <div className="space-y-1">
      <div
        className={`text-xs text-ink-600 font-mono ${isExpanded ? 'max-h-[60vh] overflow-y-auto' : ''}`}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {(() => { console.log('[SAFETOOL] Rendering clipped.display, length:', clipped.display.length); return clipped.display; })()}
      </div>
      {shouldShowExpandButton && (
        <div className="flex items-center justify-between text-xs">
          {!isExpanded && clipped.hiddenLines > 0 && (
            <span className="text-ink-400">… +{clipped.hiddenLines} lines</span>
          )}
          <button
            onClick={() => { console.log('[SAFETOOL] Toggle expand clicked'); onToggleExpand(); }}
            className="text-green-700 hover:underline"
          >
            {isExpanded ? 'Show less' : clipped.hiddenLines > 0 ? 'Show full output' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  );
}

function conversationLastActivity(conv: { last_message_at?: string | null; updated_at?: string | null; created_at?: string | null }): number | null {
  const ts = conv.last_message_at ?? conv.updated_at ?? conv.created_at ?? null;
  if (!ts) return null;
  const t = Date.parse(ts);
  return Number.isNaN(t) ? null : t;
}

function conversationIdleLabel(conv: Parameters<typeof conversationLastActivity>[0]): string {
  const t = conversationLastActivity(conv);
  if (t === null) return '?';
  const diff = Date.now() - t;
  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;
  if (diff < 30 * day) return `${Math.floor(diff / week)}w`;
  return `${Math.floor(diff / (30 * day))}mo`;
}

function formatConversationOption(conv: { id: string; summary?: string | null; last_message_at?: string | null; updated_at?: string | null; created_at?: string | null; archived?: boolean }): string {
  const idTail = conv.id.slice(0, 8);
  const summary = conv.summary?.trim();
  const base = summary
    ? (summary.length > 40 ? `${summary.slice(0, 38)}…` : summary)
    : `Conversation ${idTail}`;
  const markers: string[] = [];
  if (conv.archived) markers.push('wrapped');
  else if (isConversationStale(conv)) markers.push(`idle ${conversationIdleLabel(conv)}`);
  return markers.length ? `${base} · ${markers.join(' · ')}` : base;
}

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

export function AgentWorkspace({ agentId, onBack, sendEvent }: AgentWorkspaceProps) {
  // Error boundary state to catch render crashes
  const [renderError, setRenderError] = useState<Error | null>(null);
  // Error boundary for message list (isolated from main render)
  const [messageListCrashError, setMessageListCrashError] = useState<Error | null>(null);

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

  // Save-diff preview: staged config changes awaiting user confirmation.
  // Keys are human labels, values are {from, to} primitives/strings for display.
  type StagedDiff = { label: string; from: unknown; to: unknown }[];
  const [pendingChanges, setPendingChanges] = useState<{
    updates: Record<string, unknown>;
    diff: StagedDiff;
  } | null>(null);

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

  // Config form population helper - defined early for useEffect access
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
  }, [
    setCfgName,
    setCfgDesc,
    setCfgModel,
    setCfgEmbedding,
    setCfgContextWindow,
    setCfgMaxTokens,
    setCfgEnableReasoner,
    setCfgMaxReasoningTokens,
    setCfgEffort,
    setCfgFreqPenalty,
    setCfgParallelToolCalls,
    setCfgSleeptime,
    setCfgAutoclear,
    setCfgTags,
    setCfgModelEndpoint,
  ]);

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
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingContentRef = useRef("");
  const pendingReasoningRef = useRef("");
  const [streamingReasoning, setStreamingReasoning] = useState("");
  const [streamingToolCall, setStreamingToolCall] = useState<{name: string, args: string} | null>(null);
  const [streamingToolResult, setStreamingToolResult] = useState<string | null>(null);
  const [showFullReasoning, setShowFullReasoning] = useState(false);
  const [showFullToolResult, setShowFullToolResult] = useState(false);
  const [showFullPartialMessage, setShowFullPartialMessage] = useState(false);
  // Track clipped output info for line-based truncation display
  const clippedOutputRef = useRef<{ totalLines: number; hiddenLines: number; clipped: boolean }>({ totalLines: 0, hiddenLines: 0, clipped: false });
  // Interrupt state - prevents double-clicks and blocks sends briefly during cleanup
  const [isInterrupted, setIsInterrupted] = useState(false);

  // Throttled flush for smooth streaming - batches rapid updates to avoid ReactMarkdown re-parsing on every chunk
  const startThrottledFlush = useCallback(() => {
    if (flushIntervalRef.current) return;
    flushIntervalRef.current = setInterval(() => {
      if (pendingContentRef.current !== partialMessageRef.current) {
        partialMessageRef.current = pendingContentRef.current;
        setPartialMessage(pendingContentRef.current);
      }
      if (pendingReasoningRef.current !== streamingReasoning) {
        setStreamingReasoning(pendingReasoningRef.current);
      }
    }, 150); // 150ms = ~6.7fps, smooth word-by-word without overwhelming ReactMarkdown
  }, [streamingReasoning]);

  const stopThrottledFlush = useCallback(() => {
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
    // Final flush
    if (pendingContentRef.current !== partialMessageRef.current) {
      partialMessageRef.current = pendingContentRef.current;
      setPartialMessage(pendingContentRef.current);
    }
    if (pendingReasoningRef.current !== streamingReasoning) {
      setStreamingReasoning(pendingReasoningRef.current);
    }
  }, [streamingReasoning]);

  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  // Optimistic user message: shows the just-sent user prompt instantly while
  // the stream runs, instead of waiting for the post-stream history refetch.
  // Cleared when the refetch returns (the server-side message takes its place).
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const scrollHeightBeforeLoadRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);
  const prevMessagesLengthRef = useRef(0);

  // Connection mode (3-mode architecture: server / local / remote)
  // Reads from localStorage to stay in sync with SettingsPanel
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(() => getConnectionMode());
  const [remoteUrl, setRemoteUrl] = useState<string>('');

  // Focus mode: collapses the workspace down to just the chat stream — no
  // settings, no memory panel, no model badge / connection chip / slash
  // commands. Preference is persisted per agent in localStorage so the
  // dashboard can pre-arm it before navigating (Home → Chat sets the key,
  // we read it on mount). Independent toggle in the header lets users
  // enter or leave focus from inside the workspace too.
  const focusModeKey = `letta:focus-mode:${agentId}`;
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    try { return localStorage.getItem(focusModeKey) === 'true'; } catch { return false; }
  });
  // Re-sync from localStorage whenever the agent changes — the Home
  // dashboard writes the key just before navigating, so we need to honor
  // the new value even when AgentWorkspace was already mounted (e.g. user
  // clicked Memory then Chat for the same agent).
  useEffect(() => {
    try { setFocusMode(localStorage.getItem(focusModeKey) === 'true'); } catch { /* ignore */ }
  }, [focusModeKey]);
  useEffect(() => {
    try {
      if (focusMode) localStorage.setItem(focusModeKey, 'true');
      else localStorage.removeItem(focusModeKey);
    } catch { /* ignore quota / privacy errors */ }
  }, [focusMode, focusModeKey]);

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
    abort: abortStream,
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
  }, [agent?.raw, populateConfigForm]);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages]);

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
      pendingContentRef.current = "";
      pendingReasoningRef.current = "";
      partialMessageRef.current = "";
      setPartialMessage("");
      setStreamingReasoning("");
      setShowPartialMessage(true);
      startThrottledFlush();
    }

    if (event.type === "content_block_delta" && event.delta) {
      // Separate reasoning from content
      if (event.delta.reasoning) {
        pendingReasoningRef.current += event.delta.reasoning;
      }
      if (event.delta.text) {
        pendingContentRef.current += event.delta.text;
      }
      if (shouldAutoScroll) {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      } else {
        setHasNewMessages(true);
      }
    }

    // Tool call from IPC
    if (event.type === "tool_call" || (event as {message_type?: string}).message_type === "tool_call_message") {
      const toolEvent = message.event as unknown as { type: string; tool_call?: { name: string; arguments: Record<string, unknown> }; toolName?: string; toolInput?: Record<string, unknown> };
      const name = toolEvent.tool_call?.name || toolEvent.toolName || 'unknown';
      const args = toolEvent.tool_call?.arguments || toolEvent.toolInput || {};
      console.log('[AgentWorkspace] IPC tool call:', name, args);
      setStreamingToolCall({
        name,
        args: JSON.stringify(args, null, 2)
      });
    }

    // Tool return from IPC
    if (event.type === "tool_return" || (event as {message_type?: string}).message_type === "tool_return_message") {
      console.log('[AGENTWORKSPACE] ========== TOOL_RETURN RECEIVED ==========');
      console.log('[AGENTWORKSPACE] Raw message:', JSON.stringify(message, null, 2));
      try {
        const returnEvent = message.event as unknown as { type: string; tool_return?: unknown; output?: unknown; result?: unknown };
        console.log('[AGENTWORKSPACE] returnEvent:', returnEvent);
        // Handle non-string outputs (objects, arrays, etc)
        let output: string;
        const rawOutput = returnEvent.tool_return ?? returnEvent.output ?? returnEvent.result ?? "";
        console.log('[AGENTWORKSPACE] rawOutput type:', typeof rawOutput, 'length:', String(rawOutput).length);
        if (typeof rawOutput === 'string') {
          output = rawOutput;
          console.log('[AGENTWORKSPACE] Output is string, length:', output.length);
          console.log('[AGENTWORKSPACE] First 200 chars:', output.slice(0, 200));
        } else if (rawOutput !== null && rawOutput !== undefined) {
          try {
            output = JSON.stringify(rawOutput, null, 2);
            console.log('[AGENTWORKSPACE] Output stringified from object');
          } catch {
            output = String(rawOutput);
            console.log('[AGENTWORKSPACE] Output converted via String()');
          }
        } else {
          output = "";
          console.log('[AGENTWORKSPACE] Output is empty string (raw was null/undefined)');
        }
        console.log('[AGENTWORKSPACE] About to sanitize, output length:', output.length);
        // Sanitize output for safe rendering
        output = sanitizeToolOutput(output);
        console.log('[AGENTWORKSPACE] Sanitized output length:', output.length);
        console.log('[AGENTWORKSPACE] Setting streamingToolResult...');
        setStreamingToolResult(output);
        console.log('[AGENTWORKSPACE] streamingToolResult state set');
        setStreamingToolCall(null);
        console.log('[AGENTWORKSPACE] streamingToolCall cleared');
      } catch (err) {
        console.error('[AGENTWORKSPACE] CRASH in tool_return handler:', err);
        // Set a safe fallback message instead of crashing
        setStreamingToolResult('[Error: Unable to display tool output]');
        setStreamingToolCall(null);
      }
      console.log('[AGENTWORKSPACE] ========== TOOL_RETURN DONE ==========');
    }

    if (event.type === "content_block_stop") {
      stopThrottledFlush();
      setShowPartialMessage(false);
      setTimeout(() => {
        partialMessageRef.current = "";
        pendingContentRef.current = "";
        pendingReasoningRef.current = "";
        setPartialMessage("");
        setStreamingReasoning("");
      }, 500);
    }
  }, [shouldAutoScroll, startThrottledFlush, stopThrottledFlush]);

  // Post-stream cleanup: shared between IPC and browser paths.
  const completeStream = useCallback(() => {
    stopThrottledFlush();
    setShowPartialMessage(false);
    partialMessageRef.current = '';
    pendingContentRef.current = '';
    pendingReasoningRef.current = '';
    setPartialMessage('');
    setStreamingReasoning('');
    setStreamingToolCall(null);
    setStreamingToolResult(null);
    setPendingUserMessage(null);
    pendingIpcStreamRef.current = false;
    // Reset "show full" flags for next stream
    setShowFullReasoning(false);
    setShowFullToolResult(false);
    setShowFullPartialMessage(false);
  }, [stopThrottledFlush]);

  // Event handler for IPC
  const onEvent = useCallback((event: ServerEvent) => {
    handleServerEvent(event);
    handlePartialMessages(event);

    // When an IPC stream completes, refetch full history and clean up.
    // This mirrors what the browser path does after `for await` finishes.
    if (event.type === "session.status") {
      if (event.payload.status === "running" && pendingIpcStreamRef.current) {
        // First running event carries the conversationId from the SDK.
        // Make sure AgentWorkspace tracks it so subsequent sends use
        // session.continue instead of session.start.
        const sid = event.payload.sessionId;
        if (sid && !activeConversationId) {
          setActiveConversationId(sid);
        }
      }
      if (event.payload.status === "completed" && pendingIpcStreamRef.current) {
        loadMessages(event.payload.sessionId).then(() => completeStream());
      }
    }
  }, [handleServerEvent, handlePartialMessages, loadMessages, completeStream, activeConversationId, setActiveConversationId]);

  useIPC(onEvent);

  // ── Permission requests (tool approval UI) ────────────────────────────────
  // Read the active session's pending permission requests from the store.
  // The latest request drives the ToolApprovalDialog.
  const sessions = useAppStore((s) => s.sessions);
  const resolvePermissionRequest = useAppStore((s) => s.resolvePermissionRequest);
  const activeSession = activeConversationId ? sessions[activeConversationId] : undefined;
  const permissionRequests = activeSession?.permissionRequests ?? [];
  console.log('[AgentWorkspace] permissionRequests count:', permissionRequests.length);

  // Latest unresolved request drives the modal
  const latestPermissionRequest = permissionRequests.length > 0
    ? permissionRequests[permissionRequests.length - 1]
    : null;
  if (latestPermissionRequest) {
    console.log('[AgentWorkspace] latestPermissionRequest:', latestPermissionRequest);
  }

  const handlePermissionResponse = useCallback((allow: boolean) => {
    if (!latestPermissionRequest) return;
    const { toolUseId } = latestPermissionRequest;
    // Remove the request from store immediately so the dialog closes
    if (activeConversationId) {
      resolvePermissionRequest(activeConversationId, toolUseId);
    }
    // Send the IPC response
    sendEvent({
      type: "permission.response",
      payload: {
        sessionId: activeConversationId ?? "",
        toolUseId,
        result: allow
          ? { behavior: "allow" as const }
          : { behavior: "deny" as const, message: "Denied by user" },
      },
    });
  }, [latestPermissionRequest, activeConversationId, resolvePermissionRequest, sendEvent]);

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

  // User-initiated scroll detection: wheel-up / touchmove / page-up keys are
  // unambiguous "I want to leave the bottom" signals. Listening to the raw
  // events lets us drop auto-stick *immediately*, before the next stream
  // chunk fires another scrollIntoView. Without this the chunk scroll keeps
  // yanking the user back down because handleScroll's "at bottom" check
  // races the programmatic scroll itself.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const releaseAutoScroll = () => {
      setShouldAutoScroll(false);
      setHasNewMessages(true);
    };
    const onWheel = (e: WheelEvent) => { if (e.deltaY < 0) releaseAutoScroll(); };
    const onTouchMove = () => releaseAutoScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PageUp' || e.key === 'ArrowUp' || e.key === 'Home') releaseAutoScroll();
    };
    container.addEventListener('wheel', onWheel, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('keydown', onKey);
    };
  }, []);

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
      // Instant scroll — see comment in handlePartialMessages for rationale.
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
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

  // Build a diff + update payload by comparing the current form state against
  // the server's last-known agent config. Returns null when nothing changed.
  const buildConfigDiff = (): { updates: Record<string, unknown>; diff: StagedDiff } | null => {
    if (!agent?.raw) return null;
    const r = agent.raw;
    const llm = (r.llm_config as Record<string, unknown>) || {};
    const updates: Record<string, unknown> = {};
    const diff: StagedDiff = [];
    const push = (label: string, from: unknown, to: unknown) => diff.push({ label, from, to });

    const rName = (r.name as string) || '';
    if (cfgName !== rName) { updates.name = cfgName; push('Name', rName || '—', cfgName || '—'); }

    const rDesc = (r.description as string) || '';
    if (cfgDesc !== rDesc) { updates.description = cfgDesc || null; push('Description', rDesc || '—', cfgDesc || '—'); }

    const rModel = (r.model as string) || (llm.handle as string) || (llm.model as string) || '';
    if (cfgModel !== rModel) { updates.model = cfgModel || null; push('Model', rModel || '—', cfgModel || '—'); }

    const rEmbedding = (r.embedding as string) || '';
    if (cfgEmbedding !== rEmbedding) { updates.embedding = cfgEmbedding || null; push('Embedding', rEmbedding || '—', cfgEmbedding || '—'); }

    const rSleeptime = (r.enable_sleeptime as boolean) || false;
    if (cfgSleeptime !== rSleeptime) { updates.enable_sleeptime = cfgSleeptime; push('Sleeptime', rSleeptime, cfgSleeptime); }

    const rAutoclear = (r.message_buffer_autoclear as boolean) || false;
    if (cfgAutoclear !== rAutoclear) { updates.message_buffer_autoclear = cfgAutoclear; push('Autoclear Buffer', rAutoclear, cfgAutoclear); }

    const newTags = cfgTags.split(',').map(t => t.trim()).filter(Boolean);
    const oldTagsArr = (r.tags as string[]) || [];
    const oldTagsStr = oldTagsArr.join(', ');
    if (cfgTags !== oldTagsStr) { updates.tags = newTags; push('Tags', oldTagsStr || '—', newTags.join(', ') || '—'); }

    const cwl = cfgContextWindow ? parseInt(cfgContextWindow) : null;
    const rCwl = (r.context_window_limit as number) || null;
    if (cwl !== rCwl) { updates.context_window_limit = cwl; push('Context Window', rCwl ?? '—', cwl ?? '—'); }

    const llmUpdates: Record<string, unknown> = {};

    const mt = cfgMaxTokens ? parseInt(cfgMaxTokens) : null;
    const rMt = (llm.max_tokens as number) || null;
    if (mt !== rMt) { llmUpdates.max_tokens = mt; push('Max Tokens', rMt ?? '—', mt ?? '—'); }

    const rReasoner = (llm.enable_reasoner as boolean) || false;
    if (cfgEnableReasoner !== rReasoner) { llmUpdates.enable_reasoner = cfgEnableReasoner; push('Reasoner', rReasoner, cfgEnableReasoner); }

    const mrt = cfgMaxReasoningTokens ? parseInt(cfgMaxReasoningTokens) : undefined;
    const rMrt = (llm.max_reasoning_tokens as number) || undefined;
    if (mrt !== rMrt) { llmUpdates.max_reasoning_tokens = mrt; push('Max Reasoning Tokens', rMrt ?? '—', mrt ?? '—'); }

    const rEffort = (llm.effort as string) || '';
    if (cfgEffort !== rEffort) { llmUpdates.effort = cfgEffort || null; push('Effort', rEffort || '—', cfgEffort || '—'); }

    const fp = cfgFreqPenalty ? parseFloat(cfgFreqPenalty) : null;
    const rFp = (llm.frequency_penalty as number) || null;
    if (fp !== rFp) { llmUpdates.frequency_penalty = fp; push('Freq. Penalty', rFp ?? '—', fp ?? '—'); }

    const rParallel = (llm.parallel_tool_calls as boolean) || false;
    if (cfgParallelToolCalls !== rParallel) { llmUpdates.parallel_tool_calls = cfgParallelToolCalls; push('Parallel Tools', rParallel, cfgParallelToolCalls); }

    const rEndpoint = (llm.model_endpoint as string) || '';
    if (cfgModelEndpoint !== rEndpoint) { llmUpdates.model_endpoint = cfgModelEndpoint || null; push('Endpoint', rEndpoint || '—', cfgModelEndpoint || '—'); }

    if (Object.keys(llmUpdates).length > 0) {
      updates.llm_config = { ...llm, ...llmUpdates };
    }

    if (diff.length === 0) return null;
    return { updates, diff };
  };

  // Stage the save: compute the diff, show the preview modal. User then
  // confirms or cancels in the modal.
  const saveConfig = () => {
    setSaveMessage(null);
    const staged = buildConfigDiff();
    if (!staged) {
      setSaveMessage('No changes');
      setTimeout(() => setSaveMessage(null), 2000);
      return;
    }
    setPendingChanges(staged);
  };

  // Apply the staged save. Called from the diff-preview modal.
  const applyPendingChanges = async () => {
    if (!pendingChanges) return;
    setSavingConfig(true);
    try {
      await updateAgent(agentId, pendingChanges.updates);
      setSaveMessage('Saved');
      loadAgent(agentId);
      setTimeout(() => setSaveMessage(null), 2000);
      setPendingChanges(null);
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
      const client = getLettaClient();
      const [attached, all] = await Promise.all([
        (async () => {
          const out: Letta.Tool[] = [];
          for await (const t of client.agents.tools.list(agentId)) out.push(t);
          return out;
        })(),
        (async () => {
          const out: Letta.Tool[] = [];
          for await (const t of client.tools.list()) out.push(t);
          return out;
        })(),
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
      console.error('[AgentWorkspace] Failed to load tools:', err);
    } finally {
      setLoadingTools(false);
    }
  };

  const attachTool = async (toolId: string) => {
    setToolActionPending(toolId);
    try {
      await getLettaClient().agents.tools.attach(toolId, { agent_id: agentId });
      await loadAgentTools();
    } catch (err) {
      console.error('[AgentWorkspace] Failed to attach tool:', err);
      setSaveMessage(`Failed to attach tool: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setToolActionPending(null);
    }
  };

  const detachTool = async (toolId: string) => {
    setToolActionPending(toolId);
    const previousTools = agentTools;
    try {
      await getLettaClient().agents.tools.detach(toolId, { agent_id: agentId });
      setAgentTools(prev => prev.filter(t => t.id !== toolId));
    } catch (err) {
      console.error('[AgentWorkspace] Failed to detach tool:', err);
      setAgentTools(previousTools); // Revert optimistic removal
      setSaveMessage(`Failed to detach tool: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setSaveMessage(null), 3000);
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
      console.error('[AgentWorkspace] Failed to create conversation:', err);
      setSaveMessage(`Failed to create conversation: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setSaveMessage(null), 3000);
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

  // Ref to track whether a stream is in-flight over IPC so the
  // session.status:completed handler can trigger the post-stream refetch.
  const pendingIpcStreamRef = useRef<boolean>(false);

  const handleInputSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming || isInterrupted) return;

    const isElectron = typeof window !== 'undefined' && window.electron;

    // Auto-create conversation if none exists (browser path only — for
    // Electron, the SDK session creates the conversation on first send).
    let conversationId = activeConversationId;
    if (!conversationId && !isElectron) {
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

    // Optimistic render: show the user's message immediately. Without this
    // the message stays invisible until after the stream completes and the
    // history refetch lands, then user + assistant snap in together.
    setPendingUserMessage(userMsg);
    setShowPartialMessage(true);
    partialMessageRef.current = '';
    setPartialMessage('');

    // ── Electron path: route through IPC → SDK Session → CLI subprocess ───
    // The CLI handles tool execution (bash, read, write) natively. Messages
    // arrive as stream.message IPC events rendered by handlePartialMessages.
    if (isElectron) {
      pendingIpcStreamRef.current = true;

      // Don't pre-create the conversation — let the SDK session create it.
      // When it does, the store's handleServerEvent picks up the new
      // conversationId from session.status and sets activeSessionId.
      if (!activeConversationId) {
        sendEvent({
          type: "session.start",
          payload: { title: agentId, prompt: userMsg, agentId },
        });
      } else {
        sendEvent({
          type: "session.continue",
          payload: { sessionId: conversationId!, prompt: userMsg },
        });
      }
      return;
    }

    // ── Browser path: direct REST API (no tool execution) ─────────────────
    pendingIpcStreamRef.current = false;
    const convId = conversationId!; // guaranteed by the create logic above

    try {
      const stream = streamMessage(userMsg);
      pendingContentRef.current = '';
      pendingReasoningRef.current = '';
      setStreamingToolCall(null);
      setStreamingToolResult(null);
      startThrottledFlush();

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'assistant':
            pendingContentRef.current += chunk.content;
            if (shouldAutoScroll) {
              messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }
            break;
          case 'reasoning':
            pendingReasoningRef.current += chunk.reasoning;
            break;
          case 'tool_call': {
            // Defensive - chunk shape varies by SDK version
            const toolName = (chunk as {name?: string; toolName?: string}).name || (chunk as {name?: string; toolName?: string}).toolName || 'unknown';
            const toolArgs = (chunk as {arguments?: Record<string, unknown>; toolInput?: Record<string, unknown>}).arguments || (chunk as {arguments?: Record<string, unknown>; toolInput?: Record<string, unknown>}).toolInput || {};
            console.log('[AgentWorkspace] Tool call:', toolName, toolArgs);
            setStreamingToolCall({
              name: toolName,
              args: JSON.stringify(toolArgs, null, 2)
            });
            break;
          }
          case 'tool_return': {
            console.log('[AGENTWORKSPACE] STREAM: ========== TOOL_RETURN RECEIVED ==========');
            try {
              let output = (chunk as {output?: string; tool_return?: string; result?: string}).output || (chunk as {output?: string; tool_return?: string; result?: string}).tool_return || (chunk as {output?: string; tool_return?: string; result?: string}).result || '';
              console.log('[AGENTWORKSPACE] STREAM: output type:', typeof output, 'length:', String(output).length);
              console.log('[AGENTWORKSPACE] STREAM: First 100 chars:', String(output).slice(0, 100));
              // Sanitize bash output
              if (typeof output === 'string') {
                output = sanitizeToolOutput(output);
                console.log('[AGENTWORKSPACE] STREAM: After sanitize, length:', output.length);
              }
              console.log('[AGENTWORKSPACE] STREAM: Setting streamingToolResult...');
              setStreamingToolResult(output);
              console.log('[AGENTWORKSPACE] STREAM: streamingToolResult set');
              setStreamingToolCall(null);
            } catch (err) {
              console.error('[AGENTWORKSPACE] STREAM: CRASH in tool_return handler:', err);
              setStreamingToolResult('[Error: Unable to display tool output]');
              setStreamingToolCall(null);
            }
            console.log('[AGENTWORKSPACE] STREAM: ========== TOOL_RETURN DONE ==========');
            break;
          }
          case 'error':
            pendingContentRef.current += `\n\nError: ${chunk.message}`;
            break;
        }
      }

      stopThrottledFlush();
      await loadMessages(convId);
    } catch (err) {
      console.error('[AgentWorkspace] Stream error:', err);
      stopThrottledFlush();
      pendingContentRef.current += `\n\nStream error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      partialMessageRef.current = pendingContentRef.current;
      setPartialMessage(pendingContentRef.current);
    } finally {
      // Clear streaming states
      pendingReasoningRef.current = '';
      setStreamingReasoning('');
      setStreamingToolCall(null);
      setStreamingToolResult(null);
      completeStream();
    }
  }, [inputValue, activeConversationId, isStreaming, handleSlashCommand, resetToLatest, shouldAutoScroll, agentId, createConversation, setActiveConversationId, sendEvent]);

  const handleInterrupt = useCallback(async () => {
    if (!isStreaming || !activeConversationId) return;

    console.log('[AgentWorkspace] Interrupting stream for session:', activeConversationId);

    // Send abort via IPC (Electron path)
    const isElectron = typeof window !== 'undefined' && window.electron;
    if (isElectron) {
      sendEvent({
        type: "session.stop",
        payload: { sessionId: activeConversationId },
      });
    } else {
      // Browser mode - use AbortController
      abortStream();
    }

    // Immediate UI cleanup
    setIsInterrupted(true);
    stopThrottledFlush();
    completeStream();

    // Auto-clear interrupted flag after brief delay
    setTimeout(() => setIsInterrupted(false), 500);
  }, [isStreaming, activeConversationId, sendEvent, abortStream, stopThrottledFlush, completeStream]);

  const getModelDisplay = (model: string) => {
    if (!model) return "Unknown";
    return model.split('/').pop()?.split(':')[0] || model;
  };

  // Simple error display for render crashes
  if (renderError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-surface-cream p-8">
        <div className="max-w-lg w-full bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">UI Error</h2>
          <pre className="text-xs text-red-700 whitespace-pre-wrap">{renderError.message}

{renderError.stack}</pre>
          <button
            onClick={() => setRenderError(null)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

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

  // Catch render errors and store them for display
  try {
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
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-semibold text-ink-900">{agent.name}</h1>
                {isMemfsEnabledAgent(agent.raw as { memory?: { git_enabled?: boolean } | null; tags?: string[] | null } | undefined) && (
                  <span
                    className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-medium uppercase tracking-wide"
                    title="git-memory-enabled — agent uses memfs (git-backed memory)"
                  >
                    memfs
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-ink-500">{getModelDisplay(agent.model)}</span>
                <span className="text-[10px] text-ink-400 font-mono" title="Agent ID">ID: {agent.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!focusMode && (
            <ConnectionModeIndicator
              mode={connectionMode}
              onModeChange={setConnectionMode}
              remoteUrl={remoteUrl}
              onRemoteUrlChange={setRemoteUrl}
              agentId={agentId}
            />
          )}

          {/* Stale-conversation count badge */}
          {!focusMode && agent.conversations && agent.conversations.length > 0 && (() => {
            const staleCount = agent.conversations.filter(isConversationStale).length;
            if (staleCount === 0) return null;
            return (
              <span
                className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium"
                title={`${staleCount} conversation${staleCount === 1 ? '' : 's'} idle ≥${STALE_CONVERSATION_DAYS} days. Open one and click "Wrap up" to summarize and archive.`}
              >
                {staleCount} stale
              </span>
            );
          })()}

          {/* Conversation Selector */}
          {agent.conversations && agent.conversations.length > 0 && (
            <div className="flex items-center gap-1">
              <FormField label="Conversation" layout="horizontal" className="items-center">
                <select
                  value={activeConversationId || ""}
                  onChange={(e) => setActiveConversationId(e.target.value || null)}
                  className={inputVariants({ size: 'sm' }) + ' max-w-[18rem]'}
                  title="Conversation selector — labels prefer the upstream summary, fall back to short id"
                  aria-label="Select conversation"
                >
                  {agent.conversations.map((conv) => (
                    <option key={conv.id} value={conv.id}>
                      {formatConversationOption(conv)}
                    </option>
                  ))}
                </select>
              </FormField>
              {activeConversationId && (() => {
                const activeConv = agent.conversations.find((c) => c.id === activeConversationId);
                const stale = activeConv ? isConversationStale(activeConv) : false;
                return (
                  <>
                    {stale && (
                      <button
                        onClick={() => setInputValue('/wrapup')}
                        title="Conversation is idle ≥2 weeks. Inserts /wrapup so the agent can summarize, extract facts to memory, and archive."
                        aria-label="Wrap up this stale conversation"
                        className="px-2 py-1 rounded-lg text-amber-700 bg-amber-100 hover:bg-amber-200 text-xs font-medium transition-colors"
                      >
                        Wrap up
                      </button>
                    )}
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
                  </>
                );
              })()}
            </div>
          )}

          <button
            onClick={handleCreateConversation}
            className="px-3 py-1.5 text-sm font-medium text-accent hover:text-accent-hover hover:bg-accent/10 rounded-lg transition-colors"
          >
            + New
          </button>

          {/* Slash Commands Dropdown */}
          {!focusMode && (
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
          )}

          {/* Focus mode toggle — last item in header so it's predictable.
              Compresses workspace to chat-only; the Home dashboard's Chat
              button can pre-arm this via localStorage. */}
          <button
            onClick={() => setFocusMode((f) => !f)}
            className={`p-1.5 rounded-lg transition-colors ${
              focusMode
                ? 'bg-accent/15 text-accent hover:bg-accent/25'
                : 'text-ink-500 hover:text-ink-900 hover:bg-ink-900/5'
            }`}
            title={focusMode ? 'Exit focus mode (show settings + memory panels)' : 'Focus mode — chat only, hide side panels'}
            aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            aria-pressed={focusMode}
          >
            {focusMode ? (
              // outward arrows = "expand back to full"
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            ) : (
              // inward arrows = "compress to chat only"
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 9V5m0 0H5m4 0L4 4m11 5h4m0 0V5m0 4l5-5M9 15v4m0 0H5m4 0l-5 5m11-5h4m0 0v4m0-4l5 5" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* 3-Pane Layout — collapses to chat-only in focus mode. */}
      <SplitPaneGroup
        orientation="horizontal"
        className="flex-1 min-h-0"
      >
        {/* Left: Settings Panel */}
        {!focusMode && (
        <SplitPanePanel defaultSize={25} minSize={15} maxSize={40}>
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
                      <FormField label="System Prompt">
                        <textarea
                          value={systemDraft}
                          onChange={e => setSystemDraft(e.target.value)}
                          rows={20}
                          className={inputVariants({ size: 'sm' }) + ' resize-vertical font-mono'}
                        />
                      </FormField>
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
                        <Input
                          type="text"
                          value={toolFilter}
                          onChange={e => setToolFilter(e.target.value)}
                          placeholder="Filter tools..."
                          size="sm"
                          className="flex-1"
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

            {/* Delete Agent — demoted to icon-only danger menu */}
            <div className="p-3 border-t border-ink-900/10">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-xs text-ink-400 hover:text-red-600 transition-colors"
                title="Delete this agent permanently"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
                Delete Agent
              </button>
            </div>
          </div>
        </SplitPanePanel>
        )}

        {!focusMode && <SplitPaneDivider orientation="horizontal" />}

        {/* Center: Chat Panel — fills the group when focusMode is on. */}
        <SplitPanePanel defaultSize={focusMode ? 100 : 50} minSize={focusMode ? 100 : 30} maxSize={100}>
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

                {latestPermissionRequest && <div style={{background: 'yellow', padding: 10}}>PERMISSION REQUEST EXISTS</div>}
                {(() => {
                  // Isolated render for ToolStatusProvider to prevent crashes from propagating
                  try {
                    return (
                <ToolStatusProvider>
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
                        permissionRequest={undefined}
                        onPermissionResult={() => {}}
                        assistantName={nickname || agent.name || 'Assistant'}
                      />
                    ))
                  )}

                  {pendingUserMessage && (
                    <MessageCard
                      key={`${activeConversationId}-pending-user`}
                      message={{ type: 'user_prompt', prompt: pendingUserMessage }}
                      isLast={false}
                      isRunning={false}
                      permissionRequest={undefined}
                      onPermissionResult={() => {}}
                      assistantName={nickname || agent.name || 'Assistant'}
                    />
                  )}
                </ToolStatusProvider>
                    );
                  } catch (err) {
                    if (!messageListCrashError) {
                      setTimeout(() => setMessageListCrashError(err instanceof Error ? err : new Error(String(err))), 0);
                    }
                    return (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h3 className="text-red-700 font-semibold">Message List Error</h3>
                        <pre className="text-xs text-red-600 mt-2 whitespace-pre-wrap">{err instanceof Error ? err.message : String(err)}</pre>
                      </div>
                    );
                  }
                })()}

                {/* Streaming reasoning display - limited to prevent UI freeze */}
                {streamingReasoning && streamingReasoning.length > 0 && (
                  <div className="mt-4 rounded-lg bg-ink-900/5 border border-ink-900/10 overflow-hidden">
                    <div className="p-3">
                      <div className="text-xs text-ink-500 mb-1 flex items-center justify-between">
                        <span>Thinking... ({streamingReasoning.length} chars)</span>
                        {streamingReasoning.length > 500 && (
                          <button
                            onClick={() => setShowFullReasoning(!showFullReasoning)}
                            className="text-accent hover:underline text-xs"
                          >
                            {showFullReasoning ? 'Show less' : 'Show full'}
                          </button>
                        )}
                      </div>
                      <div className={`text-sm text-ink-700 italic whitespace-pre-wrap ${showFullReasoning ? 'max-h-96 overflow-y-auto' : 'max-h-32 overflow-hidden'}`}>
                        {streamingReasoning}
                      </div>
                    </div>
                  </div>
                )}

                {/* Streaming tool call display */}
                {streamingToolCall && (
                  <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <div className="text-xs text-accent mb-1">Using tool: {streamingToolCall.name}</div>
                    <pre className="text-xs text-ink-600 overflow-x-auto max-h-32">{streamingToolCall.args.slice(0, 500)}</pre>
                  </div>
                )}

                {/* Streaming tool result display - with line-based truncation and error boundary */}
                {(() => { console.log('[AGENTWORKSPACE] RENDER: Checking streamingToolResult:', { hasResult: !!streamingToolResult, length: streamingToolResult?.length }); return null; })()}
                {streamingToolResult && streamingToolResult.length > 0 && (
                  <div className="mt-2 rounded-lg bg-green-50 border border-green-200">
                    {(() => { console.log('[AGENTWORKSPACE] RENDER: Rendering tool result container'); return null; })()}
                    <div className="p-3">
                      <div className="text-xs text-green-600 mb-1">
                        Tool result ({streamingToolResult.length.toLocaleString()} chars
                        {clippedOutputRef.current.hiddenLines > 0 && !showFullToolResult && (
                          <span>, {clippedOutputRef.current.totalLines} lines total</span>
                        )})
                      </div>
                      {(() => { console.log('[AGENTWORKSPACE] RENDER: About to render SafeToolOutput'); return null; })()}
                      <SafeToolOutput
                        output={streamingToolResult}
                        isExpanded={showFullToolResult}
                        onToggleExpand={() => setShowFullToolResult(!showFullToolResult)}
                        onClippedInfo={(info) => { clippedOutputRef.current = info; }}
                      />
                    </div>
                  </div>
                )}

                {partialMessage && partialMessage.length > 0 && (
                  <div className="partial-message mt-4">
                    <div className="header text-accent flex items-center justify-between">
                      <span>{nickname || agent.name || 'Assistant'}</span>
                      {partialMessage.length > 5000 && (
                        <button
                          onClick={() => setShowFullPartialMessage(!showFullPartialMessage)}
                          className="text-accent hover:underline text-xs"
                        >
                          {showFullPartialMessage ? 'Show less' : 'Show full response'}
                        </button>
                      )}
                    </div>
                    <div className={showFullPartialMessage ? '' : 'max-h-[50vh] overflow-y-auto'}>
                      <MDContent text={partialMessage.slice(0, showFullPartialMessage ? 50000 : 5000)} />
                    </div>
                    {!showFullPartialMessage && partialMessage.length > 5000 && (
                      <div className="text-xs text-ink-400 mt-2 text-center">
                        ... ({(partialMessage.length - 5000).toLocaleString()} more characters)
                      </div>
                    )}
                  </div>
                )}
                {showPartialMessage && !partialMessage && !streamingReasoning && !streamingToolCall && (
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
                    className={inputVariants({ size: 'md' }) + ' min-h-[24px] max-h-[200px] flex-1 resize-none bg-transparent py-1.5'}
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
                  />
                  {isStreaming ? (
                    <button
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors animate-pulse"
                      onClick={handleInterrupt}
                      title="Stop generating"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <rect x="6" y="6" width="12" height="12" fill="currentColor" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleInputSend}
                      disabled={!activeConversationId || !inputValue.trim() || isInterrupted}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path d="M3.4 20.6 21 12 3.4 3.4l2.8 7.2L16 12l-9.8 1.4-2.8 7.2Z" fill="currentColor" />
                      </svg>
                    </button>
                  )}
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
        </SplitPanePanel>

        {!focusMode && <SplitPaneDivider orientation="horizontal" />}

        {/* Right: Memory Panel */}
        {!focusMode && (
          <SplitPanePanel defaultSize={25} minSize={15} maxSize={40}>
            <AgentMemoryPanel agentId={agentId} />
          </SplitPanePanel>
        )}
      </SplitPaneGroup>

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

      {/* Tool approval dialog — agent wants to execute a local tool */}
      <ToolApprovalDialog
        request={latestPermissionRequest}
        onRespond={handlePermissionResponse}
      />

      {/* Save-diff preview */}
      {pendingChanges && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface shadow-xl border border-ink-900/10 flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 border-b border-ink-900/10">
              <h2 className="text-base font-semibold text-ink-900">Review changes</h2>
              <p className="text-xs text-ink-600 mt-1">
                {pendingChanges.diff.length} field{pendingChanges.diff.length !== 1 ? 's' : ''} will change on <span className="font-medium">{agent.name}</span>.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <div className="divide-y divide-ink-900/5">
                {pendingChanges.diff.map((entry, i) => (
                  <div key={i} className="py-2.5 grid grid-cols-[120px_1fr] gap-3 items-start">
                    <div className="text-xs font-medium text-ink-700 pt-0.5">{entry.label}</div>
                    <div className="flex flex-col gap-1 text-xs font-mono">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 text-red-500">−</span>
                        <span className="text-ink-600 line-through break-all">{String(entry.from)}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 text-green-600">+</span>
                        <span className="text-ink-900 break-all">{String(entry.to)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-ink-900/10 flex items-center justify-end gap-2">
              <button
                onClick={() => !savingConfig && setPendingChanges(null)}
                disabled={savingConfig}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-surface-tertiary text-ink-700 hover:bg-ink-900/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={applyPendingChanges}
                disabled={savingConfig}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {savingConfig ? 'Saving…' : `Apply ${pendingChanges.diff.length} change${pendingChanges.diff.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[AgentWorkspace] RENDER CRASH:', error);
    // Use setTimeout to avoid setState during render
    setTimeout(() => setRenderError(error), 0);
    // Return minimal safe UI while error state updates
    return (
      <div className="h-full flex items-center justify-center bg-surface-cream">
        <div className="text-red-600">UI crashed - see error display</div>
      </div>
    );
  }
}

// ═══ Config Form Helpers ═══

function ConfigField({ label, value, onChange, type = 'text', mono, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; mono?: boolean; hint?: string;
}) {
  return (
    <FormField label={label} helperText={hint}>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        size="sm"
        className={mono ? 'font-mono' : ''}
      />
    </FormField>
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
    <FormField label={label} layout="horizontal" className="items-center">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputVariants({ size: 'sm' })}
      >
        {options.map(o => <option key={o} value={o}>{o || '(default)'}</option>)}
      </select>
    </FormField>
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
