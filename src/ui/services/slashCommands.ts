/**
 * Slash command implementations using native Letta client API
 */

import { agentsApi, conversationsApi } from './api';

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
    const blocks = await agentsApi.getMemoryBlocks(agentId);

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
    const newConversation = await conversationsApi.createConversation(agentId);

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
    const passage = await agentsApi.createPassage(agentId, args.trim());

    return {
      success: true,
      message: `Stored to archival memory (passage ${passage.id.slice(0, 8)})`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Remember failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * /recompile - Update agent with refreshed config
 * Triggers agent update to refresh memory compilation
 */
const recompileCommand: SlashCommandExecutor = async (agentId) => {
  try {
    const agent = await agentsApi.getAgent(agentId);

    await agentsApi.updateAgent(agentId, {
      name: agent.name,
      description: agent.description,
    });

    return {
      success: true,
      message: 'Agent memory recompiled successfully',
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
