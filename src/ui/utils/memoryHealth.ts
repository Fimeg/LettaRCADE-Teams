import { MemoryBlock } from '../store/useAppStore';

export interface BlockHealth {
  label: string;
  currentLength: number;
  limit: number;
  pressure: number;
  tier: string;
}

export interface MemoryHealth {
  overallPressure: number;
  needsAttention: boolean;
  blockHealths: BlockHealth[];
  totalBlocks: number;
  blocksWithLimits: number;
}

export function classifyTier(label: string): string {
  if (label === 'persona' || label === 'human') return 'resident';
  if (label.startsWith('deep__')) return 'deep';
  if (label.startsWith('working__')) return 'working';
  if (label.startsWith('ephemeral__')) return 'ephemeral';
  return 'default';
}

export function calculateMemoryHealth(blocks: MemoryBlock[]): MemoryHealth {
  const blockHealths: BlockHealth[] = blocks.map(block => {
    const value = typeof block.value === 'string' ? block.value : '';
    const currentLength = value.length;
    const limit = block.limit ?? 0;
    const pressure = limit > 0 ? currentLength / limit : 0;

    return {
      label: block.label,
      currentLength,
      limit,
      pressure,
      tier: classifyTier(block.label),
    };
  });

  const blocksWithLimits = blockHealths.filter(bh => bh.limit > 0);
  const overallPressure = blocksWithLimits.length > 0
    ? blocksWithLimits.reduce((sum, bh) => sum + bh.pressure, 0) / blocksWithLimits.length
    : 0;

  return {
    overallPressure,
    needsAttention: overallPressure > 0.7 || blockHealths.some(bh => bh.pressure > 0.9),
    blockHealths,
    totalBlocks: blocks.length,
    blocksWithLimits: blocksWithLimits.length,
  };
}

export function getPressureColor(pressure: number): string {
  if (pressure > 0.85) return 'error';
  if (pressure > 0.7) return 'warning';
  if (pressure > 0.5) return 'amber';
  return 'success';
}

export const tierColors: Record<string, string> = {
  resident: '#8b5cf6',
  deep: '#4f46e5',
  working: '#22c55e',
  ephemeral: '#f97316',
  default: '#71717a',
};
