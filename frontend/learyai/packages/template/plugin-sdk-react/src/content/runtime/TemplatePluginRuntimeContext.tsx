// 职责: 为模板正文组件统一提供宿主 render 运行时上下文，并支持按需覆盖局部编辑解析配置。
/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { HostRenderPayload } from '@leary/template-plugin-sdk-core';
import { useTemplatePluginClient } from '../../useTemplatePluginClient';

export interface TemplatePluginRuntimeAnchorParams {
  pluginId: string;
  templateId: string;
  rawContent: string;
  content: string;
}

export interface TemplatePluginRuntimeResolveEditedContentParams<TAnchor = unknown> {
  pluginId: string;
  templateId: string;
  rawContent: string;
  anchor: TAnchor;
  previousValue: string;
  nextValue: string;
}

export interface TemplatePluginRuntimeValue<TAnchor = unknown> {
  pluginId: string;
  templateId: string;
  rawContent: string;
  referenceTitleMap: Record<string, string>;
  resolveContentAnchor?: (params: TemplatePluginRuntimeAnchorParams) => TAnchor;
  resolveEditedContent?: (params: TemplatePluginRuntimeResolveEditedContentParams<TAnchor>) => string;
}

type TemplatePluginRuntimeOverrides<TAnchor = unknown> = Partial<
  Omit<TemplatePluginRuntimeValue<TAnchor>, 'pluginId' | 'referenceTitleMap'>
>;

interface TemplatePluginRuntimeProviderProps<TAnchor = unknown> {
  children: ReactNode;
  value?: TemplatePluginRuntimeOverrides<TAnchor>;
}

const EMPTY_RUNTIME_VALUE: TemplatePluginRuntimeValue = {
  pluginId: '',
  templateId: '',
  rawContent: '',
  referenceTitleMap: {},
};

const TemplatePluginRuntimeContext = createContext<TemplatePluginRuntimeOverrides<unknown> | null>(null);

const buildRuntimeValueFromRender = (payload: HostRenderPayload): TemplatePluginRuntimeValue => ({
  pluginId: payload.pluginId,
  templateId: payload.templateId ?? '',
  rawContent: payload.content ?? '',
  referenceTitleMap: payload.referenceTitles ?? {},
});

const useHostTemplatePluginRuntime = () => {
  const client = useTemplatePluginClient();
  const [renderRuntime, setRenderRuntime] = useState<TemplatePluginRuntimeValue>(EMPTY_RUNTIME_VALUE);

  useEffect(() => {
    return client.onRender((payload) => {
      setRenderRuntime(buildRuntimeValueFromRender(payload));
    });
  }, [client]);

  return renderRuntime;
};

export const TemplatePluginRuntimeProvider = <TAnchor,>({
  children,
  value,
}: TemplatePluginRuntimeProviderProps<TAnchor>) => {
  return (
    <TemplatePluginRuntimeContext.Provider
      value={(value ?? null) as TemplatePluginRuntimeOverrides<unknown> | null}
    >
      {children}
    </TemplatePluginRuntimeContext.Provider>
  );
};

const castRuntimeOverrides = <TAnchor,>(value: TemplatePluginRuntimeOverrides<unknown> | null) =>
  value as TemplatePluginRuntimeOverrides<TAnchor> | null;

export const useTemplatePluginRuntime = <TAnchor,>() => {
  const renderRuntime = useHostTemplatePluginRuntime();
  const overrides = castRuntimeOverrides<TAnchor>(useContext(TemplatePluginRuntimeContext));

  return useMemo<TemplatePluginRuntimeValue<TAnchor>>(
    () => ({
      pluginId: renderRuntime.pluginId,
      templateId: overrides?.templateId ?? renderRuntime.templateId,
      rawContent: overrides?.rawContent ?? renderRuntime.rawContent,
      referenceTitleMap: renderRuntime.referenceTitleMap,
      resolveContentAnchor: overrides?.resolveContentAnchor as
        | ((params: TemplatePluginRuntimeAnchorParams) => TAnchor)
        | undefined,
      resolveEditedContent: overrides?.resolveEditedContent as
        | ((params: TemplatePluginRuntimeResolveEditedContentParams<TAnchor>) => string)
        | undefined,
    }),
    [
      overrides?.rawContent,
      overrides?.resolveContentAnchor,
      overrides?.resolveEditedContent,
      overrides?.templateId,
      renderRuntime.pluginId,
      renderRuntime.rawContent,
      renderRuntime.referenceTitleMap,
      renderRuntime.templateId,
    ],
  );
};

export const useOptionalTemplatePluginRuntime = <TAnchor,>() => {
  return useTemplatePluginRuntime<TAnchor>();
};
