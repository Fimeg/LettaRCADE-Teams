import { useMemo } from 'react';
import { FileText, MessageSquareQuote, Users, Vote } from 'lucide-react';
import { councilStatusClasses, formatCouncilStatus, formatTimestamp } from './utils';

interface CouncilSessionDetailProps {
  detail: TeamsCouncilSessionDetail;
}

export function CouncilSessionDetail({ detail }: CouncilSessionDetailProps) {
  const { meta, opinionsByTurn, synthesisByTurn, finalPlan } = detail;
  const turnEntries = useMemo(
    () => Object.keys(meta.turns).sort((a, b) => Number(a) - Number(b)),
    [meta.turns],
  );
  const statusClassName = councilStatusClasses[meta.status] ?? councilStatusClasses.running;

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-ink-900">Council session</h3>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClassName}`}>
                  {formatCouncilStatus(meta.status)}
                </span>
              </div>
              <p className="mt-2 break-all text-sm text-ink-500">{meta.sessionId}</p>
            </div>

            <dl className="grid gap-3 text-sm text-ink-700 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Current turn</dt>
                <dd className="mt-1">{meta.currentTurn} / {meta.maxTurns}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Updated</dt>
                <dd className="mt-1">{formatTimestamp(meta.updatedAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div>
              <h4 className="text-sm font-semibold text-ink-900">Prompt</h4>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-surface px-4 py-4 text-sm text-ink-800">
                {meta.prompt}
              </pre>

              {meta.message && (
                <>
                  <h4 className="mt-5 text-sm font-semibold text-ink-900">Operator message</h4>
                  <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-surface px-4 py-4 text-sm text-ink-800">
                    {meta.message}
                  </pre>
                </>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-ink-900/10 bg-surface px-4 py-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-accent" />
                  <h4 className="text-sm font-semibold text-ink-900">Participants</h4>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {meta.participants.map((participant) => (
                    <span key={participant} className="rounded-full bg-surface-cream px-2.5 py-1 text-xs font-medium text-ink-700">
                      {participant}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-ink-500">Lead {meta.leadName ?? 'auto'}</p>
              </div>

              {meta.error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
                  {meta.error}
                </div>
              )}

              {meta.finalDecision && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4">
                  <h4 className="text-sm font-semibold text-green-900">Final decision</h4>
                  <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-green-900">
                    {meta.finalDecision}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {turnEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-900/15 bg-surface-cream px-5 py-10 text-center text-sm text-ink-600">
              No council turns have been recorded yet.
            </div>
          ) : turnEntries.map((turnKey) => {
            const turn = meta.turns[turnKey];
            const opinions = opinionsByTurn[turnKey] ?? [];
            const synthesis = synthesisByTurn[turnKey];

            return (
              <div key={turnKey} className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-ink-900">Turn {turn.turn}</h4>
                    <p className="mt-1 text-sm text-ink-500">
                      Started {formatTimestamp(turn.startedAt)} · Completed {formatTimestamp(turn.completedAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-surface-cream px-2.5 py-1 font-medium text-ink-600">
                      {turn.opinionSubmittedBy.length} opinions
                    </span>
                    <span className="rounded-full bg-surface-cream px-2.5 py-1 font-medium text-ink-600">
                      {Object.keys(turn.votesBy).length} votes
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <MessageSquareQuote className="h-4 w-4 text-accent" />
                      <h5 className="text-sm font-semibold text-ink-900">Opinions</h5>
                    </div>

                    {opinions.length === 0 ? (
                      <p className="text-sm text-ink-600">No recorded opinions for this turn yet.</p>
                    ) : opinions.map((opinion) => (
                      <div key={`${opinion.agentName}-${opinion.createdAt}`} className="rounded-xl border border-ink-900/10 bg-surface px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink-900">{opinion.agentName}</span>
                          <span className="rounded-full bg-surface-cream px-2 py-0.5 text-[11px] font-medium text-ink-600">
                            {opinion.side}
                          </span>
                          <span className="text-xs text-ink-500">{formatTimestamp(opinion.createdAt)}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-ink-800">{opinion.position}</p>
                        {opinion.proposal && <p className="mt-3 text-sm text-ink-700"><span className="font-medium">Proposal:</span> {opinion.proposal}</p>}
                        {opinion.evidence?.length ? <p className="mt-3 text-xs text-ink-600">Evidence: {opinion.evidence.join(' · ')}</p> : null}
                        {opinion.risks?.length ? <p className="mt-2 text-xs text-red-700">Risks: {opinion.risks.join(' · ')}</p> : null}
                        {opinion.openQuestions?.length ? <p className="mt-2 text-xs text-ink-600">Open questions: {opinion.openQuestions.join(' · ')}</p> : null}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Vote className="h-4 w-4 text-accent" />
                      <h5 className="text-sm font-semibold text-ink-900">Votes & synthesis</h5>
                    </div>

                    <div className="rounded-xl border border-ink-900/10 bg-surface px-4 py-4">
                      {Object.keys(turn.votesBy).length === 0 ? (
                        <p className="text-sm text-ink-600">No recorded votes for this turn yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(turn.votesBy).map(([agentName, vote]) => (
                            <div key={agentName} className="rounded-lg bg-white px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-ink-900">{agentName}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${vote === 'agree' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {vote}
                                </span>
                              </div>
                              {turn.notesBy[agentName] && (
                                <p className="mt-2 text-sm text-ink-700">{turn.notesBy[agentName]}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-ink-900/10 bg-surface px-4 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-accent" />
                        <h6 className="text-sm font-semibold text-ink-900">Turn synthesis</h6>
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-ink-800">
                        {synthesis ?? 'No synthesis saved for this turn yet.'}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-ink-900/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <h4 className="text-base font-semibold text-ink-900">Final plan</h4>
          <pre className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-surface px-4 py-4 text-sm text-ink-800">
            {finalPlan ?? 'No final plan has been written yet.'}
          </pre>
        </section>
      </div>
    </div>
  );
}

export default CouncilSessionDetail;
