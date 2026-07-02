// 责任：展示管理后台顶部信息与管理员会话摘要。
import React from 'react';
import {Bell, Search, User} from 'lucide-react';
import {useAuth} from '@/modules/auth/hooks/useAuth';

export const Header: React.FC = () => {
  const {isLoading, isAdmin, totalUsers} = useAuth();

  return (
    <header className="h-16 border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-10 px-8 flex items-center justify-between">
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
        <input
          type="text"
          placeholder="搜索资源..."
          className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-zinc-500 hover:bg-zinc-50 rounded-lg transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-8 w-[1px] bg-black/5 mx-2"></div>

        <div className="flex items-center gap-3 pl-2 cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-zinc-900 leading-none">
              {isLoading ? '正在校验会话...' : isAdmin ? '管理员会话有效' : '会话无管理员权限'}
            </p>
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mt-1">
              {isAdmin ? `TOTAL USERS ${totalUsers}` : 'ADMIN CHECK FAILED'}
            </p>
          </div>
          <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 border border-black/5 group-hover:bg-zinc-200 transition-colors">
            <User size={20} />
          </div>
        </div>
      </div>
    </header>
  );
};
