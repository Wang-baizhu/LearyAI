// ResourceCenterDock 负责资源中心左侧停靠栏的容错包装与渲染。
import React from 'react';
import ErrorBoundary from '@/shared/ui/ErrorBoundary';
import DockSidebar from './DockSidebar';

export type ResourceCenterDockProps = React.ComponentProps<typeof DockSidebar>;

const ResourceCenterDock: React.FC<ResourceCenterDockProps> = (props) => {
  return (
    <ErrorBoundary>
      <DockSidebar {...props} />
    </ErrorBoundary>
  );
};

export default ResourceCenterDock;
