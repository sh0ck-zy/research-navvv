import { useEffect } from 'react';
import { useTheme } from './useTheme';

export function useThemeSync() {
  const theme = useTheme((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);
}
