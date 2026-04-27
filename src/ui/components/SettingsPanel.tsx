import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { resetClient, systemApi, listLLMModels, listEmbeddingModels, providersApi, getApiBase, getApiKey, type ExternalMemfsStatus, type Provider } from '../services/api';
import { Tabs, TabsList, TabsTrigger } from './ui/layout/Tabs';
import { FormField } from './ui/composites/FormField';
import { Input } from './ui/primitives/Input';
import { Button } from './ui/primitives/Button';
import { Icon } from './ui/primitives/Icon';
import { Cog, FlaskConical, Puzzle, Terminal, Info, Check } from 'lucide-react';

const API_BASE_KEY = 'letta_api_url';
const API_KEY_STORAGE = 'letta_api_key';
const DEFAULT_LLM_KEY = 'letta_default_llm';
const DEFAULT_EMBEDDING_KEY = 'letta_default_embedding';
const EXTERNAL_MEMFS_KEY = 'letta_external_memfs_enabled';

type SettingsTab = 'general' | 'providers' | 'integrations' | 'advanced' | 'about';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: typeof Cog;
}

const TABS: TabConfig[] = [
  { id: 'general', label: 'General', icon: Cog },
  { id: 'providers', label: 'Providers', icon: FlaskConical },
  { id: 'integrations', label: 'Integrations', icon: Puzzle },
  { id: 'advanced', label: 'Advanced', icon: Terminal },
  { id: 'about', label: 'About', icon: Info },
];

/** Renders the whitelisted env snapshot from the main process. Secrets are
 *  represented as booleans (set / not set) — the actual key/token never
 *  crosses the IPC boundary. */
function LocalEnvTable() {
  const [env, setEnv] = useState<RuntimeEnv | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (typeof window === 'undefined' || !window.electron?.getRuntimeEnv) {
      setError('Local env snapshot is only available in the desktop app.');
      return;
    }
    window.electron.getRuntimeEnv()
      .then((e) => { if (!cancelled) setEnv(e); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <p className="text-sm text-ink-500 italic">{error}</p>;
  }
  if (!env) {
    return <p className="text-sm text-ink-500 italic">Loading…</p>;
  }

  const rows: Array<{ key: string; value: string; description: string }> = [
    { key: 'LETTA_BASE_URL', value: env.LETTA_BASE_URL || '(unset — defaults to https://api.letta.com)', description: 'Connected Letta server.' },
    { key: 'LETTA_API_KEY', value: env.apiKeySet ? '✓ set' : '(unset)', description: 'Required for cloud; optional for self-hosted.' },
    { key: 'LETTA_CODE_CLI_PATH', value: env.LETTA_CODE_CLI_PATH || '(unset — falls back to node_modules)', description: 'Custom letta-code build (memfs-enabled).' },
    { key: 'LETTA_MEMFS_LOCAL', value: env.LETTA_MEMFS_LOCAL || '(unset)', description: 'Set to 1 for local memfs mode.' },
    { key: 'LETTA_MEMFS_GIT_URL', value: env.LETTA_MEMFS_GIT_URL || '(unset)', description: 'External git host for memfs (rarely set globally — usually per-agent).' },
    { key: 'LETTA_MEMFS_GIT_TOKEN', value: env.memfsGitTokenSet ? '✓ set' : '(unset)', description: 'Token for the memfs git URL above.' },
  ];

  return (
    <div className="space-y-1 text-xs">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[12rem_1fr] gap-3 py-1 border-b border-ink-900/5 last:border-0">
          <code className="font-mono text-ink-700">{r.key}</code>
          <div className="min-w-0">
            <div className="font-mono text-ink-900 break-all">{r.value}</div>
            <div className="text-ink-500">{r.description}</div>
          </div>
        </div>
      ))}
      <div className="pt-2 text-ink-500">
        cwd: <code className="font-mono">{env.cwd}</code>
      </div>
    </div>
  );
}

/** Get human-readable label for memfs status summary */
function getMemfsStatusLabel(summary: ExternalMemfsStatus['summary']): string {
  switch (summary) {
    case 'core':
      return 'Core patches installed';
    case 'core_optional1':
      return 'Core + Optional Patch 1';
    case 'core_optional2':
      return 'Core + Optional Patch 2';
    case 'core_all':
      return 'Full installation (Core + All Optional)';
    case 'none':
    default:
      return 'Not detected';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function ServerConnectionSection() {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const serverConnected = useAppStore((s) => s.serverConnected);
  const setServerConnected = useAppStore((s) => s.setServerConnected);

  useEffect(() => {
    (async () => {
      const savedUrl = localStorage.getItem(API_BASE_KEY);
      const savedKey = localStorage.getItem(API_KEY_STORAGE) || '';
      if (typeof window !== 'undefined' && window.electron?.getConfig) {
        try {
          const cfg = await window.electron.getConfig();
          setApiUrl(savedUrl || cfg.serverUrl || '');
          setApiKey(savedKey || cfg.apiKey || '');
          return;
        } catch { /* fall through to localStorage */ }
      }
      setApiUrl(savedUrl || '');
      setApiKey(savedKey);
    })();
  }, []);

  const handleSave = async () => {
    localStorage.setItem(API_BASE_KEY, apiUrl);
    localStorage.setItem(API_KEY_STORAGE, apiKey);

    if (typeof window !== 'undefined' && window.electron?.saveConfig) {
      try {
        await window.electron.saveConfig({
          serverUrl: apiUrl || 'http://localhost:8283',
          apiKey: apiKey || undefined,
        });
      } catch (err) {
        console.error('[SettingsPanel] failed to sync config to electron:', err);
      }
    }

    setSaved(true);
    resetClient();
    await handleTest();
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const isBrowserDev = typeof window !== 'undefined' && !window.electron;
      const isUsingProxy = isBrowserDev && !localStorage.getItem(API_BASE_KEY);

      const testUrl = isUsingProxy
        ? '/v1/agents/'
        : `${apiUrl.replace(/\/$/, '')}/v1/agents/`;

      const res = await fetch(testUrl, {
        method: 'GET',
        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
      });

      if (res.ok || res.status === 200) {
        setServerConnected(true);
        setTestResult({ success: true, message: 'Connected to Letta server!' });
      } else {
        setServerConnected(false);
        setTestResult({ success: false, message: `Server returned ${res.status}` });
      }
    } catch (err) {
      setServerConnected(false);
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed'
      });
    }
  };

  return (
    <div className="space-y-4">
      <FormField
        label="Letta Server URL"
        htmlFor="api-url"
        helperText="Your Letta server address (e.g., http://10.10.20.19:8283)"
      >
        <Input
          id="api-url"
          type="url"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="http://localhost:8283"
          className="w-full"
        />
      </FormField>

      <FormField
        label="API Key (optional)"
        htmlFor="api-key"
        helperText="Required for cloud (letta.com), optional for local servers"
      >
        <Input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Leave empty if not required"
          className="w-full"
        />
      </FormField>

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handleSave}
          variant={saved ? 'secondary' : 'primary'}
          className={saved ? 'bg-green-500 hover:bg-green-500' : ''}
        >
          {saved ? (
            <>
              <Icon icon={Check} size="sm" className="mr-1.5" />
              Saved!
            </>
          ) : (
            'Save & Reload'
          )}
        </Button>
        <Button variant="secondary" onClick={handleTest}>
          Test Connection
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            localStorage.removeItem(API_BASE_KEY);
            localStorage.removeItem(API_KEY_STORAGE);
            setApiUrl('');
            setApiKey('');
            resetClient();
            setTestResult({ success: true, message: 'Reset to default (Vite proxy). Reloading...' });
            setTimeout(() => location.reload(), 1000);
          }}
        >
          Reset to Default
        </Button>
      </div>

      {testResult && (
        <div className={`text-sm px-3 py-2 rounded-lg ${
          testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {testResult.message}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        <span>Status:</span>
        <span className={`font-medium ${serverConnected ? 'text-green-600' : 'text-red-600'}`}>
          {serverConnected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>
    </div>
  );
}

function OperatorProfileSection() {
  const operatorProfile = useAppStore((s) => s.operatorProfile);
  const loadOperatorProfile = useAppStore((s) => s.loadOperatorProfile);
  const saveOperatorProfile = useAppStore((s) => s.saveOperatorProfile);

  const [displayName, setDisplayName] = useState('');
  const [urlTemplate, setUrlTemplate] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSet, setTokenSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (operatorProfile) {
      setDisplayName(operatorProfile.displayName);
      setUrlTemplate(operatorProfile.memfsGitUrlTemplate ?? '');
    }
  }, [operatorProfile]);

  useEffect(() => {
    let cancelled = false;
    if (typeof window !== 'undefined' && window.electron?.operatorSecrets) {
      window.electron.operatorSecrets.hasMemfsToken().then((set) => {
        if (!cancelled) setTokenSet(set);
      }).catch(() => { /* ignore */ });
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!operatorProfile) loadOperatorProfile();
  }, [operatorProfile, loadOperatorProfile]);

  const onSaveProfile = async () => {
    setSaving(true);
    setError(null);
    setSavedFlash(null);
    try {
      await saveOperatorProfile({
        displayName: displayName.trim(),
        memfsGitUrlTemplate: urlTemplate.trim() || undefined,
      });
      setSavedFlash('Profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onSetToken = async () => {
    if (!tokenInput.trim()) return;
    if (typeof window === 'undefined' || !window.electron?.operatorSecrets) return;
    try {
      await window.electron.operatorSecrets.setMemfsToken(tokenInput);
      setTokenSet(true);
      setTokenInput('');
      setSavedFlash('Token saved to keychain.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onClearToken = async () => {
    if (typeof window === 'undefined' || !window.electron?.operatorSecrets) return;
    try {
      await window.electron.operatorSecrets.clearMemfsToken();
      setTokenSet(false);
      setSavedFlash('Token cleared.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <FormField
        label="Display name"
        htmlFor="display-name"
        helperText="Surfaces in agent prompts and UI"
      >
        <Input
          id="display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Casey"
          className="w-full"
        />
      </FormField>

      <FormField
        label="Memfs git URL template"
        htmlFor="git-template"
        helperText={`${'{agentId}'} is replaced at spawn time. The token is prefixed automatically.`}
      >
        <Input
          id="git-template"
          type="text"
          value={urlTemplate}
          onChange={(e) => setUrlTemplate(e.target.value)}
          placeholder="http://10.10.20.120:4455/Fimeg/{agentId}.git"
          className="w-full font-mono"
        />
      </FormField>

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={onSaveProfile}
          disabled={saving || !displayName.trim()}
          isLoading={saving}
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </Button>
      </div>

      <div className="border-t border-ink-900/10 pt-4">
        <FormField
          label="Memfs git token"
          htmlFor="memfs-token"
          helperText={`Stored in the OS keychain. Status: ${tokenSet ? 'Set' : 'Not set'}`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              id="memfs-token"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste new token to set/replace"
              className="flex-1 min-w-[200px] font-mono"
            />
            <Button
              onClick={onSetToken}
              disabled={!tokenInput.trim()}
              size="sm"
            >
              Set
            </Button>
            {tokenSet && (
              <Button
                variant="secondary"
                onClick={onClearToken}
                size="sm"
              >
                Clear
              </Button>
            )}
          </div>
        </FormField>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}
      {savedFlash && !error && <p className="text-sm text-green-600">{savedFlash}</p>}
    </div>
  );
}

function ModelDefaultsSection() {
  const serverConnected = useAppStore((s) => s.serverConnected);

  type LlmEntry = { id: string; name: string; provider: string; contextWindow?: number };
  type EmbeddingEntry = { id: string; name: string; provider: string; dimensions?: number };
  const [llmModels, setLlmModels] = useState<LlmEntry[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<EmbeddingEntry[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [defaultLlm, setDefaultLlm] = useState<string>(() => localStorage.getItem(DEFAULT_LLM_KEY) ?? '');
  const [defaultEmbedding, setDefaultEmbedding] = useState<string>(() => localStorage.getItem(DEFAULT_EMBEDDING_KEY) ?? '');

  const refreshModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const [llms, embeddings] = await Promise.all([
        listLLMModels(),
        listEmbeddingModels(),
      ]);
      setLlmModels(llms);
      setEmbeddingModels(embeddings);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (serverConnected) refreshModels();
  }, [refreshModels, serverConnected]);

  const handleSelectDefaultLlm = (id: string) => {
    setDefaultLlm(id);
    if (id) localStorage.setItem(DEFAULT_LLM_KEY, id);
    else localStorage.removeItem(DEFAULT_LLM_KEY);
  };

  const handleSelectDefaultEmbedding = (id: string) => {
    setDefaultEmbedding(id);
    if (id) localStorage.setItem(DEFAULT_EMBEDDING_KEY, id);
    else localStorage.removeItem(DEFAULT_EMBEDDING_KEY);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-600">Default models for new agents</p>
        <Button
          variant="secondary"
          onClick={refreshModels}
          disabled={modelsLoading || !serverConnected}
          isLoading={modelsLoading}
          size="sm"
        >
          {modelsLoading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {!serverConnected ? (
        <p className="text-sm text-ink-500 italic">Connect to a server to list available models.</p>
      ) : modelsError ? (
        <p className="text-sm text-red-600">{modelsError}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">
              Default LLM
            </label>
            <select
              value={defaultLlm}
              onChange={(e) => handleSelectDefaultLlm(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="">— No default (let server pick) —</option>
              {llmModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.provider}
                  {m.contextWindow ? ` · ${(m.contextWindow / 1000).toFixed(0)}k ctx` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-500 mt-1">
              {llmModels.length} model{llmModels.length === 1 ? '' : 's'} available
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">
              Default Embedding Model
            </label>
            <select
              value={defaultEmbedding}
              onChange={(e) => handleSelectDefaultEmbedding(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="">— No default —</option>
              {embeddingModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.provider}
                  {m.dimensions ? ` · ${m.dimensions}d` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-500 mt-1">
              Required for archival memory. {embeddingModels.length} available.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const PROVIDER_TYPES: { value: string; label: string; description: string; needsBaseUrl?: boolean }[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)', description: 'Claude API via Anthropic' },
  { value: 'openai', label: 'OpenAI', description: 'GPT models via OpenAI API' },
  { value: 'azure', label: 'Azure OpenAI', description: 'Azure-hosted OpenAI models', needsBaseUrl: true },
  { value: 'bedrock', label: 'AWS Bedrock', description: 'Claude via AWS Bedrock', needsBaseUrl: true },
  { value: 'fireworks', label: 'Fireworks AI', description: 'Fast inference API' },
  { value: 'groq', label: 'Groq', description: 'Ultra-fast LLM inference' },
  { value: 'together', label: 'Together AI', description: 'Open models inference' },
  { value: 'deepseek', label: 'DeepSeek', description: 'DeepSeek models' },
  { value: 'xai', label: 'xAI (Grok)', description: 'Grok models via xAI' },
  { value: 'google_ai', label: 'Google AI (Gemini)', description: 'Gemini models' },
  { value: 'google_vertex', label: 'Google Vertex AI', description: 'Enterprise Google AI', needsBaseUrl: true },
  { value: 'ollama', label: 'Ollama (Local)', description: 'Local models via Ollama', needsBaseUrl: true },
  { value: 'vllm', label: 'vLLM (Local)', description: 'Local vLLM server', needsBaseUrl: true },
];

interface ProviderFormData {
  name: string;
  provider_type: string;
  api_key: string;
  base_url: string;
}

function ProviderModal({
  isOpen,
  onClose,
  onSave,
  provider,
  mode,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ProviderFormData) => Promise<void>;
  provider?: Provider;
  mode: 'create' | 'edit';
}) {
  const [formData, setFormData] = useState<ProviderFormData>({
    name: '',
    provider_type: 'anthropic',
    api_key: '',
    base_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (provider && mode === 'edit') {
      setFormData({
        name: provider.name,
        provider_type: provider.provider_type,
        api_key: '', // Don't show existing key
        base_url: provider.base_url || '',
      });
    } else {
      setFormData({
        name: '',
        provider_type: 'anthropic',
        api_key: '',
        base_url: '',
      });
    }
    setError(null);
  }, [provider, mode, isOpen]);

  if (!isOpen) return null;

  const selectedType = PROVIDER_TYPES.find(t => t.value === formData.provider_type);
  const needsBaseUrl = selectedType?.needsBaseUrl ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-ink-900">
              {mode === 'create' ? 'Add BYOK Provider' : 'Edit Provider'}
            </h3>
            <button
              onClick={onClose}
              className="text-ink-500 hover:text-ink-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">
                Provider Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., My Anthropic Key"
                className="w-full px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
              <p className="text-xs text-ink-500 mt-1">A friendly name to identify this provider</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">
                Provider Type
              </label>
              <select
                value={formData.provider_type}
                onChange={(e) => setFormData({ ...formData, provider_type: e.target.value })}
                className="w-full px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                disabled={mode === 'edit'}
              >
                {PROVIDER_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-500 mt-1">{selectedType?.description}</p>
            </div>

            {needsBaseUrl && (
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  Base URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  placeholder={formData.provider_type === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
                  className="w-full px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <p className="text-xs text-ink-500 mt-1">Custom endpoint URL for this provider</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">
                API Key {mode === 'edit' && <span className="text-ink-400 font-normal">(leave blank to keep current)</span>}
              </label>
              <input
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder={mode === 'edit' ? '••••••••' : 'sk-...'}
                className="w-full px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
                required={mode === 'create'}
              />
              <p className="text-xs text-ink-500 mt-1">
                Your API key is encrypted server-side and never stored locally
              </p>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <button
                type="submit"
                disabled={saving || !formData.name.trim() || (mode === 'create' && !formData.api_key.trim())}
                className="flex-1 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : mode === 'create' ? 'Add Provider' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 border border-ink-300 text-ink-700 rounded-lg text-sm font-medium hover:bg-ink-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  providerName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  providerName: string;
}) {
  const [deleting, setDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-ink-900">Delete Provider?</h3>
        </div>

        <p className="text-sm text-ink-600 mb-6">
          Are you sure you want to delete <strong>{providerName}</strong>? Agents using this provider will no longer be able to generate responses. This action cannot be undone.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete Provider'}
          </button>
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 border border-ink-300 text-ink-700 rounded-lg text-sm font-medium hover:bg-ink-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ProvidersSection() {
  const serverConnected = useAppStore((s) => s.serverConnected);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | undefined>();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingProvider, setDeletingProvider] = useState<Provider | undefined>();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const baseProviders = useMemo(() => providers.filter(p => p.provider_category === 'base'), [providers]);
  const byokProviders = useMemo(() => providers.filter(p => p.provider_category === 'byok'), [providers]);

  const loadProviders = useCallback(async () => {
    if (!serverConnected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await providersApi.listProviders();
      setProviders(data);
    } catch (err) {
      console.error('Failed to load providers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, [serverConnected]);

  const refreshProvider = async (providerId: string) => {
    setRefreshingId(providerId);
    try {
      const updated = await providersApi.refreshProvider(providerId);
      setProviders(prev => prev.map(p => p.id === providerId ? updated : p));
    } catch (err) {
      console.error(`Failed to refresh provider ${providerId}:`, err);
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshingId(null);
    }
  };

  const createProvider = async (formData: ProviderFormData) => {
    const apiKey = getApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(`${getApiBase().replace(/\/$/, '')}/v1/providers/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        name: formData.name.trim(),
        provider_type: formData.provider_type,
        api_key: formData.api_key,
        ...(formData.base_url && { base_url: formData.base_url }),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Server returned ${response.status}`);
    }

    const newProvider = await response.json() as Provider;
    setProviders(prev => [...prev, newProvider]);
  };

  const updateProvider = async (formData: ProviderFormData) => {
    if (!editingProvider) return;

    const apiKey = getApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const body: Record<string, string> = {
      name: formData.name.trim(),
    };
    if (formData.api_key.trim()) {
      body.api_key = formData.api_key;
    }
    if (formData.base_url) {
      body.base_url = formData.base_url;
    }

    const response = await fetch(`${getApiBase().replace(/\/$/, '')}/v1/providers/${editingProvider.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Server returned ${response.status}`);
    }

    const updated = await response.json() as Provider;
    setProviders(prev => prev.map(p => p.id === editingProvider.id ? updated : p));
  };

  const deleteProvider = async () => {
    if (!deletingProvider) return;
    await providersApi.deleteProvider(deletingProvider.id);
    setProviders(prev => prev.filter(p => p.id !== deletingProvider.id));
  };

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const formatLastSynced = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Modals */}
      <ProviderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={createProvider}
        mode="create"
      />
      <ProviderModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProvider(undefined);
        }}
        onSave={updateProvider}
        provider={editingProvider}
        mode="edit"
      />
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingProvider(undefined);
        }}
        onConfirm={deleteProvider}
        providerName={deletingProvider?.name || ''}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-600">
          Manage AI model providers. <strong>Base</strong> providers are hosted by Letta.
          <strong> BYOK</strong> (Bring Your Own Key) providers use your API credentials.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!serverConnected || loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Provider
            </span>
          </button>
          <button
            onClick={loadProviders}
            disabled={loading || !serverConnected}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-ink-300 text-ink-600 hover:bg-ink-50 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {!serverConnected ? (
        <p className="text-sm text-ink-500 italic">Connect to a server to manage providers.</p>
      ) : providers.length === 0 && !loading ? (
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800">
            No providers configured yet. Click "Add Provider" to connect your first BYOK provider.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* BYOK Providers */}
          {byokProviders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                BYOK Providers ({byokProviders.length})
              </h3>
              <div className="space-y-2">
                {byokProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between p-3 bg-surface border border-ink-900/10 rounded-lg group hover:border-ink-900/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink-900">{provider.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {provider.provider_type}
                        </span>
                      </div>
                      <div className="text-xs text-ink-500 mt-1">
                        Last synced: {formatLastSynced(provider.last_synced)}
                        {provider.base_url && (
                          <span className="ml-2 font-mono text-ink-400">{provider.base_url}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => refreshProvider(provider.id)}
                        disabled={refreshingId === provider.id}
                        className="px-2 py-1 rounded text-xs font-medium text-ink-600 hover:bg-ink-50 transition-colors disabled:opacity-50"
                        title="Refresh model list from provider"
                      >
                        {refreshingId === provider.id ? '…' : 'Refresh'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingProvider(provider);
                          setIsEditModalOpen(true);
                        }}
                        className="p-1.5 rounded text-ink-600 hover:bg-ink-50 transition-colors"
                        title="Edit provider"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setDeletingProvider(provider);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete provider"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Base Providers */}
          {baseProviders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Base Providers ({baseProviders.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {baseProviders.map((provider) => (
                  <span
                    key={provider.id}
                    className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium border border-green-100"
                  >
                    {provider.name}
                    <span className="ml-1.5 text-green-600/70 text-xs">{provider.provider_type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IntegrationsSection() {
  const serverConnected = useAppStore((s) => s.serverConnected);
  const [externalMemfsStatus, setExternalMemfsStatus] = useState<{
    checking: boolean;
    serverStatus: ExternalMemfsStatus | null;
    localEnabled: boolean;
    detected: boolean;
    summary: ExternalMemfsStatus['summary'];
    error?: string;
  }>({
    checking: true,
    serverStatus: null,
    localEnabled: false,
    detected: false,
    summary: 'none',
  });

  const detectExternalMemfs = useCallback(async () => {
    setExternalMemfsStatus(prev => ({ ...prev, checking: true, error: undefined }));

    try {
      let localEnabled = false;
      if (typeof window !== 'undefined' && window.electron?.getConfig) {
        const cfg = await window.electron.getConfig();
        localEnabled = cfg.externalMemfsEnabled ?? false;
      }
      if (!localEnabled) {
        localEnabled = localStorage.getItem(EXTERNAL_MEMFS_KEY) === 'true';
      }

      let serverStatus: ExternalMemfsStatus | null = null;
      try {
        serverStatus = await systemApi.detectExternalMemfs();
      } catch (err) {
        console.warn('[SettingsPanel] Server memfs detection failed:', err);
      }

      const detected = serverStatus?.available ?? localEnabled;
      const summary = serverStatus?.summary ?? (localEnabled ? 'core' : 'none');

      setExternalMemfsStatus({
        checking: false,
        serverStatus,
        localEnabled,
        detected,
        summary,
        error: serverStatus?.error,
      });
    } catch (err) {
      setExternalMemfsStatus(prev => ({
        ...prev,
        checking: false,
        detected: prev.localEnabled,
        summary: prev.localEnabled ? 'core' : 'none',
        error: err instanceof Error ? err.message : 'Detection failed',
      }));
    }
  }, []);

  useEffect(() => {
    detectExternalMemfs();
  }, [detectExternalMemfs, serverConnected]);

  const enableExternalMemfs = async () => {
    try {
      localStorage.setItem(EXTERNAL_MEMFS_KEY, 'true');
      if (typeof window !== 'undefined' && window.electron?.saveConfig) {
        await window.electron.saveConfig({ externalMemfsEnabled: true });
      }
      setExternalMemfsStatus(prev => ({
        ...prev,
        detected: true,
        localEnabled: true,
        summary: prev.serverStatus?.summary || 'core',
      }));
    } catch (err) {
      console.error('[SettingsPanel] Failed to enable external memfs:', err);
    }
  };

  const disableExternalMemfs = async () => {
    try {
      localStorage.removeItem(EXTERNAL_MEMFS_KEY);
      if (typeof window !== 'undefined' && window.electron?.saveConfig) {
        await window.electron.saveConfig({ externalMemfsEnabled: false });
      }
      setExternalMemfsStatus(prev => ({
        ...prev,
        detected: false,
        localEnabled: false,
        summary: 'none',
      }));
    } catch (err) {
      console.error('[SettingsPanel] Failed to disable external memfs:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-ink-900/10 rounded-lg p-4 bg-surface">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              externalMemfsStatus.detected
                ? 'bg-green-100 text-green-600'
                : externalMemfsStatus.checking
                ? 'bg-amber-100 text-amber-600'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {externalMemfsStatus.detected ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : externalMemfsStatus.checking ? (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-medium text-ink-900">External Memfs</h3>
              <p className="text-xs text-ink-500">
                {externalMemfsStatus.checking
                  ? 'Checking server capabilities...'
                  : externalMemfsStatus.detected
                  ? getMemfsStatusLabel(externalMemfsStatus.summary)
                  : serverConnected
                  ? 'Not detected on server'
                  : 'Connect to server to detect external memfs'}
              </p>
            </div>
          </div>

          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            externalMemfsStatus.detected
              ? 'bg-green-100 text-green-700'
              : externalMemfsStatus.checking
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {externalMemfsStatus.detected
              ? externalMemfsStatus.summary === 'core'
                ? 'Core'
                : externalMemfsStatus.summary === 'core_all'
                ? 'Full'
                : 'Partial'
              : externalMemfsStatus.checking
              ? 'Checking...'
              : 'Missing'}
          </span>
        </div>

        <p className="text-sm text-ink-600 mb-4 leading-relaxed">
          External memfs provides a memory-backed filesystem for agents, allowing them to read,
          write, and manage files in an isolated in-memory environment. This is especially useful
          for self-hosted deployments where you want agents to have filesystem capabilities
          without persisting to disk.
        </p>

        {externalMemfsStatus.detected && externalMemfsStatus.serverStatus && (
          <div className="mb-4 p-3 bg-green-50/50 rounded-lg border border-green-100">
            <div className="text-xs text-ink-600 space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${externalMemfsStatus.serverStatus.patches.core ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>Core patches {externalMemfsStatus.serverStatus.patches.core ? 'installed' : 'missing'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  !externalMemfsStatus.serverStatus.optionalsKnown
                    ? 'bg-amber-300'
                    : externalMemfsStatus.serverStatus.patches.optional1 ? 'bg-green-500' : 'bg-gray-300'
                }`} />
                <span>
                  Optional: delete-propagation{' '}
                  {!externalMemfsStatus.serverStatus.optionalsKnown
                    ? '(unknown — no health endpoint)'
                    : externalMemfsStatus.serverStatus.patches.optional1
                      ? 'installed'
                      : 'not installed'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  !externalMemfsStatus.serverStatus.optionalsKnown
                    ? 'bg-amber-300'
                    : externalMemfsStatus.serverStatus.patches.optional2 ? 'bg-green-500' : 'bg-gray-300'
                }`} />
                <span>
                  Optional: system-only-blocks{' '}
                  {!externalMemfsStatus.serverStatus.optionalsKnown
                    ? '(unknown — no health endpoint)'
                    : externalMemfsStatus.serverStatus.patches.optional2
                      ? 'installed'
                      : 'not installed'}
                </span>
              </div>
            </div>
            {externalMemfsStatus.serverStatus.serverVersion && (
              <div className="mt-2 text-xs text-ink-500 pt-2 border-t border-green-100">
                Server version: {externalMemfsStatus.serverStatus.serverVersion}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {serverConnected && (
            <button
              onClick={detectExternalMemfs}
              disabled={externalMemfsStatus.checking}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-ink-300 text-ink-600 hover:bg-ink-50 transition-colors disabled:opacity-50"
            >
              {externalMemfsStatus.checking ? 'Checking...' : 'Check Again'}
            </button>
          )}

          {externalMemfsStatus.detected ? (
            <>
              <button
                onClick={disableExternalMemfs}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-ink-300 text-ink-600 hover:bg-ink-50 transition-colors"
              >
                Disable
              </button>
              <span className="text-xs text-green-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Ready for use with agents
              </span>
            </>
          ) : !externalMemfsStatus.checking && (
            <>
              <button
                onClick={enableExternalMemfs}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Install / Enable
              </button>
              <a
                href="https://github.com/letta-ai/letta-external-memfs"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg text-sm font-medium border border-ink-300 text-ink-600 hover:bg-ink-50 transition-colors inline-flex items-center gap-1"
              >
                Learn more
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </>
          )}
        </div>

        {externalMemfsStatus.error && (
          <div className="mt-3 text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200">
            Error: {externalMemfsStatus.error}
          </div>
        )}
      </div>
    </div>
  );
}

function AdvancedSection() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        Effective values read from this app's <code className="px-1 bg-ink-900/5 rounded">.env</code> /
        shell environment. To change them, edit the project <code className="px-1 bg-ink-900/5 rounded">.env</code>
        file and restart the app — Electron loads them at startup.
      </p>
      <LocalEnvTable />
    </div>
  );
}

function AboutSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-ink-900">Letta Community ADE</h3>
          <p className="text-sm text-ink-500">Version 0.1.0</p>
        </div>
      </div>

      <div className="text-sm text-ink-600 space-y-2">
        <p>
          A desktop environment for building and working with AI agents.
          Built on the Letta platform.
        </p>
        <div className="flex items-center gap-4 pt-2">
          <a
            href="https://docs.letta.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline inline-flex items-center gap-1"
          >
            Documentation
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a
            href="https://github.com/letta-ai/letta-oss-ui"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline inline-flex items-center gap-1"
          >
            GitHub
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <section className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6">
              <h2 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
                Server Connection
              </h2>
              <ServerConnectionSection />
            </section>

            <section className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6">
              <h2 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Operator Profile
              </h2>
              <OperatorProfileSection />
            </section>

            <section className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6">
              <h2 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Model Defaults
              </h2>
              <ModelDefaultsSection />
            </section>
          </div>
        );
      case 'providers':
        return (
          <section className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6">
            <h2 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              AI Providers
            </h2>
            <ProvidersSection />
          </section>
        );
      case 'integrations':
        return (
          <section className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6">
            <h2 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              </svg>
              External Integrations
            </h2>
            <IntegrationsSection />
          </section>
        );
      case 'advanced':
        return (
          <section className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6">
            <h2 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Local Environment
            </h2>
            <AdvancedSection />
          </section>
        );
      case 'about':
        return (
          <section className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6">
            <h2 className="text-sm font-semibold text-ink-900 mb-4">About</h2>
            <AboutSection />
          </section>
        );
    }
  };

  return (
    <div className="h-full bg-surface flex">
      {/* Sidebar with Tabs */}
      <div className="w-56 border-r border-ink-900/10 bg-surface-secondary/50 flex flex-col">
        <div className="p-4 border-b border-ink-900/10">
          <h1 className="font-semibold text-ink-900">Settings</h1>
        </div>
        <div className="flex-1 py-2">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as SettingsTab)}
            orientation="vertical"
            variant="pill"
          >
            <TabsList className="flex-col gap-1 px-2">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="w-full justify-start gap-3">
                  <Icon icon={tab.icon} size="sm" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
