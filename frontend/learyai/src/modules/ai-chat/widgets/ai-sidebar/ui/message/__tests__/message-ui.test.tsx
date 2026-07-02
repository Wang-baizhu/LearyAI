import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ChevronDownIcon,
  CloudOffIcon,
  CopyIcon,
  ErrorIcon,
  SaveIcon,
  ShieldIcon,
} from '../Icons';
import { PermissionRequestPanel } from '../StatusCards';

describe('AI sidebar message UI', () => {
  it('renders all SVG icons safely', () => {
    const render = () =>
      renderToStaticMarkup(
        <div>
          <SaveIcon />
          <CopyIcon />
          <ShieldIcon />
          <ErrorIcon />
          <CloudOffIcon />
          <ChevronDownIcon />
        </div>
      );

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('<svg');
    expect(markup).toContain('w-4 h-4');
    expect(markup).toContain('w-6 h-6');
  });

  it('renders the permission request panel safely', () => {
    const render = () =>
      renderToStaticMarkup(
        <PermissionRequestPanel
          request={{
            toolCallId: 'tool-1',
            title: '请求权限',
            description: '这里是权限说明。',
            options: ['approve', 'reject', 'approve_for_session'],
            timeout: 30,
          }}
          onDecision={vi.fn()}
        />
      );

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('请求权限');
    expect(markup).toContain('这里是权限说明。');
    expect(markup).toContain('确认授权');
    expect(markup).toContain('本会话允许');
    expect(markup).toContain('拒绝');
  });
});
