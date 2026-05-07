import React from 'react';
import { Box, Text } from 'ink';
import { getTaskStatusColor, formatRelativeTime, formatDuration, truncate, } from '../utils/format.js';
const TaskDetail = ({ task }) => {
    if (!task) {
        return (React.createElement(Box, { paddingX: 1, paddingY: 1 },
            React.createElement(Text, { dimColor: true }, "Select a task to view details")));
    }
    const statusColor = getTaskStatusColor(task.status);
    const duration = task.startedAt
        ? formatDuration(task.startedAt, task.completedAt)
        : '-';
    return (React.createElement(Box, { flexDirection: "column", paddingX: 1 },
        React.createElement(Text, { bold: true },
            "SELECTED: ",
            task.id),
        React.createElement(Box, { borderStyle: "single", borderColor: "gray", flexDirection: "column", paddingX: 1 },
            React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Teammate: "),
                React.createElement(Text, null, task.teammateName)),
            React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Status: "),
                React.createElement(Text, { color: statusColor }, task.status)),
            React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Created: "),
                React.createElement(Text, null, formatRelativeTime(task.createdAt))),
            task.startedAt && (React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Started: "),
                React.createElement(Text, null, formatRelativeTime(task.startedAt)))),
            task.completedAt && (React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Completed: "),
                React.createElement(Text, null, formatRelativeTime(task.completedAt)))),
            React.createElement(Box, null,
                React.createElement(Text, { dimColor: true }, "Duration: "),
                React.createElement(Text, null, duration)),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { dimColor: true }, "Message:")),
            React.createElement(Box, { paddingX: 1 },
                React.createElement(Text, null, truncate(task.message, 100))),
            task.result && (React.createElement(React.Fragment, null,
                React.createElement(Box, { marginTop: 1 },
                    React.createElement(Text, { dimColor: true }, "Result:")),
                React.createElement(Box, { paddingX: 1 },
                    React.createElement(Text, { color: "green" }, truncate(task.result, 200))))),
            task.error && (React.createElement(React.Fragment, null,
                React.createElement(Box, { marginTop: 1 },
                    React.createElement(Text, { dimColor: true }, "Error:")),
                React.createElement(Box, { paddingX: 1 },
                    React.createElement(Text, { color: "red" }, truncate(task.error, 200))))),
            task.toolCalls && task.toolCalls.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement(Box, { marginTop: 1 },
                    React.createElement(Text, { dimColor: true },
                        "Tool Calls (",
                        task.toolCalls.length,
                        "):")),
                React.createElement(Box, { paddingX: 1, flexDirection: "column" },
                    task.toolCalls.slice(0, 5).map((tc, i) => (React.createElement(Box, { key: i },
                        React.createElement(Text, { color: tc.success ? 'green' : 'red' }, tc.success ? '✓' : '✗'),
                        React.createElement(Text, null,
                            " ",
                            tc.name),
                        tc.input && React.createElement(Text, { dimColor: true },
                            " \"",
                            truncate(tc.input, 30),
                            "\"")))),
                    task.toolCalls.length > 5 && (React.createElement(Text, { dimColor: true },
                        "... and ",
                        task.toolCalls.length - 5,
                        " more"))))))));
};
export default TaskDetail;
