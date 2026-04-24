import { MemoryHealth } from '../utils/memoryHealth';

interface MemoryPressureGaugeProps {
  health: MemoryHealth;
  size?: number;
}

/** Rough char-to-token estimate. Good enough for a UI gauge; exact tokenization
 *  depends on the model. ~4 chars/token is the standard ballpark. */
function estimateTokens(chars: number): number {
  return Math.round(chars / 4);
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toString();
}

export function MemoryPressureGauge({ health, size = 96 }: MemoryPressureGaugeProps) {
  const pressure = Math.min(Math.max(health.overallPressure, 0), 1);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pressure);

  const color =
    pressure > 0.85 ? '#ef4444' : pressure > 0.7 ? '#f59e0b' : '#22c55e';

  const totalChars = health.blockHealths.reduce((sum, b) => sum + b.currentLength, 0);
  const totalLimit = health.blockHealths.reduce((sum, b) => sum + b.limit, 0);
  const totalTokens = estimateTokens(totalChars);
  const limitTokens = estimateTokens(totalLimit);

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={8}
            className="text-ink-900/10"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold leading-none" style={{ color }}>
            {(pressure * 100).toFixed(0)}%
          </span>
          <span className="text-[10px] text-ink-500 mt-0.5">pressure</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <div className="text-xs text-ink-500">~Tokens (est.)</div>
        <div className="text-sm font-medium text-ink-900">
          {formatNumber(totalTokens)}
          {limitTokens > 0 && (
            <span className="text-ink-500 font-normal"> / {formatNumber(limitTokens)}</span>
          )}
        </div>
        <div className="text-[11px] text-ink-500">
          {health.blocksWithLimits} of {health.totalBlocks} blocks with limits
        </div>
      </div>
    </div>
  );
}
