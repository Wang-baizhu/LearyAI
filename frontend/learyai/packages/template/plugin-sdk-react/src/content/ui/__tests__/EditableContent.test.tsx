// EditableContent.test.tsx 负责验证 content 组件的请求透传、扩展行为与 preset 能力。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditableContent } from '../EditableContent';
import { createEditableContentPreset } from '../createEditableContentPreset';
import type { EditableContentExtension } from '../../types';
import { TemplatePluginRuntimeProvider } from '../../runtime/TemplatePluginRuntimeContext';

const mocks = vi.hoisted(() => {
  const requestTextEdit = vi.fn();
  const requestSaveContent = vi.fn();
  const requestCitationJump = vi.fn();
  const editableTextPropsRef: { current: Record<string, unknown> | null } = { current: null };
  const referenceTagPropsRef: { current: Array<Record<string, unknown>> } = { current: [] };
  const renderPayloadRef: {
    current:
      | {
          pluginId: string;
          templateId?: string;
          content?: string;
          referenceTitles?: Record<string, string>;
        }
      | null;
  } = { current: null };
  const renderPayloadDeliveredRef: { current: boolean } = { current: false };

  return {
    requestTextEdit,
    requestSaveContent,
    requestCitationJump,
    editableTextPropsRef,
    referenceTagPropsRef,
    renderPayloadRef,
    renderPayloadDeliveredRef,
    useTemplatePluginClient: vi.fn(() => ({
      requestTextEdit,
      requestSaveContent,
      requestCitationJump,
      onRender: (handler: (payload: unknown) => void) => {
        if (renderPayloadRef.current && !renderPayloadDeliveredRef.current) {
          renderPayloadDeliveredRef.current = true;
          handler(renderPayloadRef.current);
        }
        return () => {};
      },
    })),
  };
});

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useMemo: (factory: () => unknown) => factory(),
    useEffect: (effect: () => void | (() => void)) => {
      effect();
    },
  };
});

vi.mock('@leary/text-editable', () => ({
  EditableText: (props: Record<string, unknown>) => {
    mocks.editableTextPropsRef.current = props;
    return React.createElement('div', null, props.children as React.ReactNode);
  },
}));

vi.mock('../../../useTemplatePluginClient', () => ({
  useTemplatePluginClient: mocks.useTemplatePluginClient,
}));

vi.mock('../../internal/ReferenceTag', () => ({
  ReferenceTag: (props: Record<string, unknown>) => {
    mocks.referenceTagPropsRef.current.push(props);
    return React.createElement('span', null, 'reference');
  },
}));

describe('EditableContent', () => {
  beforeEach(() => {
    mocks.requestTextEdit.mockReset();
    mocks.requestSaveContent.mockReset();
    mocks.requestCitationJump.mockReset();
    mocks.useTemplatePluginClient.mockClear();
    mocks.editableTextPropsRef.current = null;
    mocks.referenceTagPropsRef.current = [];
    mocks.renderPayloadRef.current = null;
    mocks.renderPayloadDeliveredRef.current = false;
    mocks.requestTextEdit.mockResolvedValue({ success: false });
    mocks.requestSaveContent.mockResolvedValue({ success: true });
  });

  it('缺少 runtime 与显式编辑参数时会降级为只读渲染', () => {
    renderToStaticMarkup(<EditableContent title="正文" content="段落内容（[doc-1][12]）" />);
    expect(mocks.editableTextPropsRef.current).toBeNull();
    expect(mocks.referenceTagPropsRef.current).toHaveLength(1);
  });

  it('会从 runtime 上下文读取 pluginId、referenceTitleMap 和 anchor', () => {
    mocks.renderPayloadRef.current = {
      pluginId: 'plugin-1',
      templateId: 'tpl-1',
      content: '段落内容（[doc-1][12]）',
      referenceTitles: { 'doc-1': '文档一' },
    };

    renderToStaticMarkup(
      <TemplatePluginRuntimeProvider
        value={{
          resolveContentAnchor: ({ templateId }) => ({ templateId, section: 'body' }),
        }}
      >
        <EditableContent title="正文" content="段落内容（[doc-1][12]）" />
      </TemplatePluginRuntimeProvider>,
    );

    const editableTextProps = mocks.editableTextPropsRef.current as {
      onRequestEdit: (payload: { title: string; value: string; anchor: unknown }) => void;
    };
    editableTextProps.onRequestEdit({
      title: '正文',
      value: '段落内容（[doc-1][12]）',
      anchor: { templateId: 'tpl-1', section: 'body' },
    });

    expect(mocks.requestTextEdit).toHaveBeenCalledWith({
      title: '正文',
      value: '段落内容（[doc-1][12]）',
      multiline: true,
      anchor: { templateId: 'tpl-1', section: 'body' },
    });

    const referenceTagProps = mocks.referenceTagPropsRef.current[0] as {
      onPageClick: (payload: { label: string; source: string; page: string; pageValue: string }) => void;
      docName?: string;
    };
    expect(referenceTagProps.docName).toBe('文档一');

    referenceTagProps.onPageClick({
      label: 'doc-1',
      source: 'doc-1',
      page: '12',
      pageValue: '12',
    });

    expect(mocks.requestCitationJump).toHaveBeenCalledWith({
      source: 'doc-1',
      pageText: '12',
      label: 'doc-1',
      page: '12',
    });
  });

  it('配置 resolveEditedContent 后会把编辑结果转成整份 content 并统一保存', async () => {
    mocks.renderPayloadRef.current = {
      pluginId: 'plugin-2',
      templateId: 'tpl-2',
      content: '旧正文',
    };
    mocks.requestTextEdit.mockResolvedValue({
      success: true,
      value: '新正文片段',
    });

    renderToStaticMarkup(
      <TemplatePluginRuntimeProvider
        value={{
          rawContent: '旧正文',
          resolveContentAnchor: () => ({ templateId: 'tpl-2', section: 'body' }),
          resolveEditedContent: ({ rawContent, nextValue }) => `${rawContent} -> ${nextValue}`,
        }}
      >
        <EditableContent title="正文" content="旧正文" />
      </TemplatePluginRuntimeProvider>,
    );

    const editableTextProps = mocks.editableTextPropsRef.current as {
      onRequestEdit: (payload: { title: string; value: string; anchor: unknown }) => Promise<void>;
    };

    await editableTextProps.onRequestEdit({
      title: '正文',
      value: '旧正文',
      anchor: { templateId: 'tpl-2', section: 'body' },
    });

    expect(mocks.requestSaveContent).toHaveBeenCalledWith({
      content: '旧正文 -> 新正文片段',
    });
  });

  it('显式 props 仍然可以覆盖 runtime 的 anchor', () => {
    mocks.renderPayloadRef.current = {
      pluginId: 'runtime-plugin',
      templateId: 'tpl-1',
      content: '原文',
      referenceTitles: { explicit: '宿主文档' },
    };

    renderToStaticMarkup(
      <TemplatePluginRuntimeProvider
        value={{
          resolveContentAnchor: () => ({ templateId: 'tpl-1', section: 'runtime' }),
        }}
      >
        <EditableContent
          title="正文"
          content="原文（[explicit][2]）"
          anchor={{ templateId: 'tpl-1', section: 'explicit' }}
        />
      </TemplatePluginRuntimeProvider>,
    );

    const editableTextProps = mocks.editableTextPropsRef.current as {
      onRequestEdit: (payload: { title: string; value: string; anchor: unknown }) => void;
    };
    editableTextProps.onRequestEdit({
      title: '正文',
      value: '原文（[explicit][2]）',
      anchor: { templateId: 'tpl-1', section: 'explicit' },
    });

    expect(mocks.requestTextEdit).toHaveBeenCalledWith({
      title: '正文',
      value: '原文（[explicit][2]）',
      multiline: true,
      anchor: { templateId: 'tpl-1', section: 'explicit' },
    });

    const referenceTagProps = mocks.referenceTagPropsRef.current[0] as {
      docName?: string;
    };
    expect(referenceTagProps.docName).toBe('宿主文档');
  });

  it('会应用扩展行为和扩展内容渲染', () => {
    mocks.renderPayloadRef.current = {
      pluginId: 'plugin-2',
    };

    const extension: EditableContentExtension<{ templateId: string }, { readonly: boolean }> = {
      name: 'readonly',
      resolveBehavior: ({ title, content, anchor, context }) => ({
        title: `${title}-扩展`,
        content: `${content}-扩展`,
        anchor: { ...(anchor ?? {}), templateId: `${anchor?.templateId ?? 'missing'}-x` },
        disabled: context?.readonly,
      }),
      renderContent: ({ content }) => React.createElement('strong', null, content),
    };

    renderToStaticMarkup(
      <EditableContent
        title="正文"
        content="原文"
        anchor={{ templateId: 'tpl-2' }}
        context={{ readonly: true }}
        extensions={[extension]}
      />,
    );

    expect(mocks.editableTextPropsRef.current).toBeNull();
    expect(mocks.requestTextEdit).not.toHaveBeenCalled();
  });

  it('preset 可以注入上下文和默认扩展', () => {
    mocks.renderPayloadRef.current = {
      pluginId: 'plugin-3',
    };

    const PresetEditableContent = createEditableContentPreset<
      { templateId: string },
      { namespace: string }
    >({
      useContext: () => ({ namespace: 'chronicle' }),
      extensions: [{
        name: 'preset-title',
        resolveBehavior: ({ title, context }) => ({
          title: `${context?.namespace}:${title}`,
        }),
      }],
    });

    renderToStaticMarkup(
      <PresetEditableContent title="正文" content="内容" anchor={{ templateId: 'tpl-3' }} />,
    );

    const editableTextProps = mocks.editableTextPropsRef.current as {
      title: string;
    };
    expect(editableTextProps.title).toBe('chronicle:正文');
  });
});
