// section-config 负责集中定义资源中心资源分类的展示配置。
import type { ResourceCenterTab } from '../types/panel';

export type ResourceCenterSectionKey = 'docs' | 'mindmap' | 'quiz' | 'card';
export type ResourceCenterResourceKind = Exclude<ResourceCenterTab, 'all'>;

export interface ResourceCenterSectionConfig {
  panel: ResourceCenterResourceKind;
  section: ResourceCenterSectionKey;
  label: string;
  icon: string;
  isTemplate: boolean;
}

export const RESOURCE_CENTER_SECTION_CONFIGS: ResourceCenterSectionConfig[] = [
  {
    panel: 'kbdoc',
    section: 'docs',
    label: '参考文档',
    icon: 'book_2',
    isTemplate: false,
  },
  {
    panel: 'mindmap',
    section: 'mindmap',
    label: '思维导图',
    icon: 'account_tree',
    isTemplate: true,
  },
  {
    panel: 'question',
    section: 'quiz',
    label: '题目',
    icon: 'quiz',
    isTemplate: true,
  },
  {
    panel: 'card',
    section: 'card',
    label: '记忆卡',
    icon: 'style',
    isTemplate: true,
  },
];

export const RESOURCE_CENTER_PANEL_META: Record<ResourceCenterTab, { label: string; icon: string }> = {
  all: { label: '全部资源', icon: 'folder' },
  kbdoc: { label: '参考文档', icon: 'book_2' },
  mindmap: { label: '思维导图', icon: 'account_tree' },
  question: { label: '题目', icon: 'quiz' },
  card: { label: '记忆卡', icon: 'style' },
};
