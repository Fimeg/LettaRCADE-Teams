import React from 'react';
import { Box, Text } from 'ink';
import { formatProgressBar, getStatusIcon, getStatusColor, formatRelativeTime, truncate, } from '../utils/format.js';
const AgentDetailsTab = ({ teammates, selectedIndex }) => {
    if (teammates.length === 0) {
        return (React.createElement(Box, { paddingX: 1, paddingY: 1, flexDirection: "column" },
            React.createElement(Text, { bold: true }, "AGENT DETAILS"),
            React.createElement(Box, { borderStyle: "single", borderColor: "gray", paddingX: 1 },
                React.createElement(Text, { dimColor: true }, "No agents found. Use 'letta-teams spawn <name> <role>' to create one."))));
    }
    const selectedAgent = teammates[selectedIndex];
    return (React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1 },
        React.createElement(Text, { bold: true },
            "AGENT DETAILS (",
            teammates.length,
            ") - \u2190\u2192 to select"),
        React.createElement(Box, { borderStyle: "single", borderColor: "gray", marginBottom: 1 }, teammates.map((agent, index) => {
            const isSelected = index === selectedIndex;
            const icon = getStatusIcon(agent.status);
            const color = getStatusColor(agent.status);
            return (React.createElement(Box, { key: agent.name, paddingX: 1 },
                React.createElement(Text, { bold: isSelected, color: isSelected ? 'white' : undefined, inverse: isSelected },
                    React.createElement(Text, { color: color }, icon),
                    ' ',
                    isSelected ? '[' : '',
                    truncate(agent.name, 12),
                    isSelected ? ']' : '')));
        })),
        selectedAgent && (React.createElement(AgentCard, { agent: selectedAgent }))));
};
/**
 * Full detail card for a single agent
 */
const AgentCard = ({ agent }) => {
    const statusColor = getStatusColor(agent.status);
    const icon = getStatusIcon(agent.status);
    const memfsEnabled = agent.memfsEnabled !== false;
    const rootConversationId = agent.targets?.find(t => t.kind === 'root')?.conversationId;
    const summary = agent.statusSummary;
    const activeTodo = agent.todoItems?.find((item) => item.id === summary?.currentTodoId);
    return (React.createElement(Box, { flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 1 },
        React.createElement(Box, null,
            React.createElement(Text, { bold: true, color: "cyan" },
                icon,
                " ",
                agent.name),
            React.createElement(Text, { dimColor: true },
                " - ",
                agent.role)),
        React.createElement(Box, { marginTop: 1 },
            React.createElement(Text, { dimColor: true }, "Agent ID: "),
            React.createElement(Text, null, agent.agentId)),
        agent.model && (React.createElement(Box, null,
            React.createElement(Text, { dimColor: true }, "Model: "),
            React.createElement(Text, null, agent.model))),
        rootConversationId && (React.createElement(Box, null,
            React.createElement(Text, { dimColor: true }, "Conversation: "),
            React.createElement(Text, null, truncate(rootConversationId, 40)))),
        React.createElement(Box, null,
            React.createElement(Text, { dimColor: true }, "Memfs status: "),
            React.createElement(Text, { color: memfsEnabled ? 'green' : 'gray' }, memfsEnabled ? 'enabled' : 'disabled')),
        memfsEnabled && agent.memfsLastSyncedAt && (React.createElement(Box, null,
            React.createElement(Text, { dimColor: true }, "Last synced: "),
            React.createElement(Text, null, formatRelativeTime(agent.memfsLastSyncedAt)),
            React.createElement(Text, { dimColor: true },
                " (",
                agent.memfsLastSyncedAt,
                ")"))),
        React.createElement(Box, { marginTop: 1 },
            React.createElement(Text, { dimColor: true }, "Status: "),
            React.createElement(Text, { color: statusColor, bold: true }, agent.status)),
        summary?.progress !== undefined && (React.createElement(Box, null,
            React.createElement(Text, { dimColor: true }, "Progress: "),
            React.createElement(Text, { color: statusColor }, formatProgressBar(summary.progress, 20)),
            React.createElement(Text, null,
                " ",
                summary.progress,
                "%"))),
        summary?.message && (React.createElement(Box, { marginTop: 1 },
            React.createElement(Text, { dimColor: true }, "Status Summary:"))),
        summary?.message && (React.createElement(Box, { paddingX: 2 },
            React.createElement(Text, { color: "yellow" },
                summary.phase,
                " - ",
                summary.message))),
        activeTodo && (React.createElement(Box, { paddingX: 2 },
            React.createElement(Text, { dimColor: true }, "Current Todo: "),
            React.createElement(Text, null, activeTodo.title))),
        summary?.phase === 'blocked' && (React.createElement(Box, { marginTop: 1 },
            React.createElement(Text, { dimColor: true }, "Problem: "),
            React.createElement(Text, { color: "red" }, summary.message))),
        agent.errorDetails && (React.createElement(Box, { paddingX: 2 },
            React.createElement(Text, { color: "red" }, truncate(agent.errorDetails, 200)))),
        agent.todoItems && agent.todoItems.length > 0 && (React.createElement(Box, { marginTop: 1, flexDirection: "column" },
            React.createElement(Text, { dimColor: true },
                "Todo Items (",
                agent.todoItems.length,
                "):"),
            agent.todoItems.slice(0, 5).map((item, i) => (React.createElement(Box, { key: i, paddingX: 2 },
                React.createElement(Text, { dimColor: true },
                    i + 1,
                    ". "),
                React.createElement(Text, null, truncate(`[${item.state}] ${item.title}`, 60))))),
            agent.todoItems.length > 5 && (React.createElement(Box, { paddingX: 2 },
                React.createElement(Text, { dimColor: true },
                    "... and ",
                    agent.todoItems.length - 5,
                    " more"))))),
        agent.statusEvents && agent.statusEvents.length > 0 && (React.createElement(Box, { marginTop: 1 },
            React.createElement(Text, { dimColor: true }, "Status Events: "),
            React.createElement(Text, { color: "green" }, agent.statusEvents.length))),
        React.createElement(Box, { marginTop: 1 },
            React.createElement(Text, { dimColor: true }, "Last Updated: "),
            React.createElement(Text, null, formatRelativeTime(agent.lastUpdated)),
            React.createElement(Text, { dimColor: true }, " | Created: "),
            React.createElement(Text, null, formatRelativeTime(agent.createdAt)))));
};
export default AgentDetailsTab;
