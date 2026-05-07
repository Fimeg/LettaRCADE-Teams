import React from 'react';
type Tab = 'agents' | 'tasks' | 'activity' | 'details';
interface TabsProps {
    activeTab: Tab;
}
declare const Tabs: React.FC<TabsProps>;
export default Tabs;
