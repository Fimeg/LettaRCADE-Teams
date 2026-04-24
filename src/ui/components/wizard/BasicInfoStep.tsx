import { useState } from 'react';

interface BasicInfoStepProps {
  name: string;
  description: string;
  tags: string[];
  onUpdate: (field: 'name' | 'description' | 'tags', value: string | string[]) => void;
}

export function BasicInfoStep({ name, description, tags, onUpdate }: BasicInfoStepProps) {
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      onUpdate('tags', [...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdate('tags', tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      handleRemoveTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-ink-800">Basic Information</h3>
        <p className="mt-1 text-sm text-ink-500">
          Give your agent a name and description to help identify it.
        </p>
      </div>

      {/* Name Field */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-700">
          Agent Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onUpdate('name', e.target.value)}
          placeholder="e.g., Research Assistant"
          autoFocus
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {name.length > 0 && name.length < 3 && (
          <p className="text-xs text-red-500">Name must be at least 3 characters</p>
        )}
      </div>

      {/* Description Field */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => onUpdate('description', e.target.value)}
          placeholder="What does this agent do? (optional)"
          rows={3}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
      </div>

      {/* Tags Field */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink-700">Tags</label>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-xs font-medium text-accent"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="rounded p-0.5 hover:bg-accent/20"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <line x1="6" x2="18" y1="6" y2="18" />
                  <line x1="18" x2="6" y1="6" y2="18" />
                </svg>
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleAddTag}
            placeholder={tags.length === 0 ? 'Add tags (press Enter)' : ''}
            className="flex-1 min-w-[120px] border-none bg-transparent text-sm text-ink-800 focus:outline-none"
          />
        </div>
        <p className="text-xs text-ink-500">Press Enter to add a tag</p>
      </div>
    </div>
  );
}

export default BasicInfoStep;
