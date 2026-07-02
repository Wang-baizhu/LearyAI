// Header 负责渲染工作区顶栏导航与主题/用户入口。
import React from 'react';
import { AppHeader, type AppHeaderTabItem } from '@leary/ui';
import ThemeToggle from '@/shared/ui/ThemeToggle';
import UserMenu from '@/shared/ui/UserMenu';
import { useCurrentUser } from '../../../../auth';
import { useTheme } from '@/shared/contexts/useTheme';
import { TourStep } from '@leary/tour-guide';

const WORKSPACE_TOUR_TAG = 'workspace-quick-start-v1';

interface HeaderProps {
  onLogout: () => void;
  activeTab: 'quick-start' | 'project-management';
  onTabChange: (tab: 'quick-start' | 'project-management') => void;
  enableTour?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  onLogout,
  activeTab,
  onTabChange,
  enableTour = false,
}) => {
  const user = useCurrentUser();
  const { isDarkMode, toggleTheme } = useTheme();
  const tabs: AppHeaderTabItem<'quick-start' | 'project-management'>[] = [
    {
      key: 'quick-start',
      label: '快速开始',
      active: activeTab === 'quick-start',
      onClick: () => onTabChange('quick-start'),
    },
    {
      key: 'project-management',
      label: '空间管理',
      active: activeTab === 'project-management',
      onClick: () => onTabChange('project-management'),
      wrapper: enableTour
        ? (node) => (
            <TourStep
              tag={WORKSPACE_TOUR_TAG}
              order={4}
              title="空间管理"
              content="点击这里可切换到不同空间的管理面板。"
            >
              <>{node}</>
            </TourStep>
          )
        : undefined,
    },
  ];

  return (
    <AppHeader
      brandLogoSrc="/icon-animate.svg"
      brandLogoAlt="Leary AI"
      brandTitle="Leary AI"
      tabs={tabs}
      themeToggle={<ThemeToggle isDarkMode={isDarkMode} onToggle={toggleTheme} />}
      userMenu={<UserMenu user={user} onLogout={onLogout} />}
    />
  );
};

export default Header;
