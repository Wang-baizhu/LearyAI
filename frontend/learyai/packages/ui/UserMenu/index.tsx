// AppUserMenu 负责提供可复用的用户菜单弹窗与菜单项配置能力。
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface AppUserMenuUser {
  name?: string | null;
  email?: string | null;
  userMode?: string | null;
}

export interface AppUserMenuItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onSelect?: () => void;
}

interface AppUserMenuProps {
  user?: AppUserMenuUser | null;
  items: AppUserMenuItem[];
  triggerIcon?: ReactNode;
  caretIcon?: ReactNode;
}

export const AppUserMenu = ({ user, items, triggerIcon, caretIcon }: AppUserMenuProps) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = user?.name ?? user?.email ?? '用户信息';
  const displayInitial = displayName.slice(0, 1).toUpperCase();
  const userModeLabel = user?.userMode ?? 'ERROR';
  const userModeClassName =
    user?.userMode == null
      ? 'bg-red-100 text-red-600'
      : 'bg-primary/10 text-primary';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={`flex items-center gap-2 p-1 bg-white dark:bg-[#1b1f21] border rounded-xl transition-all active:scale-95 shadow-sm ${
          open
            ? 'border-primary ring-2 ring-primary/5'
            : 'border-slate-200 dark:border-[#2a3f41] hover:border-slate-300'
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        <div className="size-8 rounded-lg overflow-hidden border border-slate-100 dark:border-black/20 shadow-sm flex items-center justify-center">
          {triggerIcon ?? (
            <span className="inline-flex items-center justify-center w-full h-full text-sm font-black text-slate-700 dark:text-[#c7d8db]">
              {displayInitial}
            </span>
          )}
        </div>
        <span className="text-sm font-black text-slate-700 dark:text-[#c7d8db] pr-1">
          {displayInitial}
        </span>
        <span className={`text-slate-400 text-sm transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          {caretIcon ?? '▾'}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-3 w-56 bg-white/95 dark:bg-[#1b2526]/95 backdrop-blur-xl border border-slate-200 dark:border-[#2a3f41] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-[#2a3f41] mb-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white">{displayName}</p>
              <span className={`${userModeClassName} text-[8px] px-1.5 py-0.5 rounded font-black uppercase`}>
                {userModeLabel}
              </span>
            </div>
          </div>
          <div className="p-1.5 space-y-0.5">
            {items.map((item, index) => (
              <div key={item.key}>
                {item.tone === 'danger' && index > 0 ? (
                  <div className="h-px bg-slate-100 dark:bg-[#2a3f41] my-1 mx-3"></div>
                ) : null}
                <button
                  type="button"
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl text-xs transition-all group ${
                    item.tone === 'danger'
                      ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                      : 'text-slate-600 dark:text-[#c7d8db] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary'
                  }`}
                  disabled={item.disabled}
                  onClick={() => {
                    item.onSelect?.();
                    setOpen(false);
                  }}
                >
                  {item.icon ? <span className="inline-flex items-center justify-center text-[18px] text-slate-400 group-hover:text-primary">{item.icon}</span> : null}
                  <span>{item.label}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AppUserMenu;
