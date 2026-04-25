import { useState, useCallback } from 'react';
import { StepIndicator } from './wizard/StepIndicator';
import { BasicInfoStep } from './wizard/BasicInfoStep';
import { ModelSelectionStep } from './wizard/ModelSelectionStep';
import { SystemPromptStep } from './wizard/SystemPromptStep';
import { ToolAccessStep } from './wizard/ToolAccessStep';
import { ReviewStep } from './wizard/ReviewStep';
import { getLettaClient } from '../../services/api';

interface AgentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (agentId: string) => void;
}

interface WizardData {
  name: string;
  description: string;
  tags: string;
  model: string;
  systemPrompt: string;
  selectedTools: string[];
}

const STEPS = ['Basic Info', 'Model', 'System', 'Tools', 'Review'];

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5-20250929';
const DEFAULT_LLM_KEY = 'letta_default_llm';

function getDefaultModel(): string {
  try {
    const stored = localStorage.getItem(DEFAULT_LLM_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function AgentWizard({ isOpen, onClose, onCreated }: AgentWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [data, setData] = useState<WizardData>(() => ({
    name: '',
    description: '',
    tags: '',
    model: getDefaultModel(),
    systemPrompt: '',
    selectedTools: [],
  }));

  const updateData = useCallback((field: keyof WizardData, value: string | string[]) => {
    setData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error when field is updated
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [validationErrors]);

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!data.name.trim()) {
        errors.name = 'Agent name is required';
      } else if (data.name.length < 2) {
        errors.name = 'Name must be at least 2 characters';
      }
    }

    if (step === 2) {
      if (!data.model) {
        errors.model = 'Please select a model';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError(null);
  };

  const handleStepClick = (step: number) => {
    // Allow going back to any previous step
    if (step < currentStep) {
      setCurrentStep(step);
      setError(null);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);

    try {
      // Parse tags
      const tags = data.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      // Create agent
      const client = getLettaClient();
      const systemPrompt = data.systemPrompt.trim();
      const agent = await client.agents.create({
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        model: data.model,
        embedding: 'openai/text-embedding-3-small',
        memory_blocks: [
          { label: 'persona', value: systemPrompt || 'I am a helpful assistant.' },
          { label: 'human', value: 'User information will be stored here.' },
        ],
        system: systemPrompt || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });

      // Attach tools if selected
      if (data.selectedTools.length > 0) {
        for (const toolId of data.selectedTools) {
          try {
            await client.agents.tools.attach(toolId, { agent_id: agent.id });
          } catch (err) {
            console.warn(`Failed to attach tool ${toolId}:`, err);
          }
        }
      }

      // Reset and close
      setCurrentStep(1);
      setData({
        name: '',
        description: '',
        tags: '',
        model: getDefaultModel(),
        systemPrompt: '',
        selectedTools: [],
      });

      onCreated?.(agent.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] bg-surface rounded-2xl shadow-xl overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-900/10">
          <h2 className="text-lg font-semibold text-ink-900">Create New Agent</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-ink-500 hover:bg-ink-900/10 hover:text-ink-700 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 border-b border-ink-900/10">
          <StepIndicator steps={STEPS} currentStep={currentStep} onStepClick={handleStepClick} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 1 && (
            <BasicInfoStep
              name={data.name}
              description={data.description}
              tags={data.tags}
              onChange={(field, value) => updateData(field as keyof WizardData, value)}
              errors={validationErrors}
            />
          )}

          {currentStep === 2 && (
            <ModelSelectionStep
              selectedModel={data.model}
              onSelect={(model) => updateData('model', model)}
            />
          )}

          {currentStep === 3 && (
            <SystemPromptStep
              value={data.systemPrompt}
              onChange={(value) => updateData('systemPrompt', value)}
            />
          )}

          {currentStep === 4 && (
            <ToolAccessStep
              selectedTools={data.selectedTools}
              onChange={(tools) => updateData('selectedTools', tools)}
            />
          )}

          {currentStep === 5 && (
            <ReviewStep
              data={data}
              onEdit={setCurrentStep}
              onCreate={handleCreate}
              isCreating={isCreating}
              error={error}
            />
          )}
        </div>

        {/* Footer */}
        {currentStep < 5 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-ink-900/10">
            <button
              onClick={handleBack}
              disabled={currentStep === 1 || isCreating}
              className="px-4 py-2 text-sm font-medium rounded-lg text-ink-600 hover:bg-ink-900/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
