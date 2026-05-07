import React from 'react';
import { Box, Text } from 'ink';
const tabs = [
    { key: 'agents', label: 'Agents', shortcut: '1' },
    { key: 'tasks', label: 'Tasks', shortcut: '2' },
    { key: 'activity', label: 'Activity', shortcut: '3' },
    { key: 'details', label: 'Details', shortcut: '4' },
];
const Tabs = ({ activeTab }) => {
    return (React.createElement(Box, { borderStyle: "single", borderColor: "gray", paddingX: 1 },
        tabs.map((tab, index) => {
            const isActive = activeTab === tab.key;
            return (React.createElement(Box, { key: tab.key, marginRight: 2 },
                React.createElement(Text, { bold: isActive, color: isActive ? 'cyan' : undefined, dimColor: !isActive },
                    isActive ? '[' : ' ',
                    tab.shortcut,
                    ". ",
                    tab.label,
                    isActive ? ']' : ' ')));
        }),
        React.createElement(Box, { flexGrow: 1 }),
        React.createElement(Text, { dimColor: true }, "[r] refresh"),
        React.createElement(Text, { dimColor: true }, "  [q] quit")));
};
export default Tabs;
