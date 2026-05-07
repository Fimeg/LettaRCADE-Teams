import React from 'react';
import { Box, Text } from 'ink';
import { getTaskStatusIcon, getTaskStatusColor, formatRelativeTime, truncate, } from '../utils/format.js';
const TaskList = ({ tasks, selectedIndex, includeInternal = false }) => {
    if (tasks.length === 0) {
        return (React.createElement(Box, { paddingX: 1, paddingY: 1 },
            React.createElement(Text, { dimColor: true }, "No tasks found.")));
    }
    return (React.createElement(Box, { flexDirection: "column", paddingX: 1 },
        React.createElement(Text, { bold: true },
            "TASKS (",
            tasks.length,
            ")",
            React.createElement(Text, { dimColor: true }, includeInternal ? ' [internal: on]' : ' [internal: off]')),
        React.createElement(Box, { borderStyle: "single", borderColor: "gray", flexDirection: "column" },
            tasks.slice(0, 10).map((task, index) => {
                const isSelected = index === selectedIndex;
                const icon = getTaskStatusIcon(task.status);
                const color = getTaskStatusColor(task.status);
                const time = formatRelativeTime(task.createdAt);
                const message = truncate(task.message, 40);
                return (React.createElement(Box, { key: task.id, paddingX: 1 },
                    React.createElement(Text, { bold: isSelected, color: isSelected ? 'white' : undefined, inverse: isSelected },
                        isSelected ? ' ' : '',
                        React.createElement(Text, { color: color }, icon),
                        ' ',
                        truncate(task.id, 18).padEnd(18),
                        ' ',
                        task.teammateName.padEnd(12).slice(0, 12),
                        ' ',
                        React.createElement(Text, { color: color }, task.status.padEnd(7)),
                        ' ',
                        React.createElement(Text, { dimColor: true }, time.padEnd(8)),
                        ' ',
                        React.createElement(Text, { dimColor: true }, message),
                        isSelected ? ' ' : '')));
            }),
            tasks.length > 10 && (React.createElement(Box, { paddingX: 1 },
                React.createElement(Text, { dimColor: true },
                    "... and ",
                    tasks.length - 10,
                    " more"))))));
};
export default TaskList;
