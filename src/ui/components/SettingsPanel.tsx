import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { resetClient, systemApi, listLLMModels, listEmbeddingModels, type ExternalMemfsStatus } from '../services/api';

const API_BASE_KEY = 'letta_api_url';
const API_KEY_STORAGE = 'letta_api_key';
const DEFAULT_LLM_KEY = 'letta_default_llm';
const DEFAULT_EMBEDDING_KEY = 'letta_default_embedding';

/**
 * EXTERNAL MEMFS ARCHITECTURE (per SERVER setting):
 *
 * External memfs is a server-side patchwork that adds memory-backed filesystem
 * capabilities to the Letta server. It consists of:
 * - Core memfs patches (required)
 * - 2 optional add-on patches (TBD which ones)
 *
 * DETECTION STRATEGY:
 * - PRIMARY: Query the connected server via API/health endpoint to detect if patches applied
 * - SECONDARY: localStorage/Electron config for manual override
 *
 * This is DIFFERENT from agent-level settings like git_enabled, which is per-agent.
 *
 * The detection queries the Letta server to determine which patches are installed:
 * - /v1/external-memfs/health (preferred)
 * - /v1/capabilities (fallback)
 */
const EXTERNAL_MEMFS_KEY = 'letta_external_memfs_enabled';

// TODO: Add per-agent git_enabled detection (separate from external memfs)
// This would be checked in AgentMemoryPanel or agent settings, not here.

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

export function SettingsPanel() {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const serverConnected = useAppStore((s) => s.serverConnected);
  const setServerConnected = useAppStore((s) => s.setServerConnected);

  // Model & inference defaults (used when creating new agents).
  type LlmEntry = { id: string; name: string; provider: string; contextWindow?: number };
  type EmbeddingEntry = { id: string; name: string; provider: string; dimensions?: number };
  const [llmModels, setLlmModels] = useState<LlmEntry[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<EmbeddingEntry[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [defaultLlm, setDefaultLlm] = useState<string>(() => localStorage.getItem(DEFAULT_LLM_KEY) ?? '');
  const [defaultEmbedding, setDefaultEmbedding] = useState<string>(() => localStorage.getItem(DEFAULT_EMBEDDING_KEY) ?? '');

  const providersSeen = useMemo(() => {
    const set = new Set<string>();
    llmModels.forEach((m) => m.provider && set.add(m.provider));
    embeddingModels.forEach((m) => m.provider && set.add(m.provider));
    return Array.from(set).sort();
  }, [llmModels, embeddingModels]);

  // External memfs detection state
  const [externalMemfsStatus, setExternalMemfsStatus] = useState<{
    /** Whether server detection is in progress */
    checking: boolean;
    /** Server-detected status (null if not checked yet) */
    serverStatus: ExternalMemfsStatus | null;
    /** Whether localStorage/Electron has it enabled (fallback) */
    localEnabled: boolean;
    /** Final display status - combines server + local */
    detected: boolean;
    /** Detailed summary of what's installed */
    summary: ExternalMemfsStatus['summary'];
    error?: string;
  }>({
    checking: true,
    serverStatus: null,
    localEnabled: false,
    detected: false,
    summary: 'none',
  });

  // Load saved URL on mount. Prefer electron config (authoritative for the
  // spawn proxy); fall back to localStorage for browser-only builds.
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

  /**
   * Detect external memfs integration availability.
   *
   * DETECTION ORDER:
   * 1. Query connected server API to detect if external memfs patches are applied
   *    - Check /v1/external-memfs/health endpoint (preferred)
   *    - Fall back to /v1/capabilities endpoint
   *    - Detect which of the 2 optional patches are present
   * 2. Fall back to Electron config/localStorage for manual override
   *
   * The external memfs is a SERVER-LEVEL patchwork for "Self-hosted + Memfs" that
   * provides memory-backed filesystem capabilities. This is different from:
   * - Agent-level memfs (per-agent capability)
   * - git_enabled (per-agent setting for git integration)
   */
  const detectExternalMemfs = useCallback(async () => {
    setExternalMemfsStatus(prev => ({ ...prev, checking: true, error: undefined }));

    try {
      // STEP 1: Check localStorage/Electron config first (for fallback detection)
      let localEnabled = false;
      if (typeof window !== 'undefined' && window.electron?.getConfig) {
        const cfg = await window.electron.getConfig();
        localEnabled = cfg.externalMemfsEnabled ?? false;
      }
      if (!localEnabled) {
        localEnabled = localStorage.getItem(EXTERNAL_MEMFS_KEY) === 'true';
      }

      // STEP 2: Query server for external memfs capabilities (PRIMARY detection)
      let serverStatus: ExternalMemfsStatus | null = null;
      try {
        serverStatus = await systemApi.detectExternalMemfs();
      } catch (err) {
        // Server detection failed, we'll fall back to local config
        console.warn('[SettingsPanel] Server memfs detection failed:', err);
      }

      // STEP 3: Combine server status with local fallback
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

  // Run detection on mount and when server connection changes
  useEffect(() => {
    detectExternalMemfs();
  }, [detectExternalMemfs, serverConnected]);

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

  const handleSave = async () => {
    localStorage.setItem(API_BASE_KEY, apiUrl);
    localStorage.setItem(API_KEY_STORAGE, apiKey);

    // Persist to electron config so the main-process proxy uses the same
    // upstream. Without this the spawned letta-code subprocess would target
    // whatever default lives in config.ts, not what the user typed here.
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

  /**
   * Enable external memfs integration.
   * Sets the flag in both Electron config (if available) and localStorage.
   */
  const enableExternalMemfs = async () => {
    try {
      // Save to localStorage (works in both browser and Electron)
      localStorage.setItem(EXTERNAL_MEMFS_KEY, 'true');

      // Save to Electron config if available
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
      setExternalMemfsStatus(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to enable'
      }));
    }
  };

  /**
   * Disable external memfs integration.
   */
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

  const handleTest = async () => {
    setTestResult(null);
    try {
      // In browser dev mode with no custom URL, use relative path (Vite proxy)
      const isBrowserDev = typeof window !== 'undefined' && !window.electron;
      const isUsingProxy = isBrowserDev && !localStorage.getItem(API_BASE_KEY);

      // Use /v1/agents/ endpoint (Letta doesn't have /health)
      const testUrl = isUsingProxy
        ? '/v1/agents/'
        : `${apiUrl.replace(/\/$/, '')}/v1/agents/`;

      const res = await fetch(testUrl, {
        method: 'GET',
        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
      });

      if (res.ok || res.status === 200) {
        setServerConnected(true);
        setTestResult({
          success: true,
          message: 'Connected to Letta server!'
        });
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
    <div className="h-full bg-surface p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-ink-900 mb-6">Settings</h1>

        {/* Operator profile (single-user-per-install). Display name + memfs
            URL template + token live here. Token is set once and stored in
            the OS keychain; it never round-trips back to the renderer. */}
        <OperatorProfileCard />

        {/* Server Connection */}
        <div className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6 mb-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            Server Connection
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">
                Letta Server URL
              </label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8283"
                className="w-full px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <p className="text-xs text-ink-500 mt-1">
                Your Letta server address (e.g., http://10.10.20.19:8283)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">
                API Key (optional)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Leave empty if not required"
                className="w-full px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <p className="text-xs text-ink-500 mt-1">
                Required for cloud (letta.com), optional for local servers
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleSave}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  saved
                    ? 'bg-green-500 text-white'
                    : 'bg-accent text-white hover:bg-accent-hover'
                }`}
              >
                {saved ? 'Saved!' : 'Save & Reload'}
              </button>
              <button
                onClick={handleTest}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-ink-300 text-ink-700 hover:bg-ink-50 transition-colors"
              >
                Test Connection
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem(API_BASE_KEY);
                  localStorage.removeItem(API_KEY_STORAGE);
                  setApiUrl('');
                  setApiKey('');
                  resetClient();
                  setTestResult({ success: true, message: 'Reset to default (Vite proxy). Reloading...' });
                  setTimeout(() => location.reload(), 1000);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-ink-500 hover:text-ink-700 hover:bg-ink-50 transition-colors"
              >
                Reset to Default
              </button>
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
        </div>

        {/* External Integrations - Memory Extensions */}
        <div className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6 mb-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            External Integrations
          </h2>

          {/* External Memfs Card */}
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

              {/* Status Badge */}
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

            {/* Description */}
            <p className="text-sm text-ink-600 mb-4 leading-relaxed">
              External memfs provides a memory-backed filesystem for agents, allowing them to read,
              write, and manage files in an isolated in-memory environment. This is especially useful
              for self-hosted deployments where you want agents to have filesystem capabilities
              without persisting to disk.
            </p>

            {/* Patch Details (when detected) */}
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
                {!externalMemfsStatus.serverStatus.available && externalMemfsStatus.localEnabled && (
                  <div className="mt-2 text-xs text-amber-600 pt-2 border-t border-green-100">
                    Using local override (server detection unavailable)
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Check Again button (always visible when connected) */}
              {serverConnected && (
                <button
                  onClick={detectExternalMemfs}
                  disabled={externalMemfsStatus.checking}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-ink-300 text-ink-600 hover:bg-ink-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              ) : externalMemfsStatus.checking ? (
                <span className="text-sm text-ink-500 italic">Querying server...</span>
              ) : (
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

            {/* Error Message */}
            {externalMemfsStatus.error && (
              <div className="mt-3 text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200">
                Error: {externalMemfsStatus.error}
              </div>
            )}
          </div>
        </div>

        {/* Model & Inference Defaults */}
        <div className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink-900 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Model & Inference Defaults
            </h2>
            <button
              onClick={refreshModels}
              disabled={modelsLoading || !serverConnected}
              className="px-2 py-1 rounded-md text-xs font-medium border border-ink-300 text-ink-600 hover:bg-ink-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {modelsLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {!serverConnected ? (
            <p className="text-sm text-ink-500 italic">Connect to a server to list available models.</p>
          ) : modelsError ? (
            <p className="text-sm text-red-600">{modelsError}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">
                  Default LLM <span className="text-ink-400 font-normal">— for new agents</span>
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
                  {llmModels.length} model{llmModels.length === 1 ? '' : 's'} reachable from this server.
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
                  Required for archival memory and folder sources. {embeddingModels.length} available.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Provider Availability (BYOK status) */}
        <div className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6 mb-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Providers (BYOK)
          </h2>
          <p className="text-sm text-ink-600 mb-3">
            Provider API keys are configured server-side via environment variables (e.g.
            <code className="mx-1 px-1 bg-ink-900/5 rounded">OPENAI_API_KEY</code>,
            <code className="mx-1 px-1 bg-ink-900/5 rounded">ANTHROPIC_API_KEY</code>). The list below
            reflects which providers the connected server can actually reach.
          </p>
          {!serverConnected ? (
            <p className="text-sm text-ink-500 italic">Connect to a server to see providers.</p>
          ) : providersSeen.length === 0 ? (
            <p className="text-sm text-ink-500 italic">No providers detected. The server has no usable model handles — set provider keys in its env and restart.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {providersSeen.map((p) => {
                const llmCount = llmModels.filter((m) => m.provider === p).length;
                const embCount = embeddingModels.filter((m) => m.provider === p).length;
                return (
                  <span
                    key={p}
                    className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium"
                    title={`${llmCount} LLM${llmCount === 1 ? '' : 's'}, ${embCount} embedding${embCount === 1 ? '' : 's'} via ${p}`}
                  >
                    {p}
                    <span className="ml-1 text-emerald-600/70">{llmCount}+{embCount}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Local Environment (electron / .env-derived) */}
        <div className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6 mb-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Local Environment
          </h2>
          <p className="text-sm text-ink-600 mb-3">
            Effective values read from this app's <code className="px-1 bg-ink-900/5 rounded">.env</code> /
            shell environment. To change them, edit the project <code className="px-1 bg-ink-900/5 rounded">.env</code>
            file and restart the app — Electron loads them at startup.
          </p>
          <LocalEnvTable />
        </div>

        {/* About */}
        <div className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-2">About</h2>
          <div className="text-sm text-ink-600 space-y-1">
            <p>Letta Community ADE</p>
            <p className="text-xs text-ink-400">Version 0.1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Operator profile card — display name + memfs URL template + token controls.
// Loaded once on mount via Electron IPC. Token is write-only; renderer can
// only ask whether one is set, never read it back.
function OperatorProfileCard() {
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

  // Hydrate inputs from store + ask main whether a token is on file.
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

  // Refresh once on mount so this card works even if the gate already passed.
  useEffect(() => {
    if (!operatorProfile) loadOperatorProfile();
  }, [operatorProfile, loadOperatorProfile]);

  return (
    <div className="bg-surface-secondary rounded-xl border border-ink-900/10 p-6 mb-6">
      <h2 className="text-sm font-semibold text-ink-900 mb-1 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Operator Profile
      </h2>
      <p className="text-xs text-ink-500 mb-4">
        Single profile per install. Display name surfaces in agent prompts; memfs URL is the default for local-mode spawns.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Casey"
            className="w-full px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">
            Memfs git URL template
          </label>
          <input
            type="text"
            value={urlTemplate}
            onChange={(e) => setUrlTemplate(e.target.value)}
            placeholder="http://10.10.20.120:4455/Fimeg/{agentId}.git"
            className="w-full px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <p className="text-xs text-ink-500 mt-1">
            <code className="font-mono">{'{agentId}'}</code> is replaced at spawn time. The token is prefixed automatically.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onSaveProfile}
            disabled={saving || !displayName.trim()}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>

        <div className="border-t border-ink-900/10 pt-4">
          <label className="block text-sm font-medium text-ink-700 mb-1">
            Memfs git token
          </label>
          <p className="text-xs text-ink-500 mb-2">
            Stored in the OS keychain. Status: {tokenSet ? <span className="text-green-600 font-medium">Set</span> : <span className="text-ink-500">Not set</span>}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste new token to set/replace"
              className="flex-1 min-w-[200px] px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              onClick={onSetToken}
              disabled={!tokenInput.trim()}
              className="px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set
            </button>
            {tokenSet && (
              <button
                onClick={onClearToken}
                className="px-3 py-2 border border-ink-900/15 text-ink-700 rounded-lg text-sm font-medium hover:bg-ink-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}
        {savedFlash && !error && <p className="text-sm text-green-600">{savedFlash}</p>}
      </div>
    </div>
  );
}
