// UserMenu 负责基于通用用户菜单组件装配主站默认菜单项。
import React from 'react';
import { AppUserMenu, type AppUserMenuItem, type AppUserMenuUser } from '@leary/ui';
import MaterialIcon from './icons/MaterialIcon';

interface UserMenuProps {
  user?: AppUserMenuUser | null;
  onLogout: () => void;
  items?: AppUserMenuItem[];
}

const defaultItems = (onLogout: () => void): AppUserMenuItem[] => [
  {
    key: 'profile',
    label: '个人中心',
    icon: <MaterialIcon name="person" className="text-[18px]" />,
  },
  {
    key: 'settings',
    label: '设置',
    icon: <MaterialIcon name="settings" className="text-[18px]" />,
  },
  {
    key: 'help',
    label: '帮助支持',
    icon: <MaterialIcon name="help_outline" className="text-[18px]" />,
  },
  {
    key: 'logout',
    label: '退出登录',
    icon: <MaterialIcon name="logout" className="text-[18px]" />,
    tone: 'danger',
    onSelect: onLogout,
  },
];

const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout, items }) => (
  <AppUserMenu
    user={user}
    items={items ?? defaultItems(onLogout)}
    triggerIcon={<MaterialIcon name="owl" className="text-[18px] text-slate-500 dark:text-[#c7d8db]" />}
    caretIcon={<MaterialIcon name="keyboard_arrow_down" className="text-slate-400 text-sm" />}
  />
);

export default UserMenu;
