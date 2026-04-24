import { useState, useCallback } from 'react';
import { BasicInfoStep } from './wizard/BasicInfoStep';
import { ModelSelectionStep } from './wizard/ModelSelectionStep';
import { ToolAccessStep } from './wizard/ToolAccessStep';
import { SystemPromptStep } from './wizard/SystemPromptStep';
import { ReviewStep } from './wizard/ReviewStep';
import { StepIndicator } from './wizard/StepIndicator';

interface AgentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (agentId: string) => void;
}

const STEPS = [
  { number: 1, title: 'Basic Info' },
  { number: 2, title: 'Model' },
  { number: 3, title: 'Tools' },
  { number: 4, title: 'System Prompt' },
  { number: 5, title: 'Review' },
];

interface FormData {
  name: string;
  description: string;
  tags: string[];
  model: string;
  toolIds: string[];
  includeBaseTools: boolean;
  systemPrompt: string;
}

const INITIAL: FormData = {
  name: '',
  description: '',
  tags: [],
  model: '',
  toolIds: [],
  includeBaseTools: true,
  systemPrompt: '',
};

export function AgentWizard({ isOpen, onClose, onCreated }: AgentWizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep(1);
    setForm(INITIAL);
    setError(null);
    setCreating(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return form.name.length >= 3;
      case 2:
        return true; // model is optional, Letta picks default
      case 3:
        return true; // tools are optional
      case 4:
        return true; // system prompt is optional
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          model: form.model || undefined,
          system: form.systemPrompt || undefined,
          tool_ids: form.toolIds.length > 0 ? form.toolIds : undefined,
          include_base_tools: form.includeBaseTools,
          tags: form.tags.length > 0 ? form.tags : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        handleClose();
        onCreated(data.data.id);
      } else {
        setError(data.error || 'Failed to create agent');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setCreating(false);
    }
  };

  const updateField = (field: keyof FormData, value: FormData[keyof FormData]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTool = (toolId: string) => {
    setForm((prev) => ({
      ...prev,
      toolIds: prev.toolIds.includes(toolId)
        ? prev.toolIds.filter((id) => id !== toolId)
        : [...prev.toolIds, toolId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl bg-surface shadow-2xl border border-border flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
            <h2 className="text-lg font-semibold text-ink-800">Create New Agent</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 border-b border-border bg-surface-secondary">
          <StepIndicator steps={STEPS} currentStep={step} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 1 && (
            <BasicInfoStep
              name={form.name}
              description={form.description}
              tags={form.tags}
              onUpdate={updateField}
            />
          )}
          {step === 2 && (
            <ModelSelectionStep
              selectedModel={form.model}
              onSelect={(m) => updateField('model', m)}
            />
          )}
          {step === 3 && (
            <ToolAccessStep
              selectedToolIds={form.toolIds}
              includeBaseTools={form.includeBaseTools}
              onToggleTool={toggleTool}
              onToggleBaseTools={(v) => updateField('includeBaseTools', v)}
            />
          )}
          {step === 4 && (
            <SystemPromptStep
              systemPrompt={form.systemPrompt}
              onUpdate={(v) => updateField('systemPrompt', v)}
            />
          )}
          {step === 5 && (
            <ReviewStep
              name={form.name}
              description={form.description}
              model={form.model}
              toolCount={form.toolIds.length}
              includeBaseTools={form.includeBaseTools}
              systemPrompt={form.systemPrompt}
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 transition-colors"
            onClick={() => (step > 1 ? setStep(step - 1) : handleClose())}
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>
          <div>
            {step < 5 ? (
              <button
                disabled={!canProceed()}
                onClick={() => setStep(step + 1)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                disabled={creating || !canProceed()}
                onClick={handleCreate}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        strokeDasharray="60"
                        strokeDashoffset="20"
                      />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                    Create Agent
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentWizard;
