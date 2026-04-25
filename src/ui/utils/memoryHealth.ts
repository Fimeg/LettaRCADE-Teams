import { MemoryBlock } from '../store/useAppStore';
import { countTokens } from './tokens';

export interface BlockHealth {
  label: string;
  /** Character count of the block's value — matches the server's `limit` units. */
  currentLength: number;
  /** Character limit set on the block (0 = no limit). */
  limit: number;
  /** chars / limit, in [0, ∞). */
  pressure: number;
  /** Real tiktoken count (cl100k_base) for display. */
  tokens: number;
  tier: string;
}

export interface MemoryHealth {
  overallPressure: number;
  needsAttention: boolean;
  blockHealths: BlockHealth[];
  totalBlocks: number;
  blocksWithLimits: number;
  /** Sum of real tokens across all blocks. */
  totalTokens: number;
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
    const value = extractBlockValue(block);
    const currentLength = value.length;
    const limit = block.limit ?? 0;
    const pressure = limit > 0 ? currentLength / limit : 0;

    return {
      label: block.label,
      currentLength,
      limit,
      pressure,
      tokens: countTokens(value),
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
    totalTokens: blockHealths.reduce((sum, bh) => sum + bh.tokens, 0),
  };
}

/** Resolve a block's text from either the new `content` field (SDK 0.1.14+)
 *  or the legacy `value` field. Returns '' if neither yields a string. */
function extractBlockValue(block: MemoryBlock): string {
  if (typeof block.value === 'string') return block.value;
  if (typeof block.content === 'string') return block.content;
  if (block.content && typeof block.content === 'object' && 'text' in block.content) {
    const t = (block.content as { text?: unknown }).text;
    if (typeof t === 'string') return t;
  }
  return '';
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
