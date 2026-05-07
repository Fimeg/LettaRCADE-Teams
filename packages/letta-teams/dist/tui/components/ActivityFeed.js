import React from 'react';
import { Box, Text } from 'ink';
import { formatRelativeTime, truncate } from '../utils/format.js';
const ActivityFeed = ({ tasks, teammates, includeInternal = false }) => {
    // Build activity items from tasks and teammates
    const activities = [];
    // Add recent task completions/errors
    const recentTasks = tasks
        .filter(t => t.status === 'done' || t.status === 'error')
        .slice(0, 10);
    for (const task of recentTasks) {
        if (task.completedAt) {
            activities.push({
                timestamp: task.completedAt,
                agentName: task.teammateName,
                action: task.status === 'done' ? 'Completed task' : 'Task failed',
                detail: truncate(task.message, 50),
                status: task.status === 'done' ? 'success' : 'error',
            });
        }
    }
    // Add working agents
    for (const agent of teammates) {
        if (agent.statusSummary?.message) {
            activities.push({
                timestamp: agent.statusSummary.updatedAt,
                agentName: agent.name,
                action: `${agent.statusSummary.phase}:`,
                detail: truncate(agent.statusSummary.message, 50),
                status: 'info',
            });
        }
        if (agent.statusSummary?.phase === 'blocked') {
            activities.push({
                timestamp: agent.statusSummary.updatedAt,
                agentName: agent.name,
                action: 'Blocked:',
                detail: truncate(agent.statusSummary.message, 50),
                status: 'error',
            });
        }
    }
    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (activities.length === 0) {
        return (React.createElement(Box, { paddingX: 1, paddingY: 1, flexDirection: "column" },
            React.createElement(Text, { bold: true },
                "ACTIVITY",
                React.createElement(Text, { dimColor: true }, includeInternal ? ' [internal: on]' : ' [internal: off]')),
            React.createElement(Box, { borderStyle: "single", borderColor: "gray", paddingX: 1 },
                React.createElement(Text, { dimColor: true }, "No recent activity"))));
    }
    return (React.createElement(Box, { flexDirection: "column", paddingX: 1 },
        React.createElement(Text, { bold: true },
            "ACTIVITY",
            React.createElement(Text, { dimColor: true }, includeInternal ? ' [internal: on]' : ' [internal: off]')),
        React.createElement(Box, { borderStyle: "single", borderColor: "gray", flexDirection: "column" },
            activities.slice(0, 15).map((activity, index) => {
                const icon = activity.status === 'success' ? '✓' :
                    activity.status === 'error' ? '✗' : '●';
                const color = activity.status === 'success' ? 'green' :
                    activity.status === 'error' ? 'red' : 'yellow';
                const time = formatRelativeTime(activity.timestamp);
                return (React.createElement(Box, { key: index, paddingX: 1 },
                    React.createElement(Text, { color: color }, icon),
                    React.createElement(Text, { dimColor: true },
                        " ",
                        time.padEnd(8)),
                    React.createElement(Text, null,
                        " ",
                        activity.agentName.padEnd(12).slice(0, 12)),
                    React.createElement(Text, { dimColor: true },
                        " ",
                        activity.action),
                    React.createElement(Text, { dimColor: true },
                        " ",
                        activity.detail)));
            }),
            activities.length > 15 && (React.createElement(Box, { paddingX: 1 },
                React.createElement(Text, { dimColor: true },
                    "... and ",
                    activities.length - 15,
                    " more"))))));
};
export default ActivityFeed;
