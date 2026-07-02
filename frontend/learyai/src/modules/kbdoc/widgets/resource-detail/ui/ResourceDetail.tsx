// ResourceDetail 负责提供资源详情页的稳定入口，并在切换文档时重置局部交互状态。
import React from 'react';
import ResourceDetailLayout from './ResourceDetailLayout';
import type { ResourceDetailProps } from './resourceDetailTypes';

const ResourceDetail: React.FC<ResourceDetailProps> = (props) => (
  <div className="flex flex-1 flex-col overflow-hidden bg-[#edf0f5] dark:bg-[#121212]">
    <ResourceDetailLayout key={props.resource.docId} {...props} />
  </div>
);

export default ResourceDetail;
