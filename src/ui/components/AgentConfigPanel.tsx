import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';

interface ToolAttachment {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

type TabId = 'settings' | 'system' | 'tools' | 'env';

interface AgentConfigPanelProps {
  agentId: string;
}

export function AgentConfigPanel({ agentId }: AgentConfigPanelProps) {
  // Store integration
  const agents = useAppStore((s) => s.agents);
  const toggleTool = useAppStore((s) => s.toggleTool);
  const updateAgent = useAppStore((s) => s.updateAgent);

  // Local state
  const [activeTab, setActiveTab] = useState<TabId>('settings');
  const [isEditingSystem, setIsEditingSystem] = useState(false);
  const [draftSystemMessage, setDraftSystemMessage] = useState('');
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);

  // Get current agent
  const agent = useMemo(() => agents[agentId], [agents, agentId]);

  // Initialize draft when entering edit mode
  const handleEnterEditMode = useCallback(() => {
    if (agent) {
      setDraftSystemMessage(agent.systemMessage || '');
      setIsEditingSystem(true);
      setSystemError(null);
    }
  }, [agent]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditingSystem(false);
    setDraftSystemMessage('');
    setSystemError(null);
  }, []);

  // Save system message (local only - API update TODO)
  const handleSaveSystem = useCallback(async () => {
    if (!agent) return;

    setIsSavingSystem(true);
    setSystemError(null);

    try {
      // For now, just update local state. Full API integration requires backend support
      await updateAgent(agentId, {
        systemMessage: draftSystemMessage,
        updatedAt: Date.now(),
      });
      setIsEditingSystem(false);
    } catch (err) {
      setSystemError(err instanceof Error ? err.message : 'Failed to save system message');
    } finally {
      setIsSavingSystem(false);
    }
  }, [agent, draftSystemMessage, updateAgent]);

  // Handle tool toggle
  const handleToolToggle = useCallback(async (toolId: string, currentEnabled: boolean) => {
    try {
      await toggleTool(agentId, toolId, !currentEnabled);
    } catch (err) {
      console.error('Failed to toggle tool:', err);
    }
  }, [agentId, toggleTool]);

  // If agent not found
  if (!agent) {
    return (
      <div className="bg-surface h-full flex items-center justify-center p-4">
        <p className="text-ink-600">Agent not found</p>
      </div>
    );
  }

  // Extract LLM config from raw data
  const llmConfig = agent.raw?.llm_config as Record<string, unknown> | undefined;
  const contextWindow = agent.raw?.context_window as number | undefined;
  const modelSettings = agent.raw?.model_settings as Record<string, unknown> | undefined;

  return (
    <div className="bg-surface h-full flex flex-col">
      {/* Tab Header */}
      <div className="border-b border-ink-900/10 flex">
        <TabButton
          id="settings"
          label="SETTINGS"
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        />
        <TabButton
          id="system"
          label="SYSTEM"
          active={activeTab === 'system'}
          onClick={() => setActiveTab('system')}
        />
        <TabButton
          id="tools"
          label="TOOLS"
          active={activeTab === 'tools'}
          onClick={() => setActiveTab('tools')}
        />
        <TabButton
          id="env"
          label="ENV"
          active={activeTab === 'env'}
          onClick={() => setActiveTab('env')}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'settings' && (
          <SettingsTab
            agent={agent}
            llmConfig={llmConfig}
            contextWindow={contextWindow}
            modelSettings={modelSettings}
          />
        )}

        {activeTab === 'system' && (
          <SystemTab
            systemMessage={agent.systemMessage}
            isEditing={isEditingSystem}
            draftMessage={draftSystemMessage}
            isSaving={isSavingSystem}
            error={systemError}
            onEnterEdit={handleEnterEditMode}
            onCancel={handleCancelEdit}
            onSave={handleSaveSystem}
            onDraftChange={setDraftSystemMessage}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsTab
            tools={agent.tools}
            onToggle={handleToolToggle}
          />
        )}

        {activeTab === 'env' && (
          <EnvTab agentId={agentId} />
        )}
      </div>
    </div>
  );
}

// Tab Button Component
interface TabButtonProps {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-3 text-sm font-medium transition-colors
        border-b-2
        ${active
          ? 'border-accent text-accent'
          : 'border-transparent text-ink-600 hover:text-ink-900'
        }
      `}
    >
      {label}
    </button>
  );
}

// Settings Tab Component
interface AgentData {
  name: string;
  description?: string;
  model: string;
  temperature?: number;
  raw?: Record<string, unknown>;
}

interface SettingsTabProps {
  agent: AgentData;
  llmConfig?: Record<string, unknown>;
  contextWindow?: number;
  modelSettings?: Record<string, unknown>;
}

function SettingsTab({ agent, llmConfig, contextWindow, modelSettings }: SettingsTabProps) {
  // Extract additional config values
  const temperature = agent.temperature ?? modelSettings?.temperature as number | undefined;
  const maxTokens = modelSettings?.max_tokens as number | undefined;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-ink-900 mb-4">Model Configuration</h3>

      {/* Model Name */}
      <ConfigCard label="Model">
        <p className="text-ink-900 font-medium text-sm break-all">{agent.model || 'Not set'}</p>
      </ConfigCard>

      {/* Temperature */}
      <ConfigCard label="Temperature">
        <p className="text-ink-900 text-sm">
          {temperature !== undefined ? temperature.toFixed(2) : 'Default'}
        </p>
        {temperature !== undefined && (
          <div className="mt-2 h-2 bg-ink-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.min((temperature / 2) * 100, 100)}%` }}
            />
          </div>
        )}
      </ConfigCard>

      {/* Context Window */}
      {contextWindow && (
        <ConfigCard label="Context Window">
          <p className="text-ink-900 text-sm">{contextWindow.toLocaleString()} tokens</p>
        </ConfigCard>
      )}

      {/* Max Tokens (if available) */}
      {maxTokens && (
        <ConfigCard label="Max Tokens">
          <p className="text-ink-900 text-sm">{maxTokens.toLocaleString()}</p>
        </ConfigCard>
      )}

      {/* Additional LLM Config */}
      {llmConfig && Object.keys(llmConfig).length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs font-medium text-ink-600 mb-2">Additional Configuration</h4>
          <pre className="bg-surface-secondary p-3 rounded-lg text-xs text-ink-700 overflow-x-auto border border-ink-900/5">
            {JSON.stringify(llmConfig, null, 2)}
          </pre>
        </div>
      )}

      {/* Agent Info */}
      <div className="mt-6 pt-4 border-t border-ink-900/10">
        <h4 className="text-xs font-medium text-ink-600 mb-2">Agent Info</h4>
        <p className="text-sm text-ink-700">
          <span className="font-medium">Name:</span> {agent.name}
        </p>
        {agent.description && (
          <p className="text-sm text-ink-700 mt-1">
            <span className="font-medium">Description:</span> {agent.description}
          </p>
        )}
      </div>
    </div>
  );
}

// Config Card Component
interface ConfigCardProps {
  label: string;
  children: React.ReactNode;
}

function ConfigCard({ label, children }: ConfigCardProps) {
  return (
    <div className="bg-surface-secondary rounded-lg p-3 border border-ink-900/5">
      <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  );
}

// System Tab Component
interface SystemTabProps {
  systemMessage?: string;
  isEditing: boolean;
  draftMessage: string;
  isSaving: boolean;
  error: string | null;
  onEnterEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDraftChange: (value: string) => void;
}

function SystemTab({
  systemMessage,
  isEditing,
  draftMessage,
  isSaving,
  error,
  onEnterEdit,
  onCancel,
  onSave,
  onDraftChange,
}: SystemTabProps) {
  if (!isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-900">System Prompt</h3>
          <button
            onClick={onEnterEdit}
            className="px-3 py-1.5 text-xs font-medium text-accent hover:text-accent-hover
                       border border-accent/30 rounded-lg hover:bg-accent/5 transition-colors"
          >
            Edit
          </button>
        </div>
        <div className="bg-surface-secondary rounded-lg p-4 border border-ink-900/5">
          <p className="text-ink-700 whitespace-pre-wrap font-mono text-xs">
            {systemMessage || <span className="text-ink-400 italic">No system prompt set</span>}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900">Edit System Prompt</h3>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium text-ink-600 hover:text-ink-900
                       border border-ink-300 rounded-lg hover:bg-ink-50 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover
                       rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
          >
            {isSaving && <LoadingSpinner size="sm" />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      <textarea
        value={draftMessage}
        onChange={(e) => onDraftChange(e.target.value)}
        disabled={isSaving}
        placeholder="Enter system prompt..."
        className="w-full h-64 p-4 bg-surface-secondary rounded-lg border border-ink-900/5
                   text-ink-900 font-mono text-xs resize-none
                   focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                   disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// Tools Tab Component
interface ToolsTabProps {
  tools: ToolAttachment[];
  onToggle: (toolId: string, currentEnabled: boolean) => void;
}

function ToolsTab({ tools, onToggle }: ToolsTabProps) {
  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <svg className="h-10 w-10 text-ink-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm text-ink-600">No tools configured for this agent</p>
        <p className="text-xs text-ink-400 mt-1">
          Tools can be attached from the agent settings
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-ink-900 mb-4">Tools ({tools.length})</h3>
      <div className="divide-y divide-ink-900/10">
        {tools.map((tool) => (
          <ToolRow
            key={tool.id}
            tool={tool}
            onToggle={() => onToggle(tool.id, tool.enabled)}
          />
        ))}
      </div>
    </div>
  );
}

// Tool Row Component
interface ToolRowProps {
  tool: ToolAttachment;
  onToggle: () => void;
}

function ToolRow({ tool, onToggle }: ToolRowProps) {
  return (
    <div className="py-3 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink-900 text-sm truncate">{tool.name}</p>
        {tool.description && (
          <p className="text-xs text-ink-500 truncate">{tool.description}</p>
        )}
      </div>
      <ToggleSwitch enabled={tool.enabled} onChange={onToggle} />
    </div>
  );
}

// Toggle Switch Component
interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
}

function ToggleSwitch({ enabled, onChange }: ToggleSwitchProps) {
  return (
    <button
      onClick={onChange}
      className={`
        relative inline-flex h-5 w-9 items-center rounded-full transition-colors
        focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1
        ${enabled ? 'bg-accent' : 'bg-ink-300'}
      `}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={`
          inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
          ${enabled ? 'translate-x-5' : 'translate-x-1'}
        `}
      />
    </button>
  );
}

// Loading Spinner Component
interface LoadingSpinnerProps {
  size?: 'sm' | 'md';
}

// Per-agent environment override. Writes to `agent.metadata` so the spawn
// path in main.ts can pick it up alongside the operator-level template.
// Only override when this agent's repo isn't under the operator's default
// org — most agents leave both fields empty and ride the operator template.
function EnvTab({ agentId }: { agentId: string }) {
  const agents = useAppStore((s) => s.agents);
  const updateAgent = useAppStore((s) => s.updateAgent);
  const agent = agents[agentId];
  const md = (agent?.raw as { metadata?: Record<string, unknown> } | undefined)?.metadata ?? {};
  const initialUrl = typeof md.letta_memfs_git_url === 'string' ? md.letta_memfs_git_url : '';
  const initialLocal = typeof md.letta_memfs_local === 'string' ? md.letta_memfs_local : '';

  const [url, setUrl] = useState(initialUrl);
  const [local, setLocal] = useState(initialLocal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = url !== initialUrl || local !== initialLocal;

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const nextMeta: Record<string, unknown> = { ...md };
      if (url.trim()) nextMeta.letta_memfs_git_url = url.trim();
      else delete nextMeta.letta_memfs_git_url;
      if (local.trim()) nextMeta.letta_memfs_local = local.trim();
      else delete nextMeta.letta_memfs_local;
      await updateAgent(agentId, { metadata: nextMeta });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">Per-agent environment</h3>
        <p className="mt-1 text-xs text-ink-500">
          Overrides the operator-level memfs template for this agent only. Leave blank
          to ride the operator default. Settings are stored in <code className="font-mono">agent.metadata</code>.
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-ink-700">LETTA_MEMFS_GIT_URL</span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="e.g. http://host:4455/Other/repo.git"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-ink-900/15 bg-surface text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
        <span className="mt-1 block text-[11px] text-ink-500">
          Use <code className="font-mono">{'{agentId}'}</code> in the operator template if you want it substituted; this per-agent field is a literal URL.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink-700">LETTA_MEMFS_LOCAL</span>
        <input
          type="text"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="(usually 1, blank to inherit)"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-ink-900/15 bg-surface text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
      </label>

      {error && <p className="text-xs text-error">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-xs text-green-600">Saved.</span>}
      </div>
    </div>
  );
}

function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  return (
    <svg
      className={`animate-spin ${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} text-current`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
