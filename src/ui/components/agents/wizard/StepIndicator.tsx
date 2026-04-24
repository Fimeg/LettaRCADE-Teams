interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={step} className="flex items-center">
            <button
              onClick={() => onStepClick?.(stepNum)}
              disabled={!onStepClick}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-accent text-white'
                  : isCompleted
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-ink-900/5 text-ink-400'
              } ${onStepClick ? 'cursor-pointer hover:bg-opacity-80' : 'cursor-default'}`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isActive
                    ? 'bg-white text-accent'
                    : isCompleted
                    ? 'bg-green-500 text-white'
                    : 'bg-ink-200 text-ink-500'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  stepNum
                )}
              </span>
              <span className="text-xs font-medium">{step}</span>
            </button>
            {index < steps.length - 1 && (
              <div
                className={`w-8 h-px mx-1 ${
                  isCompleted ? 'bg-green-500' : 'bg-ink-900/10'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
