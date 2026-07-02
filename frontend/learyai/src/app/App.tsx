// App 负责全局 Provider、主题状态、会话启动与应用壳装配。
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Provider } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import DialogHost from '@/shared/ui/DialogHost';
import ToastHost from '@/shared/ui/ToastHost';
import { ThemeProvider } from '@/shared/contexts/ThemeContext';
import { AppRouter } from '@/app/router/AppRouter';
import { store } from '@/app/store';
import { authApi, useUserSession } from '@/modules/auth';

const SessionBootstrap: React.FC<{ onReady: () => void }> = ({ onReady }) => {
  const { setSession } = useUserSession();
  const readyRef = useRef(false);

  const { data, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data) {
      setSession(data.session);
    } else if (error) {
      setSession(null);
    }

    if ((data || error) && !readyRef.current) {
      readyRef.current = true;
      onReady();
    }
  }, [data, error, onReady, setSession]);

  return null;
};

const App: React.FC = () => {
  const themeStorageKey = 'learyai.theme';
  const [isDark, setIsDark] = useState(() => {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    if (storedTheme === 'dark') {
      return true;
    }
    if (storedTheme === 'light') {
      return false;
    }

    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [sessionReady, setSessionReady] = useState(false);
  const handleSessionReady = useCallback(() => setSessionReady(true), []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    window.localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleDarkMode = useCallback(() => {
    const root = document.documentElement;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const maxRadius = Math.hypot(centerX, centerY);
    const direction = isDark ? 'to-light' : 'to-dark';
    const applyTheme = () => setIsDark((prev) => !prev);
    const doc = document as unknown as {
      startViewTransition?: Document['startViewTransition'];
    };

    root.style.setProperty('--theme-transition-x', `${centerX}px`);
    root.style.setProperty('--theme-transition-y', `${centerY}px`);
    root.style.setProperty('--theme-transition-r', `${maxRadius}px`);
    root.setAttribute('data-theme-transition', direction);

    if (typeof doc.startViewTransition !== 'function') {
      applyTheme();
      root.removeAttribute('data-theme-transition');
      return;
    }

    const transition = doc.startViewTransition(() => {
      applyTheme();
    });

    transition.finished.finally(() => {
      root.removeAttribute('data-theme-transition');
    });
  }, [isDark]);

  return (
    <Provider store={store}>
      <SessionBootstrap onReady={handleSessionReady} />
      <ThemeProvider value={{ isDarkMode: isDark, toggleTheme: toggleDarkMode }}>
        <div className="app-safe-area">
          <AppRouter isDarkMode={isDark} onToggleTheme={toggleDarkMode} sessionReady={sessionReady} />
          <DialogHost />
          <ToastHost />
        </div>
      </ThemeProvider>
    </Provider>
  );
};

export default App;
