/**
 * Letta Teams view — placeholder stub.
 *
 * Locks in the nav slot so the Teams integration has a home once it lands.
 * Replace contents when wiring against the Letta Teams API.
 */
export function TeamsView() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-surface px-6 py-12">
      <div className="max-w-xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10">
          <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-4a4 4 0 100-8 4 4 0 000 8zm6 4a3 3 0 100-6 3 3 0 000 6zM6 14a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Letta Teams</h1>
          <p className="mt-2 text-sm text-ink-600">
            Coordinate multi-agent workflows where agents collaborate on shared
            goals, hand off context, and run under team-level memory and policy.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-ink-900/15 bg-surface-cream px-5 py-6 text-left space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-500">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            Coming soon
          </div>
          <ul className="text-sm text-ink-700 space-y-2 list-disc list-inside marker:text-accent">
            <li>Assemble named teams from existing agents</li>
            <li>Route a conversation through the team's lead agent</li>
            <li>Shared memory blocks scoped to a team</li>
            <li>Role prompts + hand-off rules</li>
          </ul>
        </div>

        <p className="text-xs text-ink-500">
          This slot is reserved so the integration point isn't forgotten — the
          actual wiring lands when the Teams backend lands.
        </p>
      </div>
    </div>
  );
}

export default TeamsView;
