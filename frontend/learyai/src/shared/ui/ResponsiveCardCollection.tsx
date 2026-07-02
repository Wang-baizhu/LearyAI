// ResponsiveCardCollection 负责承载移动端卡片列表与桌面端网格双视图切换。
import React from 'react';

interface ResponsiveCardCollectionProps<T> {
  items: T[];
  renderMobileItem: (item: T, index: number) => React.ReactNode;
  renderDesktopItem: (item: T, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
  getKey?: (item: T, index: number) => React.Key;
  mobileListClassName?: string;
  desktopGridClassName?: string;
}

const ResponsiveCardCollection = <T,>({
  items,
  renderMobileItem,
  renderDesktopItem,
  emptyState = null,
  getKey,
  mobileListClassName = 'space-y-3 md:hidden',
  desktopGridClassName = 'hidden min-w-[520px] grid-cols-1 gap-6 md:grid md:grid-cols-2 xl:grid-cols-2',
}: ResponsiveCardCollectionProps<T>) => {
  if (!items.length) {
    return <>{emptyState}</>;
  }

  return (
    <>
      <div className={mobileListClassName}>
        {items.map((item, index) => (
          <React.Fragment key={getKey?.(item, index) ?? index}>
            {renderMobileItem(item, index)}
          </React.Fragment>
        ))}
      </div>
      <div className={desktopGridClassName}>
        {items.map((item, index) => (
          <React.Fragment key={getKey?.(item, index) ?? index}>
            {renderDesktopItem(item, index)}
          </React.Fragment>
        ))}
      </div>
    </>
  );
};

export default ResponsiveCardCollection;
