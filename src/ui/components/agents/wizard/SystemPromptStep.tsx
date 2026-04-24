interface SystemPromptStepProps {
  value: string;
  onChange: (value: string) => void;
}

const TEMPLATES = [
  {
    name: 'Helpful Assistant',
    prompt: 'You are a helpful AI assistant. You provide clear, accurate, and concise responses to user questions. You should be friendly and professional in your tone.',
  },
  {
    name: 'Code Expert',
    prompt: 'You are an expert software engineer. You write clean, efficient, and well-documented code. You explain your reasoning and provide best practices. You can help with debugging, architecture, and code reviews.',
  },
  {
    name: 'Research Assistant',
    prompt: 'You are a research assistant. You help users find, analyze, and synthesize information. You cite sources when possible and indicate when information is uncertain. You encourage critical thinking.',
  },
];

export function SystemPromptStep({ value, onChange }: SystemPromptStepProps) {
  return (
    <div className="space-y-4">
      {/* Templates */}
      <div>
        <label className="block text-sm font-medium text-ink-700 mb-2">
          Quick Start Templates
        </label>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((template) => (
            <button
              key={template.name}
              onClick={() => onChange(template.prompt)}
              className="px-3 py-1.5 text-xs rounded-lg bg-surface-cream border border-ink-900/10 hover:border-accent hover:text-accent transition-colors"
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-sm font-medium text-ink-700 mb-1">
          System Prompt
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Define your agent's persona, behavior, and capabilities..."
          rows={12}
          className="w-full px-3 py-2 rounded-lg border border-ink-900/10 bg-surface focus:border-accent focus:outline-none resize-vertical font-mono text-sm"
        />
        <div className="flex justify-between mt-1">
          <p className="text-xs text-muted">
            This defines how your agent behaves and responds
          </p>
          <span className="text-xs text-muted">{value.length} chars</span>
        </div>
      </div>
    </div>
  );
}
