// 职责: 定义 EditableContent 及其扩展协议的公开类型。
import type { ReactNode } from 'react';
import type { ContentPart, ContentReference } from './lib/content';

export type ReferenceJumpPayload = {
  label: string;
  source: string;
  page: string;
  pageValue: string;
};

export interface EditableContentBehavior<TAnchor = unknown> {
  disabled?: boolean;
  hidden?: boolean;
  title?: string;
  content?: string;
  anchor?: TAnchor;
  multiline?: boolean;
}

export interface EditableContentBehaviorParams<TAnchor = unknown, TContext = unknown> {
  pluginId: string;
  title: string;
  content: string;
  anchor?: TAnchor;
  multiline: boolean;
  context?: TContext;
}

export interface EditableContentRenderParams<TAnchor = unknown, TContext = unknown> {
  pluginId: string;
  title: string;
  content: string;
  anchor?: TAnchor;
  multiline: boolean;
  context?: TContext;
  parts: ContentPart[];
  referenceTitleMap?: Record<string, string>;
  referenceDisabled: boolean;
  defaultContent: ReactNode;
  requestReferenceJump: (payload: ReferenceJumpPayload) => void;
}

export interface EditableContentTextPartParams<TContext = unknown> {
  text: string;
  index: number;
  context?: TContext;
}

export interface EditableContentRenderReferenceParams<TContext = unknown> {
  reference: ContentReference;
  docName?: string;
  disabled: boolean;
  defaultNode: ReactNode;
  requestReferenceJump: (payload: ReferenceJumpPayload) => void;
  context?: TContext;
}

export interface EditableContentExtension<TAnchor = unknown, TContext = unknown> {
  name: string;
  resolveBehavior?: (
    params: EditableContentBehaviorParams<TAnchor, TContext>,
  ) => EditableContentBehavior<TAnchor> | void;
  renderTextPart?: (params: EditableContentTextPartParams<TContext>) => ReactNode | null | undefined;
  renderReference?: (
    params: EditableContentRenderReferenceParams<TContext>,
  ) => ReactNode | null | undefined;
  renderContent?: (
    params: EditableContentRenderParams<TAnchor, TContext>,
  ) => ReactNode | null | undefined;
  classNames?: {
    root?: string;
    content?: string;
    trigger?: string;
    text?: string;
  };
}

export interface EditableContentProps<TAnchor = unknown, TContext = unknown> {
  title: string;
  content: string;
  anchor?: TAnchor;
  multiline?: boolean;
  className?: string;
  contentClassName?: string;
  triggerClassName?: string;
  triggerPlacement?: 'overlay' | 'inline';
  textClassName?: string;
  referenceDisabled?: boolean;
  renderContent?: (params: EditableContentRenderParams<TAnchor, TContext>) => ReactNode;
  extensions?: EditableContentExtension<TAnchor, TContext>[];
  context?: TContext;
}

export interface EditableContentPresetConfig<TAnchor = unknown, TContext = unknown> {
  useContext?: () => TContext;
  extensions?: EditableContentExtension<TAnchor, TContext>[];
}
