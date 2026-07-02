// RequireAuth 负责在路由层做会话守卫与加载占位。
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserSession } from '../../../entities/user';
import { buildLoginRedirectPath } from '../../../shared';
import HyperSpeedLoader from '@/shared/ui/HyperSpeedLoader';

interface RequireAuthProps {
  sessionReady: boolean;
  children: React.ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ sessionReady, children }) => {
  const { session } = useUserSession();
  const location = useLocation();

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] px-6 py-8">
        <div className="mx-auto h-[420px] w-full max-w-4xl">
          <HyperSpeedLoader />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={buildLoginRedirectPath(location)} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
