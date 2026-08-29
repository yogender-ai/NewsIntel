import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeContext } from './theme-context';

const KEY = 'ni_theme';

function read() {
  try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(read);

  useEffect(() => {
    const root = document.documentElement;
    // "system" stamps nothing, letting prefers-color-scheme decide.
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const setTheme = useCallback((next) => setThemeState(next), []);
  const cycle = useCallback(
    () => setThemeState((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light')),
    [],
  );

  const value = useMemo(() => ({ theme, setTheme, cycle }), [theme, setTheme, cycle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
