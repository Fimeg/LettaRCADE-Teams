import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

const API_BASE_KEY = 'letta_api_url';

export function SettingsPanel() {
  const [apiUrl, setApiUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const serverConnected = useAppStore((s) => s.serverConnected);
  const setServerConnected = useAppStore((s) => s.setServerConnected);

  // Load saved URL on mount
  useEffect(() => {
    const saved = localStorage.getItem(API_BASE_KEY) || import.meta.env.VITE_API_URL || 'http://10.10.20.19:3000';
    setApiUrl(saved);
  }, []);

  const handleSave = async () => {
    localStorage.setItem(API_BASE_KEY, apiUrl);
    setSaved(true);

    // Re-check connection with new URL
    await handleTest();

    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/agents`, { method: 'HEAD' });
      if (res.ok) {
        setServerConnected(true);
      } else {
        setServerConnected(false);
      }
    } catch {
      setServerConnected(false);
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
                API URL
              </label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:3000"
                className="w-full px-3 py-2 bg-surface border border-ink-900/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <p className="text-xs text-ink-500 mt-1">
                The URL of your Letta Community ADE server
              </p>
            </div>

            <div className="flex items-center gap-3">
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
            </div>

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
