import { MemoryBlock } from '../store/useAppStore';

interface BlockPressureIndicatorProps {
  block: MemoryBlock;
  showBar?: boolean;
}

export function BlockPressureIndicator({ block, showBar = true }: BlockPressureIndicatorProps) {
  const value = typeof block.value === 'string' ? block.value : '';
  const currentLength = value.length;
  const limit = block.limit;

  if (!limit || limit <= 0) return null;

  const pressure = currentLength / limit;
  const percentage = Math.min(pressure * 100, 100);

  const getColorClass = () => {
    if (pressure > 0.9) return 'bg-red-500';
    if (pressure > 0.8) return 'bg-amber-500';
    if (pressure > 0.7) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextClass = () => {
    if (pressure > 0.9) return 'text-red-600';
    if (pressure > 0.8) return 'text-amber-600';
    if (pressure > 0.7) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div
      className="flex items-center gap-1.5"
      title={`${currentLength} / ${limit} characters (${percentage.toFixed(1)}%)`}
    >
      {showBar && (
        <div className="w-12 h-1 rounded-full bg-ink-900/10 overflow-hidden">
          <div
            className={`h-full ${getColorClass()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      <span className={`text-[10px] ${getTextClass()}`}>
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}
