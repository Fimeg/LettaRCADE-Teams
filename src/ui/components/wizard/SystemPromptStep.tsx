interface SystemPromptStepProps {
  systemPrompt: string;
  onUpdate: (value: string) => void;
}

const PRESET_PROMPTS = [
  {
    label: 'Default',
    value: '',
  },
  {
    label: 'Helpful Assistant',
    value:
      'You are a helpful, harmless, and honest AI assistant. You aim to be informative while remaining neutral and objective.',
  },
  {
    label: 'Code Expert',
    value:
      'You are an expert software developer. You write clean, efficient, and well-documented code. You explain technical concepts clearly and help debug issues.',
  },
  {
    label: 'Creative Writer',
    value:
      'You are a creative writing assistant. You help with storytelling, character development, editing, and brainstorming ideas. You provide constructive feedback and suggestions.',
  },
  {
    label: 'Research Analyst',
    value:
      'You are a research analyst. You help gather information, analyze data, identify patterns, and synthesize findings into clear summaries. You cite sources when possible.',
  },
];

export function SystemPromptStep({ systemPrompt, onUpdate }: SystemPromptStepProps) {
  const selectedPreset = PRESET_PROMPTS.find((p) => p.value === systemPrompt);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-ink-800">System Prompt</h3>
        <p className="mt-1 text-sm text-ink-500">
          Define the agent&apos;s persona and behavior. This sets the initial system instructions.
        </p>
      </div>

      {/* Preset Selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-700">Quick Select</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_PROMPTS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onUpdate(preset.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedPreset?.label === preset.label
                  ? 'bg-accent text-white'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* System Prompt Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-ink-700">
            Custom System Prompt
          </label>
          <span className="text-xs text-ink-500">
            {systemPrompt.length} characters
          </span>
        </div>
        <textarea
          value={systemPrompt}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="You are a helpful assistant that..."
          rows={10}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-mono text-ink-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
      </div>

      {/* Hint */}
      <div className="rounded-lg bg-ink-50 border border-ink-200 p-3">
        <p className="text-xs text-ink-600">
          <span className="font-medium">Tip:</span> You can always edit the system prompt later in
          the Agent Detail view. Leave blank to use Letta&apos;s default system prompt.
        </p>
      </div>
    </div>
  );
}

export default SystemPromptStep;
