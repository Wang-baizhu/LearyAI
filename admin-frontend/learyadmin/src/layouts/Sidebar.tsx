/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, LogOut, ShieldCheck, KeyRound, Package, ClipboardCheck, Ticket, ShieldAlert, Clock3 } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const menuItems = [
  { label: '仪表盘', path: '/', icon: LayoutDashboard },
  { label: '用户管理', path: '/users', icon: Users },
  { label: '会员周期设置', path: '/user-subscription-cycles', icon: Clock3 },
  { label: '资源用量', path: '/usage', icon: Activity },
  { label: '邀请码状态', path: '/invites', icon: KeyRound },
  { label: '注册邀请码', path: '/register-invites', icon: Ticket },
  { label: '任务 DLQ', path: '/task-dlq', icon: ShieldAlert },
  { label: '发布审核', path: '/review-tasks', icon: ClipboardCheck },
  { label: '模板开发包', path: '/template-dev-packages', icon: Package },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 border-r border-black/5 bg-white h-screen flex flex-col sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white">
          <ShieldCheck size={20} />
        </div>
        <span className="font-bold text-lg tracking-tight text-zinc-900">管理控制台</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-zinc-900 text-white shadow-md shadow-zinc-900/10'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-black/5">
        <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors">
          <LogOut size={18} />
          退出登录
        </button>
      </div>
    </aside>
  );
};
