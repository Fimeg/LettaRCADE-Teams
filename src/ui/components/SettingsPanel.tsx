import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { resetClient } from '../services/api';

const API_BASE_KEY = 'letta_api_url';
const API_KEY_STORAGE = 'letta_api_key';

export function SettingsPanel() {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const serverConnected = useAppStore((s) => s.serverConnected);
  const setServerConnected = useAppStore((s) => s.setServerConnected);

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
