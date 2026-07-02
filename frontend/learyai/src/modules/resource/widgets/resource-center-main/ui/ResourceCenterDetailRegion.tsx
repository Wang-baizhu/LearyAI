// ResourceCenterDetailRegion 负责根据当前面板编排详情区域与列表回退渲染。
import React from 'react';
import { isResourceCenterTab } from '../../../entities/resource-center';
import ResourceDetailPanel from '../../../features/resource-detail-panel';
import type { ResourceCenterDetailRegionProps } from '../model/types';

const ResourceCenterDetailRegion: React.FC<ResourceCenterDetailRegionProps> = ({
  panel,
  variant,
  detailState,
  detailStates,
  listContent,
  floatingAction,
}) => {
  const isDetailPanel = !isResourceCenterTab(String(panel));

  if (detailStates && detailStates.length > 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {detailStates.map((item) => {
          const isActive = panel === item.key;
          return (
            <div
              key={item.key}
              className={
                isActive
                  ? variant === 'main'
                    ? 'relative flex-1 min-h-0 flex flex-col overflow-hidden'
                    : 'flex-1 min-h-0 flex flex-col'
                  : 'hidden'
              }
            >
              {isActive && variant === 'main' && floatingAction ? (
                <div className="absolute top-6 right-6 z-20">{floatingAction}</div>
              ) : null}
              <ResourceDetailPanel {...item.state} variant={variant} />
            </div>
          );
        })}
        {isDetailPanel ? null : listContent}
      </div>
    );
  }

  if (detailState?.docId) {
    if (isDetailPanel || variant === 'sidebar') {
      return (
        <div
          className={
            variant === 'main'
              ? 'relative flex-1 min-h-0 flex flex-col overflow-hidden'
              : 'flex-1 min-h-0 flex flex-col'
          }
        >
          {variant === 'main' && floatingAction ? (
            <div className="absolute top-6 right-6 z-20">{floatingAction}</div>
          ) : null}
          <ResourceDetailPanel {...detailState} variant={variant} />
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="hidden">
          <ResourceDetailPanel {...detailState} variant={variant} />
        </div>
        {listContent}
      </div>
    );
  }

  return <>{listContent}</>;
};

export default ResourceCenterDetailRegion;
