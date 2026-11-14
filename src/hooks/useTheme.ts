import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tp-theme';
const META_COLORS: Record<Theme, string> = { light: '#f3f5f9', dark: '#0a0e17' };

function readInitial(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme: Theme, animate: boolean) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 250);
  }
  root.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
}

/**
 * Light/dark theme. The initial class is set by an inline script in index.html
 * (no flash of the wrong theme). A stored choice wins; otherwise we follow the OS
 * setting live until the user picks one explicitly.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next, true);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode / storage blocked: theme still applies for this session */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(readInitial() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      let stored: string | null = null;
      try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
      if (stored) return; // explicit user choice wins
      const next: Theme = e.matches ? 'dark' : 'light';
      setThemeState(next);
      applyTheme(next, true);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return { theme, setTheme, toggleTheme };
}
