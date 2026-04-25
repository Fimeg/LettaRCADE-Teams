/**
 * Token counting using js-tiktoken (pure JS, browser-safe).
 *
 * Uses cl100k_base — the encoding shared by GPT-4 and a close approximation
 * for Claude/Letta agents (within ~10% of Anthropic's actual tokenizer).
 * Good enough for a UI pressure gauge; do not use for billing math.
 *
 * The encoder is lazy-loaded to avoid blocking app startup with the BPE
 * ranks file (~1MB JSON).
 */

import { getEncoding, type Tiktoken } from 'js-tiktoken';

let encoderInstance: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!encoderInstance) {
    encoderInstance = getEncoding('cl100k_base');
  }
  return encoderInstance;
}

/** Count tokens in a string. Returns 0 for empty input.
 *  Falls back to chars/4 if tiktoken throws (defensive — shouldn't happen). */
export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return getEncoder().encode(text).length;
  } catch {
    return Math.round(text.length / 4);
  }
}
