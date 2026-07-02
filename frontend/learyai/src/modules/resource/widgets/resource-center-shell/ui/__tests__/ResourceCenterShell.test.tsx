// ResourceCenterShell.test.tsx 负责验证资源中心壳层布局的静态渲染。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  GlobalMobileBottomNav: vi.fn(() => <div data-testid="global-mobile-nav">global-mobile-nav</div>),
}));

vi.mock('@/shared/ui/GlobalMobileBottomNav', () => ({
  default: mocks.GlobalMobileBottomNav,
}));

import ResourceCenterShell from '../ResourceCenterShell';

describe('ResourceCenterShell', () => {
  it('会同时渲染 dock 与主内容区域', () => {
    const html = renderToStaticMarkup(
      <ResourceCenterShell
        dock={<aside>dock</aside>}
        mobileActiveView="resource"
        onMobileViewChange={vi.fn()}
        onMobileActionClick={vi.fn()}
        isMobileActionActive={false}
      >
        <section>main</section>
      </ResourceCenterShell>
    );

    expect(html).toContain('dock');
    expect(html).toContain('main');
    expect(html).toContain('global-mobile-nav');
    expect(html).toContain('h-screen');
    expect(html).toContain('rounded-3xl');
    expect(mocks.GlobalMobileBottomNav).toHaveBeenCalledWith(
      expect.objectContaining({
        leftItem: expect.objectContaining({ key: 'ai' }),
        rightItem: expect.objectContaining({ key: 'resource' }),
        activeKey: 'resource',
        centerAction: expect.objectContaining({
          onClick: expect.any(Function),
          active: false,
        }),
      }),
      undefined
    );
  });
});
