import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

/**
 * First-run setup gate. Letta Community ADE is single-human-per-install
 * (see CLAUDE.md). The renderer shows this view as a full takeover whenever
 * `operatorProfile === null`. Only `displayName` is required; richer fields
 * (memfs URL template, token) are deferred to Settings.
 */
export function OperatorSetupView() {
  const saveOperatorProfile = useAppStore((s) => s.saveOperatorProfile);
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = displayName.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await saveOperatorProfile({ displayName: trimmed });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-surface px-6">
      <form onSubmit={onSubmit} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-ink-900 mb-1">Welcome to Letta Community ADE</h1>
          <p className="text-sm text-ink-600">
            What should your agents call you?
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-ink-900">Your name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Casey"
            autoFocus
            className="mt-1 w-full px-3 py-2 rounded-lg border border-ink-900/15 bg-surface text-ink-900 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
          <span className="mt-1.5 block text-[11px] text-ink-500">
            Used in messages and prompts. You can change this later in Settings.
          </span>
        </label>

        {error && (
          <p className="mt-3 text-sm text-error">{error}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-6 w-full px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Continue'}
        </button>

        <p className="mt-6 text-center text-[11px] text-ink-500">
          Memfs git URL and tokens can be configured later if you use local mode.
        </p>
      </form>
    </div>
  );
}
