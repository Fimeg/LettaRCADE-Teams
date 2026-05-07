import React from 'react';
import type { TeammateState } from '../../types.js';
interface AgentDetailsTabProps {
    teammates: TeammateState[];
    selectedIndex: number;
}
declare const AgentDetailsTab: React.FC<AgentDetailsTabProps>;
export default AgentDetailsTab;
