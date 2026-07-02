// ResponsiveCardCollection.test.tsx 负责验证双视图容器的空态与断点壳渲染。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ResponsiveCardCollection from '../ResponsiveCardCollection';

describe('ResponsiveCardCollection', () => {
  it('在空数据时渲染空态', () => {
    const html = renderToStaticMarkup(
      <ResponsiveCardCollection
        items={[] as Array<{ id: string }>}
        emptyState={<div>empty-state</div>}
        renderMobileItem={() => <div>mobile</div>}
        renderDesktopItem={() => <div>desktop</div>}
      />
    );

    expect(html).toContain('empty-state');
  });

  it('会同时渲染移动端与桌面端容器', () => {
    const html = renderToStaticMarkup(
      <ResponsiveCardCollection
        items={[{ id: 'item-1' }]}
        getKey={(item) => item.id}
        renderMobileItem={(item) => <div>{`mobile-${item.id}`}</div>}
        renderDesktopItem={(item) => <div>{`desktop-${item.id}`}</div>}
      />
    );

    expect(html).toContain('space-y-3 md:hidden');
    expect(html).toContain('hidden min-w-[520px] grid-cols-1 gap-6 md:grid md:grid-cols-2 xl:grid-cols-2');
    expect(html).toContain('mobile-item-1');
    expect(html).toContain('desktop-item-1');
  });
});
