import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  mutate: vi.fn(),
  useAcceptProjectInvite: vi.fn(() => ({
    isPending: true,
    mutate: vi.fn(),
  })),
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('@/shared/ui/LoadingSpinner', () => ({
  default: ({ label = '加载中...' }: { label?: string }) => (
    <span data-testid="spinner">{label}</span>
  ),
}));

vi.mock('../../model/useAcceptProjectInvite', () => ({
  useAcceptProjectInvite: mocks.useAcceptProjectInvite,
}));

import ProjectInviteJoinForm from '../ProjectInviteJoinForm';

describe('ProjectInviteJoinForm', () => {
  it('会渲染邀请码加入表单并展示提交中的状态', () => {
    const html = renderToStaticMarkup(<ProjectInviteJoinForm onAccepted={vi.fn()} />);

    expect(html).toContain('邀请码');
    expect(html).toContain('请输入邀请码');
    expect(html).toContain('提交中...');
    expect(html).toContain('disabled');
    expect(mocks.useAcceptProjectInvite).toHaveBeenCalledTimes(1);
  });
});
