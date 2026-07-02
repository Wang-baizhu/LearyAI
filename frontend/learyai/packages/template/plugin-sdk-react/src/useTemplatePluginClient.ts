// 职责: 为 React 模板提供基于 browser client 的 hook 入口。
import { useMemo } from 'react';
import {
  getOrCreateTemplatePluginClient,
  resetTemplatePluginClientSingletonForHmr,
  type TemplatePluginClient,
  type TemplatePluginClientOptions,
} from '@leary/template-plugin-sdk-web';

export { resetTemplatePluginClientSingletonForHmr };
export type { TemplatePluginClient, TemplatePluginClientOptions };

export const useTemplatePluginClient = (options?: TemplatePluginClientOptions) => {
  return useMemo(() => getOrCreateTemplatePluginClient(options), [options]);
};
