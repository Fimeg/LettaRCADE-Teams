interface BasicInfoStepProps {
  name: string;
  description: string;
  tags: string;
  onChange: (field: 'name' | 'description' | 'tags', value: string) => void;
  errors: Record<string, string>;
}

export function BasicInfoStep({ name, description, tags, onChange, errors }: BasicInfoStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink-700 mb-1">
          Agent Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g., MyAssistant"
          className={`w-full px-3 py-2 rounded-lg border ${
            errors.name ? 'border-red-300' : 'border-ink-900/10'
          } bg-surface focus:border-accent focus:outline-none`}
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-700 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="What does this agent do?"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-ink-900/10 bg-surface focus:border-accent focus:outline-none resize-vertical"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-700 mb-1">
          Tags
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => onChange('tags', e.target.value)}
          placeholder="assistant, helper, research (comma-separated)"
          className="w-full px-3 py-2 rounded-lg border border-ink-900/10 bg-surface focus:border-accent focus:outline-none"
        />
        <p className="mt-1 text-xs text-muted">Separate tags with commas</p>
      </div>
    </div>
  );
}
