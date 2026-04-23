import { useEffect, useMemo } from "react";
import { useAppStore, type Agent, type MemoryBlock, type ToolAttachment } from "../store/useAppStore";
import { MemoryBlockList } from "./MemoryBlockList";
import { ToolAttachmentList } from "./ToolAttachmentList";
import { useMemorySync } from "../hooks/useMemorySync";

interface AgentDetailPanelProps {
  agentId?: string;
  className?: string;
}

// Mock agent data generator for development/fallback
function createMockAgent(id: string): Agent {
  return {
    id,
    name: "Letta Cowork Agent",
    model: "gpt-4o",
    systemMessage: "You are a helpful AI assistant that helps users with software development tasks. You have access to various tools for file operations, web browsing, and task management.",
    temperature: 0.7,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    memoryBlocks: [
      {
        id: "human-1",
        label: "Human",
        value: "Name: User\nRole: Developer",
        limit: 2000,
      },
      {
        id: "persona-1",
        label: "Persona",
        value: "I am a helpful coding assistant focused on software development tasks.",
        limit: 2000,
      },
      {
        id: "archival-1",
        label: "Archival Memory",
        value: "Previous sessions and learnings about user preferences.",
      },
    ],
    tools: [
      {
        id: "bash",
        name: "Bash",
        description: "Execute shell commands",
        enabled: true,
      },
      {
        id: "read",
        name: "Read",
        description: "Read file contents",
        enabled: true,
      },
      {
        id: "write",
        name: "Write",
        description: "Write or edit files",
        enabled: true,
      },
      {
        id: "glob",
        name: "Glob",
        description: "Search for files by pattern",
        enabled: true,
      },
      {
        id: "grep",
        name: "Grep",
        description: "Search text in files",
        enabled: true,
      },
      {
        id: "ask-user",
        name: "AskUserQuestion",
        description: "Ask the user for input",
        enabled: true,
      },
    ],
  };
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {icon && <div className="mt-0.5 shrink-0 text-ink-500">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-medium text-ink-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="text-accent">{icon}</div>
        <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
      </div>
      {action}
    </div>
  );
}

export function AgentDetailPanel({ agentId, className }: AgentDetailPanelProps) {
  const agents = useAppStore((state) => state.agents);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);
  const activeSession = useAppStore((state) => {
    const activeId = state.activeSessionId;
    return activeId ? state.sessions[activeId] : undefined;
  });

  // Determine which agent to display
  const effectiveAgentId = agentId ?? selectedAgentId ?? activeSession?.agentId;

  // Get agent from store or use mock data
  const agent: Agent | undefined = useMemo(() => {
    if (effectiveAgentId && agents[effectiveAgentId]) {
      return agents[effectiveAgentId];
    }
    // Return mock agent if we have an effective ID but no store data yet
    if (effectiveAgentId) {
      return createMockAgent(effectiveAgentId);
    }
    return undefined;
  }, [effectiveAgentId, agents]);

  // Sync agent selection with session
  useEffect(() => {
    if (activeSession?.agentId && !selectedAgentId) {
      setSelectedAgentId(activeSession.agentId);
    }
  }, [activeSession?.agentId, selectedAgentId, setSelectedAgentId]);

  // Real-time WebSocket sync for memory blocks
  useMemorySync(effectiveAgentId);

  const handleEditBlock = (block: MemoryBlock) => {
    // Placeholder for edit functionality (read-only mode for now)
    console.log("Edit block:", block);
  };

  const handleToggleTool = (toolId: string, enabled: boolean) => {
    // Placeholder for toggle functionality (read-only mode for now)
    console.log("Toggle tool:", toolId, enabled);
  };

  if (!agent) {
    return (
      <aside
        className={`fixed inset-y-0 right-0 flex h-full w-[350px] flex-col border-l border-border bg-sidebar ${className}`}
      >
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="rounded-2xl bg-surface-secondary p-4 mb-4">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-ink-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-ink-700">No agent selected</p>
          <p className="mt-1 text-xs text-muted">
            Start a session to view agent details
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`fixed inset-y-0 right-0 flex h-full w-[350px] flex-col border-l border-border bg-sidebar ${className}`}
    >
      {/* Header with agent name */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink-800 truncate">
              {agent.name}
            </h2>
            <p className="text-xs text-muted truncate">{agent.id.slice(0, 8)}...</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Metadata Section */}
        <section>
          <SectionHeader
            title="Agent Info"
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            }
          />
          <div className="rounded-xl border border-ink-900/5 bg-surface-secondary px-3 py-2">
            <InfoItem
              label="Model"
              value={agent.model}
              icon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              }
            />
            <div className="h-px bg-ink-900/5 mx-2" />
            <InfoItem
              label="Created"
              value={formatDate(agent.createdAt)}
              icon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              }
            />
            <div className="h-px bg-ink-900/5 mx-2" />
            <InfoItem
              label="Temperature"
              value={agent.temperature?.toString() ?? "0.7"}
              icon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Memory Section */}
        <section>
          <SectionHeader
            title="Memory"
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            }
            action={
              <span className="text-xs text-muted">{agent.memoryBlocks.length} blocks</span>
            }
          />
          <MemoryBlockList
            blocks={agent.memoryBlocks}
            readOnly={true}
            onEditBlock={handleEditBlock}
          />
        </section>

        {/* Tools Section */}
        <section>
          <SectionHeader
            title="Tools"
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            }
            action={
              <span className="text-xs text-muted">
                {agent.tools.filter((t: ToolAttachment) => t.enabled).length}/{agent.tools.length} active
              </span>
            }
          />
          <ToolAttachmentList
            tools={agent.tools}
            readOnly={true}
            onToggleTool={handleToggleTool}
          />
        </section>

        {/* Settings Section */}
        <section>
          <SectionHeader
            title="System Message"
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            }
          />
          <div className="rounded-xl border border-ink-900/5 bg-surface-secondary p-3">
            <p className="text-xs text-ink-600 leading-relaxed line-clamp-4">
              {agent.systemMessage || "No system message configured."}
            </p>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Agent ID: {agent.id.slice(0, 12)}...</span>
          <span>v0.16.7</span>
        </div>
      </div>
    </aside>
  );
}
