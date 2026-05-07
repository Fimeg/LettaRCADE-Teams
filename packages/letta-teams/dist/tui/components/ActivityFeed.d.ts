import React from 'react';
import type { TaskState, TeammateState } from '../../types.js';
interface ActivityFeedProps {
    tasks: TaskState[];
    teammates: TeammateState[];
    includeInternal?: boolean;
}
declare const ActivityFeed: React.FC<ActivityFeedProps>;
export default ActivityFeed;
