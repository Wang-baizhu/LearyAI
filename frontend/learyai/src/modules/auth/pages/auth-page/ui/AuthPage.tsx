// AuthPage 作为页面层，负责组织 layout 与 feature 组件，仅处理导航与 view 控制。
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout, resolveAuthRedirectTarget } from '../../../shared';
import { LoginForm } from '../../../features';
import { InviteRegisterForm } from '../../../features';
import { RegisterForm } from '../../../features';
import { VerificationForm } from '../../../features';
import { useAuthFeature } from '../../../features';
import type { AuthView } from '../../../shared';
import { useUserSession } from '../../../entities/user';

const AuthPage: React.FC = () => {
  const [view, setView] = useState<AuthView>('login');
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useUserSession();
  const {
    countdown,
    loginMutation,
    prepareRegisterMutation,
    registerWithInviteMutation,
    sendCodeMutation,
    verifyMutation,
  } = useAuthFeature();
  const redirectTarget = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return resolveAuthRedirectTarget(params.get('redirect'));
  }, [location.search]);

  useEffect(() => {
    if (loginMutation.isSuccess) {
      navigate(redirectTarget, { replace: true });
    }
  }, [loginMutation.isSuccess, navigate, redirectTarget]);

  useEffect(() => {
    if (session) {
      navigate(redirectTarget, { replace: true });
    }
  }, [navigate, redirectTarget, session]);

  const handleSwitchToLogin = () => {
    prepareRegisterMutation.reset();
    registerWithInviteMutation.reset();
    verifyMutation.reset();
    setView('login');
  };

  const handleSwitchToRegister = () => {
    prepareRegisterMutation.reset();
    registerWithInviteMutation.reset();
    verifyMutation.reset();
    setView('registerInvite');
  };

  const handleSwitchToInviteRegister = () => {
    prepareRegisterMutation.reset();
    registerWithInviteMutation.reset();
    verifyMutation.reset();
    setView('registerInvite');
  };

  return (
    <Layout view={view}>
      {view === 'login' && (
        <LoginForm
          mutation={loginMutation}
          onSubmit={(payload) => loginMutation.mutate(payload)}
          onSwitch={handleSwitchToRegister}
        />
      )}
      {view === 'register' && (
        <RegisterForm
          mutation={prepareRegisterMutation}
          onSubmit={(payload) =>
            prepareRegisterMutation.mutate(payload, {
              onSuccess: () => setView('verify'),
            })
          }
          onSwitch={handleSwitchToLogin}
          onInviteSwitch={handleSwitchToInviteRegister}
        />
      )}
      {view === 'registerInvite' && (
        <InviteRegisterForm
          mutation={registerWithInviteMutation}
          onSubmit={(payload) =>
            registerWithInviteMutation.mutate(payload, {
              onSuccess: () => setView('login'),
            })
          }
          onSwitchLogin={handleSwitchToLogin}
          onSwitchSmsRegister={() => {
            prepareRegisterMutation.reset();
            registerWithInviteMutation.reset();
            verifyMutation.reset();
            setView('register');
          }}
        />
      )}
      {view === 'verify' && (
        <VerificationForm
          mutation={verifyMutation}
          countdown={countdown}
          sendCodeMutation={sendCodeMutation}
          onRequestCode={(phone) => sendCodeMutation.mutate(phone)}
          onSubmit={(payload) =>
            verifyMutation.mutate(payload, {
              onSuccess: () => setView('login'),
            })
          }
          onBack={handleSwitchToLogin}
        />
      )}
    </Layout>
  );
};

export default AuthPage;
