import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SidebarHeader from '../SidebarHeader';

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

describe('SidebarHeader', () => {
  it('renders the sidebar header safely', () => {
    const render = () =>
      renderToStaticMarkup(
        <SidebarHeader
          showHistory
          onToggleHistory={vi.fn()}
          isHistoryDisabled={false}
          isCollapsed
          onToggleCollapsed={vi.fn()}
          showCollapseToggle
        />
      );

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('Leary AI');
    expect(markup).toContain('chat');
    expect(markup).toContain('chevron_right');
  });
});
