/* eslint-disable react-refresh/only-export-components */
// ThemeProvider 与 ThemeContext 合并在单文件，便于导出与引用。
import React, { createContext } from 'react';

export interface ThemeContextValue {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  value: ThemeContextValue;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ value, children }) => {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
