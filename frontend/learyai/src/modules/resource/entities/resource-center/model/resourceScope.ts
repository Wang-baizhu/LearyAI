// resourceScope 负责提供资源中心当前路由作用域的 Context 与 hook。
import { createContext, useContext } from 'react';

export interface ResourceScopeValue {
  projectId?: string;
  kbId?: string;
}

export const ResourceScopeContext = createContext<ResourceScopeValue>({});

export const useResourceScope = () => useContext(ResourceScopeContext);
