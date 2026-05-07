import React from 'react';
import { Box, Text } from 'ink';
import { formatProgressBar, getStatusColor, formatRelativeTime } from '../utils/format.js';
const AgentDetail = ({ agent }) => {
    if (!agent) {
        return (React.createElement(Box, { paddingX: 1, paddingY: 1 },
            React.createElement(Text, { dimColor: true }, "Select an agent to view details")));
    }
    const statusColor = getStatusColor(agent.status);
    const summary = agent.statusSummary;
    const activeTodo = agent.todoItems?.find((item) => item.id === summary?.currentTodoId);
    return (React.createElement(Box, { flexDirection: "column", paddingX: 1 },
        React.createElement(Text, { bold: true },
            "SELECTED: ",
            agent.name),
        React.createElement(Box, { borderStyle: "single", borderColor: "gray", flexDirection: "column", paddingX: 1 },
            React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Role: "),
                React.createElement(Text, null, agent.role)),
            React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Model: "),
                React.createElement(Text, null, agent.model || 'default')),
            React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Status: "),
                React.createElement(Text, { color: statusColor }, agent.status)),
            summary?.progress !== undefined && (React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Progress: "),
                React.createElement(Text, { color: statusColor }, formatProgressBar(summary.progress, 10)),
                React.createElement(Text, null,
                    " ",
                    summary.progress,
                    "%"))),
            summary?.message && (React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Status: "),
                React.createElement(Text, null,
                    summary.phase,
                    " - ",
                    summary.message))),
            activeTodo && (React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Current Todo: "),
                React.createElement(Text, null, activeTodo.title))),
            React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Last Updated: "),
                React.createElement(Text, null, formatRelativeTime(agent.lastUpdated))),
            agent.todoItems && agent.todoItems.length > 0 && (React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Todos: "),
                React.createElement(Text, null,
                    agent.todoItems.length,
                    " items"))),
            agent.statusEvents && agent.statusEvents.length > 0 && (React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Events: "),
                React.createElement(Text, null, agent.statusEvents.length))))));
};
export default AgentDetail;
