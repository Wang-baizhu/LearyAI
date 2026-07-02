import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <span data-icon={name} />,
}));

import SidebarContent from '../SidebarContent';

describe('SidebarContent', () => {
  it('renders login branch', () => {
    const html = renderToStaticMarkup(<SidebarContent view="login" />);

    expect(html).toContain('Leary AI');
    expect(html).toContain('向 AI 提问任何问题');
    expect(html).toContain('data-icon="send"');
  });

  it('renders non-login branch', () => {
    const html = renderToStaticMarkup(<SidebarContent view="register" />);

    expect(html).toContain('智能 AI 助手');
    expect(html).toContain('智能资源中心');
    expect(html).toContain('推荐能力');
    expect(html).toContain('data-icon="smart_toy"');
  });
});
