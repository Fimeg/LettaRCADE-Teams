interface SacredToggleProps {
  blockLabel: string;
  isSacred: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function SacredToggle({ blockLabel, isSacred, onToggle, disabled }: SacredToggleProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
        isSacred
          ? 'bg-amber-500 text-white shadow-sm'
          : 'bg-ink-900/10 text-ink-500 hover:bg-ink-900/20'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      title={isSacred
        ? `${blockLabel} is protected (local flag only — server enforcement pending)`
        : `Protect ${blockLabel} from edits (local flag only — not yet enforced server-side)`
      }
    >
      {isSacred ? (
        <>
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>Protected</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Protect</span>
        </>
      )}
    </button>
  );
}
