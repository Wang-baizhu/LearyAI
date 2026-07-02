// ResourceCenterAiView 负责渲染资源中心 AI 面板内容。
import React from 'react';
import { AIChatPanel } from '../../../../ai-chat';
import { useResourceScope } from '../../../entities/resource-center';
import type { ResourceCenterAiViewProps } from '../model/types';

const ResourceCenterAiView: React.FC<ResourceCenterAiViewProps> = ({
  variant,
  isCollapsed = false,
  onToggleCollapsed,
  aiState,
}) => {
  const { projectId, kbId } = useResourceScope();
  if (!aiState) return null;

  return (
    <div
      className={
        variant === 'main'
          ? 'flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10'
          : 'flex-1 min-h-0 h-full overflow-hidden'
      }
    >
      <div className="h-full flex flex-col min-h-0">
        <AIChatPanel
          resources={aiState.resources}
          referencedResources={aiState.referencedResources}
          referencedDocRefs={aiState.referencedDocRefs}
          onToggleReference={aiState.onToggleReference}
          onClearReferences={aiState.onClearReferences}
          fallbackDocRef={aiState.fallbackDocRef}
          projectId={projectId}
          kbId={kbId}
          isCollapsed={isCollapsed}
          onToggleCollapsed={onToggleCollapsed}
          showCollapseToggle={aiState.showCollapseToggle}
          inputVariant={aiState.inputVariant}
        />
      </div>
    </div>
  );
};

export default ResourceCenterAiView;
