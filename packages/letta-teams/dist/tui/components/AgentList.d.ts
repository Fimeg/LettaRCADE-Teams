import React from 'react';
import type { TeammateState } from '../../types.js';
interface AgentListProps {
    teammates: TeammateState[];
    selectedIndex: number;
}
declare const AgentList: React.FC<AgentListProps>;
export default AgentList;
