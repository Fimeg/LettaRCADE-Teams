import React from 'react';
import { Box, Text } from 'ink';
const Footer = ({ activeTab, includeInternal = false }) => {
    // Show different navigation hint based on tab
    const navHint = activeTab === 'details' ? '←→ navigate' : '↑↓ navigate';
    return (React.createElement(Box, { borderStyle: "single", borderColor: "gray", paddingX: 1 },
        React.createElement(Text, { dimColor: true }, navHint),
        React.createElement(Text, { dimColor: true }, "  "),
        React.createElement(Text, { dimColor: true }, "Tab switch"),
        React.createElement(Text, { dimColor: true }, "  "),
        activeTab === 'tasks' && (React.createElement(React.Fragment, null,
            React.createElement(Text, { dimColor: true }, "[x] cancel"),
            React.createElement(Text, { dimColor: true }, "  "))),
        React.createElement(Text, { dimColor: true },
            "[i] internal: ",
            includeInternal ? 'on' : 'off'),
        React.createElement(Text, { dimColor: true }, "  "),
        React.createElement(Text, { dimColor: true }, "[r] refresh"),
        React.createElement(Box, { flexGrow: 1 }),
        React.createElement(Text, { dimColor: true }, "Ctrl+C exit")));
};
export default Footer;
