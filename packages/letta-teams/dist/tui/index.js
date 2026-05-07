/**
 * TUI Dashboard entry point
 */
import React from 'react';
import { render } from 'ink';
import App from './App.js';
/**
 * Launch the TUI dashboard
 */
export function launchTui(options = {}) {
    render(React.createElement(App, { includeInternal: options.includeInternal || false }));
}
