/**
 * Slash command implementations using native Letta client API
 */

import type { Letta } from '@letta-ai/letta-client';
import { getLettaClient } from './api';

async function listAgentBlocks(agentId: string): Promise<Letta.BlockResponse[]> {
  const client = getLettaClient();
  const blocks: Letta.BlockResponse[] = [];
  for await (const b of client.agents.blocks.list(agentId)) blocks.push(b);
  return blocks;
}

export interface SlashCommandResult {
  success: boolean;
  message: string;
  action?: 'clear_messages' | 'reload_agent' | 'refresh_conversations';
}

export type SlashCommandExecutor = (
  agentId: string,
  conversationId: string | null,
  args: string
) => Promise<SlashCommandResult>;

/**
 * /doctor - Audit memory blocks
 * Lists all memory blocks and their sizes to diagnose memory issues
 */
const doctorCommand: SlashCommandExecutor = async (agentId) => {
  try {
    const blocks = await listAgentBlocks(agentId);

    if (blocks.length === 0) {
      return {
        success: true,
        message: 'No memory blocks found for this agent.',
      };
    }

    const blockDetails = blocks.map(b => {
      const valueLength = b.value?.length || 0;
      const limit = b.limit || 'unlimited';
      const pressure = b.limit ? Math.round((valueLength / b.limit) * 100) : 0;
      return `- ${b.label}: ${valueLength} chars (limit: ${limit}, ${pressure}%)`;
    }).join('\n');

    return {
      success: true,
      message: `Memory Health Report:\n${blockDetails}\n\nTotal blocks: ${blocks.length}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Doctor check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * /clear - Create new conversation
 * Clears in-context messages by creating a fresh conversation
 */
const clearCommand: SlashCommandExecutor = async (agentId) => {
  try {
    const newConversation = await getLettaClient().conversations.create({ agent_id: agentId });

    return {
      success: true,
      message: `New conversation created: ${newConversation.id.slice(0, 8)}`,
      action: 'clear_messages',
    };
  } catch (error) {
    return {
      success: false,
      message: `Clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * /remember - Store text to archival memory
 * Stores the provided text as a passage in archival memory
 */
const rememberCommand: SlashCommandExecutor = async (agentId, _conversationId, args) => {
  if (!args.trim()) {
    return {
      success: false,
      message: 'Usage: /remember <text to remember>',
    };
  }

  try {
    const result = await getLettaClient().agents.passages.create(agentId, { text: args.trim() });
    // SDK may return a single passage or a list; extract id defensively.
    const first = Array.isArray(result) ? result[0] : result;
    const id = (first as { id?: string } | undefined)?.id ?? '';
    const suffix = id ? ` (passage ${id.slice(0, 8)})` : '';
    return {
      success: true,
      message: `Stored to archival memory${suffix}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Remember failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * /recompile - Force agent memory recompilation
 * Re-saves each memory block with its current value. The server recomputes
 * the compiled system prompt on block write, so this triggers a refresh
 * without changing any user-visible content.
 */
const recompileCommand: SlashCommandExecutor = async (agentId) => {
  try {
    const blocks = await listAgentBlocks(agentId);
    if (blocks.length === 0) {
      return { success: false, message: 'No memory blocks to recompile.' };
    }

    const client = getLettaClient();
    let rewritten = 0;
    for (const block of blocks) {
      if (!block.label) continue;
      const existing = (block as { content?: unknown; value?: unknown });
      let text = '';
      if (typeof existing.content === 'string') {
        text = existing.content;
      } else if (existing.content && typeof existing.content === 'object' && 'text' in existing.content) {
        text = String((existing.content as { text?: unknown }).text ?? '');
      } else if (typeof existing.value === 'string') {
        text = existing.value;
      }
      await client.agents.blocks.update(block.label, { agent_id: agentId, value: text });
      rewritten++;
    }

    return {
      success: true,
      message: `Recompiled ${rewritten} memory block${rewritten === 1 ? '' : 's'}`,
      action: 'reload_agent',
    };
  } catch (error) {
    return {
      success: false,
      message: `Recompile failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

export const slashCommandHandlers: Record<string, SlashCommandExecutor> = {
  doctor: doctorCommand,
  clear: clearCommand,
  remember: rememberCommand,
  recompile: recompileCommand,
};
