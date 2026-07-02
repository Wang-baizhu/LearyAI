// GlobalMobileBottomNav.test.tsx 负责验证全局移动端底部导航按页面裁剪入口。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <i>{name}</i>,
}));

import GlobalMobileBottomNav from '../GlobalMobileBottomNav';

describe('GlobalMobileBottomNav', () => {
  it('会在传入主操作时渲染带加号的导航', () => {
    const html = renderToStaticMarkup(
      <GlobalMobileBottomNav
        leftItem={{ key: 'home', onClick: vi.fn() }}
        rightItem={{ key: 'project', onClick: vi.fn() }}
        activeKey="resource"
        centerAction={{ onClick: vi.fn(), ariaLabel: '打开主操作' }}
      />
    );

    expect(html).toContain('grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)]');
    expect(html).toContain('首页');
    expect(html).toContain('空间');
    expect(html).not.toContain('AI');
    expect(html).not.toContain('Resource');
    expect(html).toContain('aria-label="打开主操作"');
    expect(html).toContain('h-12 w-12');
    expect(html).not.toContain('-translate-y-[22%]');
  });

  it('会在未传入主操作时仅渲染可见 tab', () => {
    const html = renderToStaticMarkup(
      <GlobalMobileBottomNav
        leftItem={{ key: 'home', onClick: vi.fn() }}
        rightItem={{ key: 'project', onClick: vi.fn() }}
        activeKey="home"
      />
    );

    expect(html).toContain('首页');
    expect(html).toContain('空间');
    expect(html).not.toContain('AI');
    expect(html).not.toContain('Resource');
    expect(html).not.toContain('aria-label="打开主操作"');
  });

  it('允许页面按需覆盖 tab 的文案与图标', () => {
    const html = renderToStaticMarkup(
      <GlobalMobileBottomNav
        leftItem={{ key: 'home', label: '集市', icon: 'storefront', onClick: vi.fn() }}
        rightItem={{ key: 'project', label: '我的', icon: 'person', onClick: vi.fn() }}
        activeKey="project"
      />
    );

    expect(html).toContain('集市');
    expect(html).toContain('我的');
    expect(html).toContain('storefront');
    expect(html).toContain('person');
    expect(html).not.toContain('首页');
    expect(html).not.toContain('空间');
  });
});
