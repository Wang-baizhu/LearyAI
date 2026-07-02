// workspace-widgets-index.test.ts 负责验证 workspace widgets 出口的重导出关系。
import { describe, expect, it, vi } from 'vitest';

const mocks = {
  GettingStarted: { __tag: 'GettingStarted' },
  Header: { __tag: 'Header' },
  Hero: { __tag: 'Hero' },
  KnowledgeBaseOverview: { __tag: 'KnowledgeBaseOverview' },
  ProjectEntryModal: { __tag: 'ProjectEntryModal' },
  ProjectManagement: { __tag: 'ProjectManagement' },
  QuickActions: { __tag: 'QuickActions' },
};

vi.mock('../GettingStarted', () => ({
  default: mocks.GettingStarted,
  GettingStarted: mocks.GettingStarted,
}));
vi.mock('../Header', () => ({
  default: mocks.Header,
  Header: mocks.Header,
}));
vi.mock('../Hero', () => ({
  default: mocks.Hero,
  Hero: mocks.Hero,
}));
vi.mock('../KnowledgeBaseOverview', () => ({
  default: mocks.KnowledgeBaseOverview,
  KnowledgeBaseOverview: mocks.KnowledgeBaseOverview,
}));
vi.mock('../ProjectEntryModal', () => ({
  default: mocks.ProjectEntryModal,
  ProjectEntryModal: mocks.ProjectEntryModal,
}));
vi.mock('../ProjectManagement', () => ({
  default: mocks.ProjectManagement,
  ProjectManagement: mocks.ProjectManagement,
}));
vi.mock('../QuickActions', () => ({
  default: mocks.QuickActions,
  QuickActions: mocks.QuickActions,
}));

describe('workspace widgets index', () => {
  it('会重导出各个 workspace widgets 组件', async () => {
    const mod = await import('../../index');

    expect(mod.GettingStarted).toBe(mocks.GettingStarted);
    expect(mod.Header).toBe(mocks.Header);
    expect(mod.Hero).toBe(mocks.Hero);
    expect(mod.KnowledgeBaseOverview).toBe(mocks.KnowledgeBaseOverview);
    expect(mod.ProjectEntryModal).toBe(mocks.ProjectEntryModal);
    expect(mod.ProjectManagement).toBe(mocks.ProjectManagement);
    expect(mod.QuickActions).toBe(mocks.QuickActions);
  });
});
