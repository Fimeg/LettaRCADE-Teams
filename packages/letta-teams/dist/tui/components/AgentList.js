import React from 'react';
import { Box, Text } from 'ink';
import { formatProgressBar, getStatusIcon, getStatusColor } from '../utils/format.js';
const AgentList = ({ teammates, selectedIndex }) => {
    if (teammates.length === 0) {
        return (React.createElement(Box, { paddingX: 1, paddingY: 1 },
            React.createElement(Text, { dimColor: true }, "No agents found. Use 'letta-teams spawn <name> <role>' to create one.")));
    }
    return (React.createElement(Box, { flexDirection: "column", paddingX: 1 },
        React.createElement(Text, { bold: true },
            "AGENTS (",
            teammates.length,
            ")"),
        React.createElement(Box, { borderStyle: "single", borderColor: "gray", flexDirection: "column" }, teammates.map((agent, index) => {
            const isSelected = index === selectedIndex;
            const status = agent.status || 'idle';
            const icon = getStatusIcon(status);
            const color = getStatusColor(status);
            const progressValue = agent.statusSummary?.progress;
            const progress = progressValue !== undefined
                ? formatProgressBar(progressValue, 10)
                : '░'.repeat(10);
            const task = agent.statusSummary?.message || 'No status message';
            return (React.createElement(Box, { key: agent.name, paddingX: 1 },
                React.createElement(Text, { bold: isSelected, color: isSelected ? 'white' : undefined, inverse: isSelected },
                    isSelected ? ' ' : '',
                    icon,
                    " ",
                    agent.name.padEnd(16).slice(0, 16),
                    ' ',
                    status.padEnd(7),
                    ' ',
                    React.createElement(Text, { color: color }, progress),
                    ' ',
                    React.createElement(Text, { dimColor: true }, task.slice(0, 30)),
                    isSelected ? ' ' : '')));
        }))));
};
export default AgentList;
