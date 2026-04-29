import { useMemo, useState, type FormEvent } from 'react';
import { Loader2, RefreshCw, Users, Workflow } from 'lucide-react';
import { Button } from '../ui/primitives/Button';
import { Input } from '../ui/primitives/Input';
import { FormField } from '../ui/composites/FormField';
import { SplitPaneDivider, SplitPaneGroup, SplitPanePanel } from '../ui/layout/SplitPane';
import { cn } from '../../utils/cn';
import CouncilSessionDetail from './CouncilSessionDetail';
import { councilStatusClasses, formatCouncilStatus, formatTimestamp } from './utils';

interface TeamsCouncilsViewProps {
  teammates: TeamsTeammateState[];
  sessions: TeamsCouncilSessionMeta[];
  selectedSessionId: string | null;
  selectedSessionDetail: TeamsCouncilSessionDetail | null;
  isStartingCouncil: boolean;
  isRefreshingCouncils: boolean;
  onRefreshCouncils: () => void;
  onSelectCouncilSession: (sessionId: string) => void;
  onStartCouncil: (input: TeamsCouncilStartInput) => Promise<void>;
}

export function TeamsCouncilsView({
  teammates,
  sessions,
  selectedSessionId,
  selectedSessionDetail,
  isStartingCouncil,
  isRefreshingCouncils,
  onRefreshCouncils,
  onSelectCouncilSession,
  onStartCouncil,
}: TeamsCouncilsViewProps) {
  const [form, setForm] = useState({
    prompt: '',
    message: '',
    maxTurns: '5',
    participantNames: [] as string[],
  });

  const participantOptions = useMemo(
    () => teammates.map((teammate) => teammate.name).sort((a, b) => a.localeCompare(b)),
    [teammates],
  );

  const toggleParticipant = (name: string) => {
    setForm((current) => ({
      ...current,
      participantNames: current.participantNames.includes(name)
        ? current.participantNames.filter((item) => item !== name)
        : [...current.participantNames, name],
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const prompt = form.prompt.trim();
    if (!prompt) {
      return;
    }

    await onStartCouncil({
      prompt,
      message: form.message.trim() || undefined,
      maxTurns: Number(form.maxTurns) > 0 ? Number(form.maxTurns) : undefined,
      participantNames: form.participantNames.length > 0 ? form.participantNames : undefined,
    });

    setForm((current) => ({
      ...current,
      prompt: '',
      message: '',
    }));
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <section className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-2">
          <Workflow className="h-4 w-4 text-accent" />
          <h3 className="text-base font-semibold text-ink-900">Start council</h3>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField label="Prompt">
            <textarea
              value={form.prompt}
              onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
              placeholder="Should we refactor the session lifecycle before adding workflow automation?"
              className="min-h-28 w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-accent/50"
            />
          </FormField>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_160px]">
            <FormField label="Operator message (optional)">
              <textarea
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="Prioritize user-facing impact and call out any migration risks."
                className="min-h-24 w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-accent/50"
              />
            </FormField>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">Max turns</label>
              <Input
                type="number"
                min={1}
                max={12}
                value={form.maxTurns}
                onChange={(event) => setForm((current) => ({ ...current, maxTurns: event.target.value }))}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <label className="text-xs font-medium uppercase tracking-wide text-ink-500">Participants (optional)</label>
            </div>

            <div className="flex flex-wrap gap-2">
              {participantOptions.map((name) => {
                const selected = form.participantNames.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleParticipant(name)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      selected
                        ? 'bg-accent text-white'
                        : 'bg-surface-cream text-ink-700 hover:bg-accent/10 hover:text-accent',
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-xs text-ink-500">
              Leave this empty to use the SDK default participant set.
            </p>
          </div>

          <Button type="submit" isLoading={isStartingCouncil} disabled={!form.prompt.trim()}>
            Start council session
          </Button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-ink-900/10 bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="border-b border-ink-900/10 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink-900">Council sessions</h3>
              <p className="text-sm text-ink-600">Track turn progress, synthesis, and the final plan for each council.</p>
            </div>

            <Button
              size="sm"
              variant="secondary"
              leftIcon={isRefreshingCouncils ? Loader2 : RefreshCw}
              onClick={onRefreshCouncils}
              isLoading={isRefreshingCouncils}
            >
              Refresh councils
            </Button>
          </div>
        </div>

        <div className="h-[760px]">
          <SplitPaneGroup orientation="horizontal" defaultLayout={[32, 68]} storageKey="teams-councils-pane">
            <SplitPanePanel minSize={24} defaultSize={32}>
              <div className="h-full overflow-y-auto px-4 py-4">
                <div className="space-y-3">
                  {sessions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-ink-900/15 bg-surface-cream px-4 py-6 text-sm text-ink-600">
                      No council sessions yet.
                    </div>
                  ) : sessions.map((session) => {
                    const selected = selectedSessionId === session.sessionId;
                    const statusClassName = councilStatusClasses[session.status] ?? councilStatusClasses.running;

                    return (
                      <button
                        key={session.sessionId}
                        type="button"
                        onClick={() => onSelectCouncilSession(session.sessionId)}
                        className={cn(
                          'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                          selected
                            ? 'border-accent bg-accent/5 shadow-sm'
                            : 'border-ink-900/10 bg-surface hover:border-accent/40 hover:bg-accent/5',
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink-900">Turn {session.currentTurn}/{session.maxTurns}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClassName}`}>
                            {formatCouncilStatus(session.status)}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-ink-700">{session.prompt}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
                          <span>{session.participants.length} participants</span>
                          <span>{formatTimestamp(session.updatedAt)}</span>
                        </div>
                        <p className="mt-2 break-all text-[11px] text-ink-400">{session.sessionId}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </SplitPanePanel>

            <SplitPaneDivider orientation="horizontal" />

            <SplitPanePanel minSize={40} defaultSize={68}>
              {selectedSessionDetail ? (
                <CouncilSessionDetail detail={selectedSessionDetail} />
              ) : (
                <div className="flex h-full items-center justify-center bg-surface px-6 py-10 text-center">
                  <div className="max-w-md space-y-3">
                    <h4 className="text-lg font-semibold text-ink-900">No council selected</h4>
                    <p className="text-sm text-ink-600">
                      Start a council or choose one from the left to inspect its turns, synthesis, and final plan.
                    </p>
                  </div>
                </div>
              )}
            </SplitPanePanel>
          </SplitPaneGroup>
        </div>
      </section>
    </div>
  );
}

export default TeamsCouncilsView;
