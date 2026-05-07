import React from 'react';
import { Box, Text } from 'ink';
const Header = ({ agentCount }) => {
    return (React.createElement(Box, { borderStyle: "single", borderColor: "gray", paddingX: 1, justifyContent: "space-between" },
        React.createElement(Box, null,
            React.createElement(Text, { bold: true }, "Letta Teams Dashboard")),
        React.createElement(Box, null,
            React.createElement(Text, { dimColor: true },
                agentCount,
                " agents"))));
};
export default Header;
