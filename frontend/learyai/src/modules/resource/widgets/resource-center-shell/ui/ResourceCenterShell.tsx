// ResourceCenterShell 负责资源中心页面外层布局骨架与移动端视图切换承载。
import React from 'react';
import GlobalMobileBottomNav from '@/shared/ui/GlobalMobileBottomNav';

interface ResourceCenterShellProps {
  dock: React.ReactNode;
  children: React.ReactNode;
  mobileActiveView: 'ai' | 'resource';
  onMobileViewChange: (view: 'ai' | 'resource') => void;
  onMobileActionClick: () => void;
  isMobileActionActive: boolean;
}

const ResourceCenterShell: React.FC<ResourceCenterShellProps> = ({
  dock,
  children,
  mobileActiveView,
  onMobileViewChange,
  onMobileActionClick,
  isMobileActionActive,
}) => {
  return (
    <div className="relative flex h-screen w-full flex-col gap-4 overflow-hidden bg-[#f2f4f8] p-0 transition-colors duration-500 dark:bg-[#121212] lg:flex-row lg:p-4">
      <div className={`${mobileActiveView === 'ai' ? 'flex' : 'hidden'} min-h-0 flex-1 lg:flex lg:flex-none`}>
        {dock}
      </div>
      <main className={`${mobileActiveView === 'resource' ? 'flex' : 'hidden'} relative min-h-0 flex-1 flex-col overflow-hidden border border-slate-200 bg-[#f6f8fb] shadow-xl shadow-black/5 pb-[5.5rem] dark:border-[#2a2a2a] dark:bg-[#121212] lg:flex lg:rounded-3xl lg:pb-0`}>
        {children}
      </main>
      <GlobalMobileBottomNav
        leftItem={{ key: 'ai', onClick: () => onMobileViewChange('ai') }}
        rightItem={{ key: 'resource', onClick: () => onMobileViewChange('resource') }}
        activeKey={mobileActiveView}
        centerAction={{
          onClick: onMobileActionClick,
          active: isMobileActionActive,
          ariaLabel: '打开资源操作菜单',
        }}
      />
    </div>
  );
};

export default ResourceCenterShell;
