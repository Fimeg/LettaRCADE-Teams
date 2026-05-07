import React from 'react';
import type { TaskState } from '../../types.js';
interface TaskDetailProps {
    task: TaskState | null;
}
declare const TaskDetail: React.FC<TaskDetailProps>;
export default TaskDetail;
