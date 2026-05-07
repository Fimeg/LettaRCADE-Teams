import React from 'react';
type Tab = 'agents' | 'tasks' | 'activity' | 'details';
interface FooterProps {
    activeTab: Tab;
    includeInternal?: boolean;
}
declare const Footer: React.FC<FooterProps>;
export default Footer;
