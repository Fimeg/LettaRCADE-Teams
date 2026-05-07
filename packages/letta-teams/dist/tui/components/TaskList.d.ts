import React from 'react';
import type { TaskState } from '../../types.js';
interface TaskListProps {
    tasks: TaskState[];
    selectedIndex: number;
    includeInternal?: boolean;
}
declare const TaskList: React.FC<TaskListProps>;
export default TaskList;
