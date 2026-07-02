// resourceScope.tsx 负责提供资源中心路由作用域的 Provider 组件。
import React from 'react';
import { ResourceScopeContext, type ResourceScopeValue } from './resourceScope';

interface ResourceScopeProviderProps {
  value: ResourceScopeValue;
  children: React.ReactNode;
}

export const ResourceScopeProvider: React.FC<ResourceScopeProviderProps> = ({
  value,
  children,
}) => (
  <ResourceScopeContext.Provider value={value}>
    {children}
  </ResourceScopeContext.Provider>
);
