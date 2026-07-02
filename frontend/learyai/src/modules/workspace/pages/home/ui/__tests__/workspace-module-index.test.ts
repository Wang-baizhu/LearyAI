// workspace-module-index.test.ts 负责验证 workspace 模块根出口的转发关系。
import { describe, expect, it, vi } from 'vitest';

vi.mock('../WorkspacePage', () => ({
  default: 'WorkspacePageMock',
  WorkspacePage: 'WorkspacePageMock',
}));

vi.mock('../../../../widgets', () => ({
  ProjectEntryModal: 'ProjectEntryModalMock',
}));

describe('workspace module exports', () => {
  it('会从根出口转发 WorkspacePage', async () => {
    const module = await import('../../../../index');

    expect(module.WorkspacePage).toBe('WorkspacePageMock');
  });
});
