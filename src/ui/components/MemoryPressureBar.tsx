interface MemoryPressureBarProps {
  pressure: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function MemoryPressureBar({
  pressure,
  showLabel = true,
  size = 'md'
}: MemoryPressureBarProps) {
  const percentage = Math.min(Math.max(pressure * 100, 0), 100);

  const getColorClass = () => {
    if (pressure > 0.85) return 'bg-red-500';
    if (pressure > 0.7) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const getTextClass = () => {
    if (pressure > 0.85) return 'text-red-600';
    if (pressure > 0.7) return 'text-amber-600';
    return 'text-green-600';
  };

  const heightClass = size === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${heightClass} rounded-full bg-ink-900/10 overflow-hidden`}>
        <div
          className={`h-full transition-all duration-300 ${getColorClass()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-medium ${getTextClass()}`}>
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
}
