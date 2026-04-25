import { MemoryHealth } from '../utils/memoryHealth';

interface MemoryPressureGaugeProps {
  health: MemoryHealth;
  size?: number;
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

  // Tokens are real tiktoken counts (cl100k_base). The "limit" shown next to
  // them is a token-equivalent of the server's char limit (~chars/4 — a
  // rough rule, but the limit is a server-side char cap so converting back
  // to tokens for display lets users compare like-with-like.)
  const totalLimit = health.blockHealths.reduce((sum, b) => sum + b.limit, 0);
  const totalTokens = health.totalTokens;
  const limitTokens = totalLimit > 0 ? Math.round(totalLimit / 4) : 0;

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
        <div className="text-xs text-ink-500" title="Real tiktoken counts using cl100k_base (close approximation for Claude / GPT-4)">
          Tokens (cl100k)
        </div>
        <div className="text-sm font-medium text-ink-900">
          {formatNumber(totalTokens)}
          {limitTokens > 0 && (
            <span className="text-ink-500 font-normal"> / ~{formatNumber(limitTokens)}</span>
          )}
        </div>
        <div className="text-[11px] text-ink-500">
          {health.blocksWithLimits} of {health.totalBlocks} blocks with limits
        </div>
      </div>
    </div>
  );
}
