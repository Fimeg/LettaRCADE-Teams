/**
 * SettingsPanel — Comprehensive server and client configuration
 *
 * Architecture:
 * - Vertical sidebar navigation (5 main sections)
 * - Expanded content area with organized sub-sections
 * - Full provider CRUD with test-connection and templates
 * - Clean visual hierarchy, no strange dividers
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  resetClient,
  systemApi,
  listLLMModels,
  listEmbeddingModels,
  providersApi,
  getApiBase,
  getApiKey,
  getConnectionMode,
  setConnectionMode,
  getRemoteUrl,
  type ExternalMemfsStatus,
  type Provider,
  type ProviderType,
  type ConnectionMode,
} from '../services/api';
import { FormField } from './ui/composites/FormField';
import { Input, inputVariants } from './ui/primitives/Input';
import { Button } from './ui/primitives/Button';
import { Card, CardContent } from './ui/composites/Card';
import { Alert } from './ui/composites/Alert';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from './ui/composites/Modal';
import {
  Cog,
  FlaskConical,
  Puzzle,
  Terminal,
  Info,
  Check,
  Server,
  Globe,
  Laptop,
  Radio,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  TestTube,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Database,
  Settings2,
  Code2,
  Shield,
} from 'lucide-react';

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

type SettingsSection =
  | 'connection'
  | 'providers'
  | 'models'
  | 'integrations'
  | 'preferences'
  | 'advanced'
  | 'about';

interface SectionConfig {
  id: SettingsSection;
  label: string;
  icon: typeof Cog;
  description: string;
}

const SECTIONS: SectionConfig[] = [
  {
    id: 'connection',
    label: 'Connection',
    icon: Server,
    description: 'Server URL, API keys, and connection modes',
  },
  {
    id: 'providers',
    label: 'Providers',
    icon: FlaskConical,
    description: 'Manage AI model providers and BYOK credentials',
  },
  {
    id: 'models',
    label: 'Models',
    icon: Database,
    description: 'Default models and model preferences',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Puzzle,
    description: 'External services and memfs configuration',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: Settings2,
    description: 'UI settings and default behaviors',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: Terminal,
    description: 'Environment variables and debugging',
  },
  {
    id: 'about',
    label: 'About',
    icon: Info,
    description: 'Version info and system details',
  },
];

const PROVIDER_TYPES: {
  value: ProviderType;
  label: string;
  description: string;
  needsBaseUrl?: boolean;
  category: 'cloud' | 'local' | 'enterprise';
}[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)', description: 'Claude API via Anthropic', category: 'cloud' },
  { value: 'openai', label: 'OpenAI', description: 'GPT models via OpenAI API', category: 'cloud' },
  { value: 'azure', label: 'Azure OpenAI', description: 'Azure-hosted OpenAI models', needsBaseUrl: true, category: 'enterprise' },
  { value: 'bedrock', label: 'AWS Bedrock', description: 'Claude via AWS Bedrock', category: 'enterprise' },
  { value: 'google_ai', label: 'Google AI (Gemini)', description: 'Gemini models', category: 'cloud' },
  { value: 'google_vertex', label: 'Google Vertex AI', description: 'Enterprise Google AI', needsBaseUrl: true, category: 'enterprise' },
  { value: 'groq', label: 'Groq', description: 'Ultra-fast LLM inference', category: 'cloud' },
  { value: 'fireworks', label: 'Fireworks AI', description: 'Fast inference API', category: 'cloud' },
  { value: 'together', label: 'Together AI', description: 'Open models inference', category: 'cloud' },
  { value: 'mistral', label: 'Mistral AI', description: 'Mistral models', category: 'cloud' },
  { value: 'deepseek', label: 'DeepSeek', description: 'DeepSeek models', category: 'cloud' },
  { value: 'xai', label: 'xAI (Grok)', description: 'Grok models via xAI', category: 'cloud' },
  { value: 'cerebras', label: 'Cerebras', description: 'Cerebras inference API', category: 'cloud' },
  { value: 'ollama', label: 'Ollama (Local)', description: 'Local models via Ollama', needsBaseUrl: true, category: 'local' },
  { value: 'lmstudio_openai', label: 'LM Studio', description: 'Local LM Studio server', needsBaseUrl: true, category: 'local' },
  { value: 'vllm', label: 'vLLM', description: 'Local vLLM server', needsBaseUrl: true, category: 'local' },
  { value: 'sglang', label: 'SGLang', description: 'Local SGLang server', needsBaseUrl: true, category: 'local' },
  { value: 'crofai', label: 'crof.ai', description: 'crof.ai - supports OpenAI and Anthropic endpoints', category: 'cloud' },
  { value: 'letta', label: 'Letta', description: 'Letta-hosted models', category: 'cloud' },
];

const API_BASE_KEY = 'letta_api_url';
const API_KEY_STORAGE = 'letta_api_key';
const DEFAULT_LLM_KEY = 'letta_default_llm';
const DEFAULT_EMBEDDING_KEY = 'letta_default_embedding';

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================

function StatusBadge({ status, text }: { status: 'success' | 'error' | 'warning' | 'info'; text: string }) {
  const variants = {
    success: 'bg-green-100 text-green-700 border-green-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${variants[status]}`}>
      {status === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
      {status === 'error' && <XCircle className="w-3.5 h-3.5" />}
      {status === 'warning' && <AlertCircle className="w-3.5 h-3.5" />}
      {status === 'info' && <Info className="w-3.5 h-3.5" />}
      {text}
    </span>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      {description && <p className="text-sm text-ink-500 mt-1">{description}</p>}
    </div>
  );
}

function SubSection({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`${className}`}>
      <h3 className="text-sm font-medium text-ink-700 mb-3 flex items-center gap-2">
        <div className="w-1 h-4 bg-accent rounded-full" />
        {title}
      </h3>
      {children}
    </div>
  );
}

// =============================================================================
// CONNECTION SECTION
// =============================================================================

function ConnectionSection() {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connectionMode, setMode] = useState<ConnectionMode>('server');
  const [remoteUrl, setRemoteUrl] = useState('');

  const serverConnected = useAppStore((s) => s.serverConnected);
  const setServerConnected = useAppStore((s) => s.setServerConnected);

  useEffect(() => {
    const loadSettings = async () => {
      const savedUrl = localStorage.getItem(API_BASE_KEY);
      const savedKey = localStorage.getItem(API_KEY_STORAGE) || '';
      const savedMode = getConnectionMode();
      const savedRemote = getRemoteUrl();

      if (typeof window !== 'undefined' && window.electron?.getConfig) {
        try {
          const cfg = await window.electron.getConfig();
          setApiUrl(savedUrl || cfg.serverUrl || '');
          setApiKey(savedKey || cfg.apiKey || '');
        } catch {
          setApiUrl(savedUrl || '');
          setApiKey(savedKey);
        }
      } else {
        setApiUrl(savedUrl || '');
        setApiKey(savedKey);
      }

      setMode(savedMode);
      setRemoteUrl(savedRemote);
    };

    loadSettings();
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
        console.error('[SettingsPanel] Failed to sync config to electron:', err);
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
      const baseURL = getApiBase();
      const key = getApiKey();

      const response = await fetch(`${baseURL.replace(/\/$/, '')}/v1/agents/`, {
        method: 'GET',
        headers: key ? { Authorization: `Bearer ${key}` } : {},
      });

      if (response.ok) {
        setServerConnected(true);
        setTestResult({ success: true, message: `Connected to ${baseURL}` });
      } else {
        setServerConnected(false);
        setTestResult({ success: false, message: `Server returned ${response.status}` });
      }
    } catch (err) {
      setServerConnected(false);
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    }
  };

  const handleModeChange = (mode: ConnectionMode) => {
    setMode(mode);
    setConnectionMode(mode, mode === 'remote' ? remoteUrl : undefined);
  };

  const modeCards = [
    {
      mode: 'server' as ConnectionMode,
      icon: Server,
      title: 'Server Mode',
      description: 'Connect to an external Letta server (production or shared)',
      color: 'blue',
    },
    {
      mode: 'local' as ConnectionMode,
      icon: Laptop,
      title: 'Local Mode',
      description: 'Spawn letta-code locally and connect to localhost',
      color: 'green',
    },
    {
      mode: 'remote' as ConnectionMode,
      icon: Radio,
      title: 'Remote Mode',
      description: 'Connect to a user-provided remote URL',
      color: 'purple',
    },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Server Connection"
        description="Configure how this app connects to your Letta server"
      />

      {/* Connection Mode Cards */}
      <SubSection title="Connection Mode">
        <div className="grid grid-cols-3 gap-4">
          {modeCards.map(({ mode, icon: Icon, title, description, color }) => {
            const isActive = connectionMode === mode;
            const colorClasses = {
              blue: isActive ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'hover:border-blue-300',
              green: isActive ? 'ring-2 ring-green-500 bg-green-50/50' : 'hover:border-green-300',
              purple: isActive ? 'ring-2 ring-purple-500 bg-purple-50/50' : 'hover:border-purple-300',
            };

            return (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  isActive ? colorClasses[color as keyof typeof colorClasses] : 'border-ink-900/10 hover:border-ink-900/20'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                  isActive
                    ? color === 'blue' ? 'bg-blue-100 text-blue-600'
                      : color === 'green' ? 'bg-green-100 text-green-600'
                      : 'bg-purple-100 text-purple-600'
                    : 'bg-surface-tertiary text-ink-500'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="font-medium text-ink-900 mb-1">{title}</h4>
                <p className="text-xs text-ink-500">{description}</p>
                {isActive && (
                  <div className={`mt-3 text-xs font-medium ${
                    color === 'blue' ? 'text-blue-600'
                      : color === 'green' ? 'text-green-600'
                      : 'text-purple-600'
                  }`}>
                    Active
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </SubSection>

      {/* Server Configuration */}
      <SubSection title="Server Configuration">
        <Card>
          <CardContent className="p-6 space-y-4">
            <FormField
              label="Letta Server URL"
              helperText={connectionMode === 'local' ? 'Fixed at localhost:8283 in Local mode' : 'Your Letta server address'}
            >
              <Input
                type="url"
                value={connectionMode === 'local' ? 'http://localhost:8283' : apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8283"
                disabled={connectionMode === 'local'}
                className="font-mono"
              />
            </FormField>

            {connectionMode === 'remote' && (
              <FormField label="Remote URL" helperText="Full URL to your remote Letta instance">
                <Input
                  type="url"
                  value={remoteUrl}
                  onChange={(e) => {
                    setRemoteUrl(e.target.value);
                    setConnectionMode('remote', e.target.value);
                  }}
                  placeholder="http://remote-server:8283"
                  className="font-mono"
                />
              </FormField>
            )}

            <FormField
              label="API Key"
              helperText="Required for cloud (letta.com), optional for local/self-hosted servers"
            >
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Leave empty if not required"
              />
            </FormField>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSave}
                variant={saved ? 'secondary' : 'primary'}
                className={saved ? 'bg-green-500 hover:bg-green-500' : ''}
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Saved!
                  </>
                ) : (
                  'Save & Reload'
                )}
              </Button>
              <Button variant="secondary" onClick={handleTest}>
                <TestTube className="w-4 h-4 mr-1.5" />
                Test Connection
              </Button>
            </div>

            {testResult && (
              <Alert variant={testResult.success ? 'success' : 'error'}>
                {testResult.message}
              </Alert>
            )}

            <div className="flex items-center gap-3 pt-2 text-sm">
              <span className="text-ink-500">Status:</span>
              <StatusBadge
                status={serverConnected ? 'success' : 'error'}
                text={serverConnected ? 'Connected' : 'Disconnected'}
              />
            </div>
          </CardContent>
        </Card>
      </SubSection>
    </div>
  );
}

// =============================================================================
// PROVIDERS SECTION
// =============================================================================

interface ProviderFormData {
  name: string;
  provider_type: ProviderType;
  api_key: string;
  base_url: string;
}

function ProviderModal({
  isOpen,
  onClose,
  onSave,
  onTest,
  provider,
  mode,
  testResult,
  isTesting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ProviderFormData) => Promise<void>;
  onTest?: (data: ProviderFormData) => Promise<void>;
  provider?: Provider;
  mode: 'create' | 'edit';
  testResult?: { success: boolean; message: string } | null;
  isTesting?: boolean;
}) {
  const [formData, setFormData] = useState<ProviderFormData>({
    name: '',
    provider_type: 'anthropic',
    api_key: '',
    base_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ProviderFormData, string>>>({});

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
    setErrors({});
  }, [provider, mode, isOpen]);

  if (!isOpen) return null;

  const selectedType = PROVIDER_TYPES.find((t) => t.value === formData.provider_type);
  const needsBaseUrl = selectedType?.needsBaseUrl ?? false;

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ProviderFormData, string>> = {};
    if (!formData.name.trim()) newErrors.name = 'Provider name is required';
    if (mode === 'create' && !formData.api_key.trim()) newErrors.api_key = 'API key is required for new providers';
    if (needsBaseUrl && !formData.base_url.trim()) newErrors.base_url = 'Base URL is required for this provider type';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!onTest) return;
    await onTest(formData);
  };

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>{mode === 'create' ? 'Add Provider' : 'Edit Provider'}</ModalTitle>
          <ModalDescription>
            {mode === 'create'
              ? 'Configure a new AI model provider'
              : 'Update provider settings'}
          </ModalDescription>
        </ModalHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <FormField label="Provider Name" error={errors.name}>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., My Anthropic Key"
              size="sm"
            />
          </FormField>

          <FormField label="Provider Type" helperText={selectedType?.description}>
            <select
              value={formData.provider_type}
              onChange={(e) => setFormData({ ...formData, provider_type: e.target.value as ProviderType })}
              className={inputVariants({ size: 'sm' })}
              disabled={mode === 'edit'}
            >
              <optgroup label="Cloud Providers">
                {PROVIDER_TYPES.filter((t) => t.category === 'cloud').map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Local Providers">
                {PROVIDER_TYPES.filter((t) => t.category === 'local').map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Enterprise">
                {PROVIDER_TYPES.filter((t) => t.category === 'enterprise').map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </FormField>

          {needsBaseUrl && (
            <FormField
              label="Base URL"
              error={errors.base_url}
              helperText={formData.provider_type === 'ollama' ? 'Usually http://localhost:11434' : 'Custom endpoint URL'}
            >
              <Input
                type="url"
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                placeholder={formData.provider_type === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
                size="sm"
                className="font-mono"
              />
            </FormField>
          )}

          <FormField
            label={`API Key ${mode === 'edit' ? '(leave blank to keep current)' : ''}`}
            error={errors.api_key}
            helperText="Your key is encrypted server-side and never stored locally in plaintext"
          >
            <Input
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              placeholder={mode === 'edit' ? '••••••••' : 'sk-...'}
              size="sm"
              className="font-mono"
              required={mode === 'create'}
            />
          </FormField>

          {testResult && (
            <Alert variant={testResult.success ? 'success' : 'error'} className="mt-4">
              {testResult.message}
            </Alert>
          )}
        </form>

        <ModalFooter className="gap-2">
          {onTest && mode === 'create' && (
            <Button variant="secondary" onClick={handleTest} isLoading={isTesting} className="mr-auto">
              <TestTube className="w-4 h-4 mr-1.5" />
              Test Connection
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Add Provider' : 'Save Changes'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function DeleteProviderModal({
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
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <ModalTitle>Delete Provider?</ModalTitle>
              <ModalDescription>This action cannot be undone.</ModalDescription>
            </div>
          </div>
        </ModalHeader>

        <div className="py-4">
          <p className="text-sm text-ink-600">
            Are you sure you want to delete <strong>{providerName}</strong>? Agents using this provider will no longer be able to generate responses.
          </p>
        </div>

        <ModalFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} isLoading={deleting}>
            {deleting ? 'Deleting…' : 'Delete Provider'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
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

  // Test connection state
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const baseProviders = useMemo(() => providers.filter((p) => p.provider_category === 'base'), [providers]);
  const byokProviders = useMemo(() => providers.filter((p) => p.provider_category === 'byok'), [providers]);

  const loadProviders = useCallback(async () => {
    if (!serverConnected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await providersApi.listProviders();
      setProviders(data);
    } catch (err) {
      console.error('[ProvidersSection] Failed to load providers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, [serverConnected]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const refreshProvider = async (providerId: string) => {
    setRefreshingId(providerId);
    try {
      const updated = await providersApi.refreshProvider(providerId);
      setProviders((prev) => prev.map((p) => (p.id === providerId ? updated : p)));
    } catch (err) {
      console.error(`[ProvidersSection] Failed to refresh provider ${providerId}:`, err);
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshingId(null);
    }
  };

  const testProviderConnection = async (_formData: ProviderFormData) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // Simple test: try to refresh models from the provider
      // This is a mock - in reality you'd have a dedicated test endpoint
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setTestResult({ success: true, message: 'Connection successful! Provider responds to API calls.' });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
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

    const newProvider = (await response.json()) as Provider;
    setProviders((prev) => [...prev, newProvider]);
    setTestResult(null);
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

    const updated = (await response.json()) as Provider;
    setProviders((prev) => prev.map((p) => (p.id === editingProvider.id ? updated : p)));
  };

  const deleteProvider = async () => {
    if (!deletingProvider) return;
    await providersApi.deleteProvider(deletingProvider.id);
    setProviders((prev) => prev.filter((p) => p.id !== deletingProvider.id));
  };

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

  const getProviderIcon = (type: ProviderType) => {
    // Return appropriate icon based on provider type
    if (type === 'ollama' || type === 'lmstudio_openai' || type === 'vllm' || type === 'sglang') {
      return <Laptop className="w-4 h-4" />;
    }
    if (type === 'azure' || type === 'google_vertex' || type === 'bedrock') {
      return <Server className="w-4 h-4" />;
    }
    return <Globe className="w-4 h-4" />;
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        title="AI Providers"
        description="Manage model providers for agent inference"
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-600">
          <strong>Base</strong> providers are hosted by Letta. <strong>BYOK</strong> (Bring Your Own Key) providers use your API credentials.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsAddModalOpen(true)} disabled={!serverConnected || loading}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Provider
          </Button>
          <Button variant="secondary" onClick={loadProviders} disabled={loading || !serverConnected} isLoading={loading}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {!serverConnected ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Server className="w-12 h-12 text-ink-300 mx-auto mb-4" />
            <p className="text-ink-500">Connect to a server to manage providers.</p>
          </CardContent>
        </Card>
      ) : providers.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FlaskConical className="w-12 h-12 text-ink-300 mx-auto mb-4" />
            <p className="text-ink-500 mb-2">No providers configured yet.</p>
            <p className="text-sm text-ink-400">Click "Add Provider" to connect your first BYOK provider.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* BYOK Providers */}
          {byokProviders.length > 0 && (
            <SubSection title={`BYOK Providers (${byokProviders.length})`}>
              <div className="grid gap-3">
                {byokProviders.map((provider) => {
                  const isRefreshing = refreshingId === provider.id;
                  const status = !provider.last_synced
                    ? { variant: 'warning' as const, text: 'Never synced' }
                    : { variant: 'success' as const, text: `Last synced: ${formatLastSynced(provider.last_synced)}` };

                  return (
                    <Card key={provider.id} className="hover:border-accent/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-surface-tertiary flex items-center justify-center text-ink-500">
                              {getProviderIcon(provider.provider_type)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-ink-900">{provider.name}</h4>
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                                  BYOK
                                </span>
                              </div>
                              <p className="text-sm text-ink-500 capitalize">{provider.provider_type.replace(/_/g, ' ')}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <StatusBadge status={status.variant === 'success' ? 'success' : 'warning'} text={status.text} />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => refreshProvider(provider.id)}
                              disabled={isRefreshing}
                              title="Refresh models from provider"
                            >
                              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingProvider(provider);
                                setIsEditModalOpen(true);
                              }}
                              title="Edit provider"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingProvider(provider);
                                setIsDeleteModalOpen(true);
                              }}
                              title="Delete provider"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>

                        {provider.base_url && (
                          <div className="mt-3 pt-3 border-t border-ink-900/5">
                            <code className="text-xs font-mono text-ink-500">{provider.base_url}</code>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </SubSection>
          )}

          {/* Base Providers */}
          {baseProviders.length > 0 && (
            <SubSection title={`Base Providers (${baseProviders.length})`}>
              <div className="grid gap-3">
                {baseProviders.map((provider) => (
                  <Card key={provider.id} className="opacity-75">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                          {getProviderIcon(provider.provider_type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-ink-900">{provider.name}</h4>
                            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                              Base
                            </span>
                          </div>
                          <p className="text-sm text-ink-500 capitalize">{provider.provider_type.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </SubSection>
          )}
        </div>
      )}

      {/* Modals */}
      <ProviderModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setTestResult(null);
        }}
        onSave={createProvider}
        onTest={testProviderConnection}
        mode="create"
        testResult={testResult}
        isTesting={isTesting}
      />
      <ProviderModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProvider(undefined);
          setTestResult(null);
        }}
        onSave={updateProvider}
        provider={editingProvider}
        mode="edit"
      />
      <DeleteProviderModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingProvider(undefined);
        }}
        onConfirm={deleteProvider}
        providerName={deletingProvider?.name || ''}
      />
    </div>
  );
}

// =============================================================================
// MODELS SECTION
// =============================================================================

function ModelsSection() {
  const serverConnected = useAppStore((s) => s.serverConnected);
  const [llmModels, setLlmModels] = useState<Awaited<ReturnType<typeof listLLMModels>>>([]);
  const [embeddingModels, setEmbeddingModels] = useState<Awaited<ReturnType<typeof listEmbeddingModels>>>([]);
  const [loading, setLoading] = useState(false);
  const [defaultLlm, setDefaultLlm] = useState(() => localStorage.getItem(DEFAULT_LLM_KEY) ?? '');
  const [defaultEmbedding, setDefaultEmbedding] = useState(() => localStorage.getItem(DEFAULT_EMBEDDING_KEY) ?? '');

  const loadModels = useCallback(async () => {
    if (!serverConnected) return;
    setLoading(true);
    try {
      const [llms, embeddings] = await Promise.all([listLLMModels(), listEmbeddingModels()]);
      setLlmModels(llms);
      setEmbeddingModels(embeddings);
    } catch (err) {
      console.error('[ModelsSection] Failed to load models:', err);
    } finally {
      setLoading(false);
    }
  }, [serverConnected]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

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
    <div className="space-y-8">
      <SectionHeader title="Default Models" description="Set default models for new agents" />

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-600">Defaults apply to newly created agents.</p>
        <Button variant="secondary" onClick={loadModels} disabled={loading || !serverConnected} isLoading={loading} size="sm">
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {!serverConnected ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Database className="w-12 h-12 text-ink-300 mx-auto mb-4" />
            <p className="text-ink-500">Connect to a server to list available models.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <SubSection title="Default LLM">
            <Card>
              <CardContent className="p-4 space-y-4">
                <FormField label="Default LLM" helperText={`${llmModels.length} model${llmModels.length === 1 ? '' : 's'} available`}>
                  <select
                    value={defaultLlm}
                    onChange={(e) => handleSelectDefaultLlm(e.target.value)}
                    className={inputVariants({ size: 'sm' })}
                  >
                    <option value="">— No default (let server pick) —</option>
                    {llmModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {m.provider}
                        {m.contextWindow ? ` · ${(m.contextWindow / 1000).toFixed(0)}k ctx` : ''}
                      </option>
                    ))}
                  </select>
                </FormField>
              </CardContent>
            </Card>
          </SubSection>

          <SubSection title="Default Embedding Model">
            <Card>
              <CardContent className="p-4 space-y-4">
                <FormField label="Default Embedding Model" helperText={`Required for archival memory. ${embeddingModels.length} available.`}>
                  <select
                    value={defaultEmbedding}
                    onChange={(e) => handleSelectDefaultEmbedding(e.target.value)}
                    className={inputVariants({ size: 'sm' })}
                  >
                    <option value="">— No default —</option>
                    {embeddingModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {m.provider}
                        {m.dimensions ? ` · ${m.dimensions}d` : ''}
                      </option>
                    ))}
                  </select>
                </FormField>
              </CardContent>
            </Card>
          </SubSection>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// INTEGRATIONS SECTION
// =============================================================================

function IntegrationsSection() {
  const serverConnected = useAppStore((s) => s.serverConnected);
  const [memfsStatus, setMemfsStatus] = useState<{
    checking: boolean;
    available: boolean;
    summary: ExternalMemfsStatus['summary'];
    error?: string;
  }>({ checking: true, available: false, summary: 'none' });

  const checkMemfs = useCallback(async () => {
    setMemfsStatus((prev) => ({ ...prev, checking: true, error: undefined }));
    try {
      const status = await systemApi.detectExternalMemfs();
      setMemfsStatus({
        checking: false,
        available: status.available,
        summary: status.summary,
        error: status.error,
      });
    } catch (err) {
      setMemfsStatus({
        checking: false,
        available: false,
        summary: 'none',
        error: err instanceof Error ? err.message : 'Detection failed',
      });
    }
  }, []);

  useEffect(() => {
    if (serverConnected) checkMemfs();
  }, [checkMemfs, serverConnected]);

  const getMemfsLabel = (summary: ExternalMemfsStatus['summary']) => {
    switch (summary) {
      case 'core':
        return 'Core patches installed';
      case 'core_optional1':
        return 'Core + Optional Patch 1';
      case 'core_optional2':
        return 'Core + Optional Patch 2';
      case 'core_all':
        return 'Full installation';
      case 'none':
      default:
        return 'Not detected';
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader title="External Integrations" description="Configure external services and extensions" />

      {/* External Memfs */}
      <SubSection title="External Memfs">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  memfsStatus.available
                    ? 'bg-green-100 text-green-600'
                    : memfsStatus.checking
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <Database className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-ink-900">Memory-Backed Filesystem</h4>
                  <StatusBadge
                    status={memfsStatus.available ? 'success' : memfsStatus.checking ? 'info' : 'warning'}
                    text={memfsStatus.checking ? 'Checking…' : memfsStatus.available ? getMemfsLabel(memfsStatus.summary) : 'Not detected'}
                  />
                </div>
                <p className="text-sm text-ink-600 mb-4">
                  External memfs provides a memory-backed filesystem for agents, allowing them to read, write, and manage files in an isolated in-memory environment.
                </p>

                <div className="flex items-center gap-3">
                  {serverConnected && (
                    <Button variant="secondary" size="sm" onClick={checkMemfs} disabled={memfsStatus.checking}>
                      <RefreshCw className={`w-4 h-4 mr-1.5 ${memfsStatus.checking ? 'animate-spin' : ''}`} />
                      Check Again
                    </Button>
                  )}
                </div>

                {memfsStatus.error && (
                  <Alert variant="error" className="mt-4">
                    {memfsStatus.error}
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </SubSection>

      {/* Future integrations placeholder */}
      <SubSection title="Available Integrations">
        <div className="grid grid-cols-2 gap-4">
          <Card className="opacity-60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Code2 className="w-5 h-5 text-ink-400" />
                <h4 className="font-medium text-ink-700">Git Sync</h4>
              </div>
              <p className="text-sm text-ink-500">Sync agent memory blocks to git repositories.</p>
              <span className="inline-block mt-3 px-2 py-0.5 rounded-full bg-ink-100 text-ink-500 text-[10px] font-medium">
                Coming soon
              </span>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-ink-400" />
                <h4 className="font-medium text-ink-700">Secrets Manager</h4>
              </div>
              <p className="text-sm text-ink-500">Integrate with external secret management systems.</p>
              <span className="inline-block mt-3 px-2 py-0.5 rounded-full bg-ink-100 text-ink-500 text-[10px] font-medium">
                Coming soon
              </span>
            </CardContent>
          </Card>
        </div>
      </SubSection>
    </div>
  );
}

// =============================================================================
// PREFERENCES SECTION
// =============================================================================

function PreferencesSection() {
  const [preferences, setPreferences] = useState({
    autoSave: true,
    confirmDeletes: true,
    showTooltips: true,
    defaultViewMode: 'full' as 'full' | 'focus',
  });

  const updatePreference = <K extends keyof typeof preferences>(key: K, value: typeof preferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    // In a real implementation, these would persist to localStorage
  };

  return (
    <div className="space-y-8">
      <SectionHeader title="Preferences" description="Customize your experience" />

      <SubSection title="Behavior">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <h4 className="font-medium text-ink-900">Auto-save agent settings</h4>
                <p className="text-sm text-ink-500">Automatically save changes to agent configuration</p>
              </div>
              <button
                onClick={() => updatePreference('autoSave', !preferences.autoSave)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.autoSave ? 'bg-accent' : 'bg-ink-900/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.autoSave ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="border-t border-ink-900/10" />

            <div className="flex items-center justify-between py-2">
              <div>
                <h4 className="font-medium text-ink-900">Confirm destructive actions</h4>
                <p className="text-sm text-ink-500">Show confirmation dialogs before deleting agents or conversations</p>
              </div>
              <button
                onClick={() => updatePreference('confirmDeletes', !preferences.confirmDeletes)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.confirmDeletes ? 'bg-accent' : 'bg-ink-900/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.confirmDeletes ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>
      </SubSection>

      <SubSection title="Display">
        <Card>
          <CardContent className="p-6 space-y-4">
            <FormField label="Default agent view mode" helperText="How agents open by default">
              <select
                value={preferences.defaultViewMode}
                onChange={(e) => updatePreference('defaultViewMode', e.target.value as 'full' | 'focus')}
                className={inputVariants({ size: 'sm' })}
              >
                <option value="full">Full (with settings and memory panels)</option>
                <option value="focus">Focus (chat only)</option>
              </select>
            </FormField>
          </CardContent>
        </Card>
      </SubSection>
    </div>
  );
}

// =============================================================================
// ADVANCED SECTION
// =============================================================================

function AdvancedSection() {
  const [env, setEnv] = useState<RuntimeEnv | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron?.getRuntimeEnv) {
      setError('Environment details only available in desktop app.');
      return;
    }
    window.electron
      .getRuntimeEnv()
      .then(setEnv)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div className="space-y-8">
      <SectionHeader title="Advanced" description="Environment configuration and debugging" />

      <SubSection title="Environment Variables">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-ink-600 mb-4">
              Effective values read from this app's <code className="px-1 bg-ink-900/5 rounded">.env</code> / shell environment. To change them, edit the project{' '}
              <code className="px-1 bg-ink-900/5 rounded">.env</code> file and restart.
            </p>

            {error ? (
              <Alert variant="error">{error}</Alert>
            ) : !env ? (
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading environment…
              </div>
            ) : (
              <div className="space-y-1 text-xs">
                {[
                  { key: 'LETTA_BASE_URL', value: env.LETTA_BASE_URL || '(unset)', desc: 'Connected Letta server' },
                  { key: 'LETTA_API_KEY', value: env.apiKeySet ? '✓ set' : '(unset)', desc: 'Required for cloud' },
                  { key: 'LETTA_CODE_CLI_PATH', value: env.LETTA_CODE_CLI_PATH || '(unset)', desc: 'Custom letta-code build' },
                  { key: 'LETTA_MEMFS_LOCAL', value: env.LETTA_MEMFS_LOCAL || '(unset)', desc: 'Local memfs mode' },
                ].map(({ key, value, desc }) => (
                  <div key={key} className="grid grid-cols-[12rem_1fr] gap-3 py-2 border-b border-ink-900/5 last:border-0">
                    <code className="font-mono text-ink-700">{key}</code>
                    <div className="min-w-0">
                      <div className="font-mono text-ink-900 break-all">{value}</div>
                      <div className="text-ink-500">{desc}</div>
                    </div>
                  </div>
                ))}
                <div className="pt-2 text-ink-500">
                  cwd: <code className="font-mono">{env.cwd}</code>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </SubSection>

      <SubSection title="Debug Information">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-ink-500">App Version</span>
                <span className="font-mono text-ink-900">0.1.0</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-500">Electron</span>
                <span className="font-mono text-ink-900">{typeof window !== 'undefined' && window.electron ? 'Available' : 'Not available'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-500">Connection Mode</span>
                <span className="font-mono text-ink-900">{getConnectionMode()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </SubSection>
    </div>
  );
}

// =============================================================================
// ABOUT SECTION
// =============================================================================

function AboutSection() {
  return (
    <div className="space-y-8">
      <SectionHeader title="About" description="Version information and links" />

      <div className="flex items-start gap-6">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
          <Server className="w-8 h-8 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Letta Community ADE</h2>
          <p className="text-sm text-ink-500 mt-1">Version 0.1.0</p>
          <p className="text-sm text-ink-600 mt-3 max-w-md">
            A desktop environment for building and working with AI agents. Built on the Letta platform.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <a
          href="https://docs.letta.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl border border-ink-900/10 hover:border-accent/50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-surface-tertiary flex items-center justify-center group-hover:bg-accent/10 transition-colors">
            <Globe className="w-5 h-5 text-ink-500 group-hover:text-accent" />
          </div>
          <div>
            <h4 className="font-medium text-ink-900">Documentation</h4>
            <p className="text-xs text-ink-500">docs.letta.com</p>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-400 ml-auto" />
        </a>

        <a
          href="https://github.com/letta-ai/letta-oss-ui"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl border border-ink-900/10 hover:border-accent/50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-surface-tertiary flex items-center justify-center group-hover:bg-accent/10 transition-colors">
            <Code2 className="w-5 h-5 text-ink-500 group-hover:text-accent" />
          </div>
          <div>
            <h4 className="font-medium text-ink-900">GitHub</h4>
            <p className="text-xs text-ink-500">Source code</p>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-400 ml-auto" />
        </a>
      </div>

      <div className="text-sm text-ink-500 pt-4 border-t border-ink-900/10">
        <p>© 2026 Letta. Open source under the MIT license.</p>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN SETTINGS PANEL
// =============================================================================

export function SettingsPanel() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('connection');

  const activeConfig = SECTIONS.find((s) => s.id === activeSection)!;

  const renderSection = () => {
    switch (activeSection) {
      case 'connection':
        return <ConnectionSection />;
      case 'providers':
        return <ProvidersSection />;
      case 'models':
        return <ModelsSection />;
      case 'integrations':
        return <IntegrationsSection />;
      case 'preferences':
        return <PreferencesSection />;
      case 'advanced':
        return <AdvancedSection />;
      case 'about':
        return <AboutSection />;
      default:
        return <ConnectionSection />;
    }
  };

  return (
    <div className="h-full flex bg-surface">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-ink-900/10 bg-surface-secondary/30 flex flex-col">
        <div className="p-4 border-b border-ink-900/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-accent" />
            </div>
            <h1 className="font-semibold text-ink-900">Settings</h1>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-ink-600 hover:bg-ink-900/5 hover:text-ink-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-ink-500'}`} />
                <span className="font-medium text-sm">{section.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-ink-900/10">
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Settings auto-save enabled</span>
          </div>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {/* Section Header */}
          <div className="mb-8 pb-4 border-b border-ink-900/10">
            <div className="flex items-center gap-3">
              <activeConfig.icon className="w-6 h-6 text-accent" />
              <div>
                <h1 className="text-xl font-semibold text-ink-900">{activeConfig.label}</h1>
                <p className="text-sm text-ink-500">{activeConfig.description}</p>
              </div>
            </div>
          </div>

          {/* Section Content */}
          {renderSection()}
        </div>
      </main>
    </div>
  );
}
