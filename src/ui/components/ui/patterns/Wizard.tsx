import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { Button } from '../primitives/Button';
import { cn } from '../../../utils/cn';
import { ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors?: Record<string, string>;
}

export interface StepContentProps<TData> {
  data: TData;
  updateData: (updater: (prev: TData) => TData) => void;
  setField: <K extends keyof TData>(field: K, value: TData[K]) => void;
  validationErrors: Record<string, string>;
  isActive: boolean;
  isCompleted: boolean;
  onNext: () => void;
  onBack: () => void;
}

export interface WizardStep<TData = unknown> {
  id: string;
  title: string;
  description?: string;
  validate?: (data: TData) => ValidationResult;
  content: (props: StepContentProps<TData>) => React.ReactNode;
}

export interface WizardProps<TData = unknown> {
  // Required
  steps: WizardStep<TData>[];
  initialData: TData;
  onComplete: (data: TData) => void | Promise<void>;

  // Optional controlled state
  currentStep?: number;
  onStepChange?: (step: number) => void;

  // Customization
  title?: string;
  showStepIndicator?: boolean;
  allowSkipToCompleted?: boolean;
  allowSkipToVisited?: boolean;

  // Navigation labels
  nextLabel?: React.ReactNode;
  backLabel?: React.ReactNode;
  completeLabel?: React.ReactNode;

  // Loading states
  isSubmitting?: boolean;
  submitError?: string | null;

  // Layout
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  contentHeight?: 'auto' | 'fixed' | number;

  // Event handlers
  onCancel?: () => void;
  onStepValidationFail?: (step: number, errors: Record<string, string>) => void;
}

// ============================================================================
// Step Indicator Component
// ============================================================================

interface StepIndicatorProps {
  steps: Array<{ id: string; title: string; description?: string }>;
  currentStep: number;
  completedSteps: Set<number>;
  visitedSteps: Set<number>;
  allowSkipToCompleted?: boolean;
  allowSkipToVisited?: boolean;
  onStepClick?: (stepIndex: number) => void;
}

function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  visitedSteps,
  allowSkipToCompleted,
  allowSkipToVisited,
  onStepClick,
}: StepIndicatorProps) {
  const canClickStep = (stepIndex: number): boolean => {
    if (!onStepClick) return false;
    if (stepIndex === currentStep - 1) return false; // Already on this step
    if (allowSkipToCompleted && completedSteps.has(stepIndex)) return true;
    if (allowSkipToVisited && visitedSteps.has(stepIndex)) return true;
    return false;
  };

  return (
    <nav aria-label="Form steps" className="w-full">
      <ol className="flex items-center justify-center gap-1">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = completedSteps.has(index);
          const isClickable = canClickStep(index);

          return (
            <li key={step.id} className="flex items-center">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${stepNum}: ${step.title}${isCompleted ? ' (completed)' : ''}`}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-accent text-white'
                    : isCompleted
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-ink-900/5 text-ink-400',
                  isClickable && 'cursor-pointer hover:bg-opacity-80',
                  !isClickable && !isActive && 'cursor-default'
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold',
                    isActive
                      ? 'bg-white text-accent'
                      : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-ink-200 text-ink-500'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    stepNum
                  )}
                </span>
                <span className="text-xs font-medium">{step.title}</span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-8 h-px mx-1',
                    isCompleted ? 'bg-green-500' : 'bg-ink-900/10'
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ============================================================================
// Main Wizard Component
// ============================================================================

export function Wizard<TData = unknown>({
  steps,
  initialData,
  onComplete,
  currentStep: controlledStep,
  onStepChange,
  title,
  showStepIndicator = true,
  allowSkipToCompleted = true,
  allowSkipToVisited = false,
  nextLabel = 'Next',
  backLabel = 'Back',
  completeLabel = 'Complete',
  isSubmitting: externalIsSubmitting = false,
  submitError: externalSubmitError = null,
  size = 'md',
  contentHeight = 'auto',
  onCancel,
  onStepValidationFail,
}: WizardProps<TData>) {
  // Determine if we're in controlled mode
  const isControlled = controlledStep !== undefined;

  // Internal state
  const [internalStep, setInternalStep] = useState(0);
  const [data, setData] = useState<TData>(initialData);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);
  const [internalSubmitError, setInternalSubmitError] = useState<string | null>(null);

  // Use controlled or internal step
  const currentStep = isControlled ? controlledStep : internalStep;
  const isSubmitting = externalIsSubmitting || internalIsSubmitting;
  const submitError = externalSubmitError || internalSubmitError;

  // Derived state
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepConfig = steps[currentStep];

  // Size classes
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full mx-4',
  };

  // Content height styles
  const contentHeightStyle = useMemo(() => {
    if (contentHeight === 'auto') return undefined;
    if (contentHeight === 'fixed') return { height: '400px' };
    return { height: `${contentHeight}px` };
  }, [contentHeight]);

  // Update data helper
  const updateData = useCallback((updater: (prev: TData) => TData) => {
    setData((prev) => updater(prev));
  }, []);

  // Set field helper
  const setField = useCallback(<K extends keyof TData>(field: K, value: TData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error when field is updated
    if (validationErrors[field as string]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  }, [validationErrors]);

  // Validate current step
  const validateCurrentStep = useCallback((): boolean => {
    if (!currentStepConfig.validate) return true;

    const result = currentStepConfig.validate(data);
    setValidationErrors(result.errors || {});

    if (!result.valid && onStepValidationFail) {
      onStepValidationFail(currentStep, result.errors || {});
    }

    return result.valid;
  }, [currentStepConfig, data, currentStep, onStepValidationFail]);

  // Navigation handlers
  const goToStep = useCallback((stepIndex: number) => {
    if (isControlled) {
      onStepChange?.(stepIndex);
    } else {
      setInternalStep(stepIndex);
    }
    setVisitedSteps((prev) => new Set([...prev, stepIndex]));
    setInternalSubmitError(null);
  }, [isControlled, onStepChange]);

  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return;

    // Mark current step as completed
    setCompletedSteps((prev) => new Set([...prev, currentStep]));

    if (isLastStep) {
      // Complete wizard
      handleComplete();
    } else {
      goToStep(currentStep + 1);
    }
  }, [validateCurrentStep, isLastStep, currentStep, goToStep]);

  const handleBack = useCallback(() => {
    if (isFirstStep) return;
    goToStep(currentStep - 1);
    setInternalSubmitError(null);
  }, [isFirstStep, currentStep, goToStep]);

  const handleStepClick = useCallback((stepIndex: number) => {
    const isCompleted = completedSteps.has(stepIndex);
    const isVisited = visitedSteps.has(stepIndex);

    if (allowSkipToCompleted && isCompleted) {
      goToStep(stepIndex);
    } else if (allowSkipToVisited && isVisited) {
      goToStep(stepIndex);
    }
  }, [completedSteps, visitedSteps, allowSkipToCompleted, allowSkipToVisited, goToStep]);

  const handleComplete = useCallback(async () => {
    if (!validateCurrentStep()) return;

    setInternalIsSubmitting(true);
    setInternalSubmitError(null);

    try {
      await onComplete(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setInternalSubmitError(errorMessage);
    } finally {
      setInternalIsSubmitting(false);
    }
  }, [validateCurrentStep, onComplete, data]);

  // Reset on initialData change
  React.useEffect(() => {
    setData(initialData);
    if (!isControlled) {
      setInternalStep(0);
    }
    setVisitedSteps(new Set([0]));
    setCompletedSteps(new Set());
    setValidationErrors({});
    setInternalSubmitError(null);
  }, [initialData, isControlled]);

  // Sync visited steps when step changes
  React.useEffect(() => {
    setVisitedSteps((prev) => new Set([...prev, currentStep]));
  }, [currentStep]);

  // Build step content props
  const stepContentProps: StepContentProps<TData> = {
    data,
    updateData,
    setField,
    validationErrors,
    isActive: true,
    isCompleted: completedSteps.has(currentStep),
    onNext: handleNext,
    onBack: handleBack,
  };

  return (
    <div
      role="dialog"
      aria-labelledby="wizard-title"
      aria-describedby="wizard-description"
      className={cn(
        'w-full bg-surface rounded-2xl shadow-xl overflow-hidden flex flex-col',
        sizeClasses[size]
      )}
    >
      {/* Header */}
      {(title || onCancel) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-900/10">
          {title && (
            <h2 id="wizard-title" className="text-lg font-semibold text-ink-900">
              {title}
            </h2>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-lg text-ink-500 hover:bg-ink-900/10 hover:text-ink-700 transition-colors"
              aria-label="Close wizard"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Step Indicator */}
      {showStepIndicator && steps.length > 1 && (
        <div className="px-6 py-4 border-b border-ink-900/10">
          <StepIndicator
            steps={steps.map((s) => ({ id: s.id, title: s.title, description: s.description }))}
            currentStep={currentStep + 1}
            completedSteps={completedSteps}
            visitedSteps={visitedSteps}
            allowSkipToCompleted={allowSkipToCompleted}
            allowSkipToVisited={allowSkipToVisited}
            onStepClick={handleStepClick}
          />
        </div>
      )}

      {/* Error Banner */}
      {submitError && (
        <div className="px-6 py-3 bg-status-error/10 border-b border-status-error/20 flex items-center gap-2 text-sm text-status-error">
          <AlertCircle className="w-4 h-4" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Step Content */}
      <div
        className="flex-1 overflow-y-auto p-6"
        style={contentHeightStyle}
        role="tabpanel"
        aria-labelledby={`step-${currentStepConfig.id}-title`}
        tabIndex={0}
      >
        <div className="sr-only" id="wizard-description">
          Step {currentStep + 1} of {steps.length}: {currentStepConfig.title}
        </div>
        {currentStepConfig.content(stepContentProps)}
      </div>

      {/* Footer Navigation */}
      {!isLastStep && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-ink-900/10 bg-surface">
          <Button
            variant="secondary"
            onClick={handleBack}
            disabled={isFirstStep || isSubmitting}
            leftIcon={ChevronLeft}
          >
            {backLabel}
          </Button>

          <Button
            variant="primary"
            onClick={handleNext}
            disabled={isSubmitting}
            isLoading={isSubmitting}
            rightIcon={ChevronRight}
          >
            {nextLabel}
          </Button>
        </div>
      )}

      {/* Footer - Complete Step */}
      {isLastStep && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-ink-900/10 bg-surface">
          <Button
            variant="secondary"
            onClick={handleBack}
            disabled={isSubmitting}
            leftIcon={ChevronLeft}
          >
            {backLabel}
          </Button>

          <Button
            variant="primary"
            onClick={handleComplete}
            isLoading={isSubmitting}
          >
            {completeLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export interface UseWizardReturn<TData> {
  currentStep: number;
  data: TData;
  goToStep: (step: number) => void;
  next: () => void;
  back: () => void;
  updateData: (updater: (prev: TData) => TData) => void;
  setField: <K extends keyof TData>(field: K, value: TData[K]) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  reset: () => void;
}

export function useWizard<TData>(initialData: TData, totalSteps: number): UseWizardReturn<TData> {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<TData>(initialData);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
  }, [totalSteps]);

  const next = useCallback(() => {
    if (!isLastStep) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
    }
  }, [isLastStep]);

  const back = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep((prev) => Math.max(prev - 1, 0));
    }
  }, [isFirstStep]);

  const updateData = useCallback((updater: (prev: TData) => TData) => {
    setData((prev) => updater(prev));
  }, []);

  const setField = useCallback(<K extends keyof TData>(field: K, value: TData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setData(initialData);
  }, [initialData]);

  return {
    currentStep,
    data,
    goToStep,
    next,
    back,
    updateData,
    setField,
    isFirstStep,
    isLastStep,
    reset,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default Wizard;
