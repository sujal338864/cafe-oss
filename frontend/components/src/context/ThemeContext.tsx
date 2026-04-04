'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeName = 'dark' | 'light' | 'purple' | 'ocean';

export interface ThemeTokens {
  name:         ThemeName;
  bg:           string;
  sidebar:      string;
  headerBg:     string;
  card:         string;
  input:        string;
  inputBg:      string;
  border:       string;
  text:         string;
  textMuted:    string;
  textFaint:    string;
  hover:        string;
  accent:       string;
  accentBg:     string;
  accentBorder: string;
  isDark:       boolean;
}

export const THEMES: Record<ThemeName, ThemeTokens> = {
  dark: {
    name: 'dark', isDark: true,
    bg:           '#0a0a10',
    sidebar:      '#0d0d16',
    headerBg:     '#0d0d16',
    card:         '#15151d',
    input:        '#1c1c26',
    inputBg:      '#1c1c26',
    border:       'rgba(255,255,255,0.07)',
    text:         '#e2e8f0',
    textMuted:    '#475569',
    textFaint:    '#334155',
    hover:        'rgba(255,255,255,0.04)',
    accent:       '#a78bfa',
    accentBg:     'rgba(124,58,237,0.15)',
    accentBorder: 'rgba(124,58,237,0.35)',
  },
  light: {
    name: 'light', isDark: false,
    bg:           '#f5f6fa',
    sidebar:      '#ffffff',
    headerBg:     '#ffffff',
    card:         '#ffffff',
    input:        '#f1f5f9',
    inputBg:      '#f1f5f9',
    border:       '#e8eaed',
    text:         '#111827',
    textMuted:    '#6b7280',
    textFaint:    '#9ca3af',
    hover:        'rgba(0,0,0,0.04)',
    accent:       '#7c3aed',
    accentBg:     'rgba(124,58,237,0.08)',
    accentBorder: 'rgba(124,58,237,0.25)',
  },
  purple: {
    name: 'purple', isDark: true,
    bg:           '#13111a',
    sidebar:      '#1a1625',
    headerBg:     '#1a1625',
    card:         '#1e1a2e',
    input:        '#251f38',
    inputBg:      '#251f38',
    border:       'rgba(192,132,252,0.12)',
    text:         '#ede9fe',
    textMuted:    '#a78bfa',
    textFaint:    '#7c3aed',
    hover:        'rgba(192,132,252,0.06)',
    accent:       '#c084fc',
    accentBg:     'rgba(192,132,252,0.15)',
    accentBorder: 'rgba(192,132,252,0.35)',
  },
  ocean: {
    name: 'ocean', isDark: true,
    bg:           '#0a1628',
    sidebar:      '#0f1e35',
    headerBg:     '#0f1e35',
    card:         '#132540',
    input:        '#1a3050',
    inputBg:      '#1a3050',
    border:       'rgba(56,189,248,0.12)',
    text:         '#e0f2fe',
    textMuted:    '#7dd3fc',
    textFaint:    '#38bdf8',
    hover:        'rgba(56,189,248,0.06)',
    accent:       '#38bdf8',
    accentBg:     'rgba(56,189,248,0.12)',
    accentBorder: 'rgba(56,189,248,0.30)',
  },
};

interface ThemeCtx {
  theme:       ThemeTokens;
  isDark:      boolean;
  themeName:   ThemeName;
  setTheme:    (n: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: THEMES.dark, isDark: true, themeName: 'dark',
  setTheme: () => {}, toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('dark');
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('shop_os_theme') as ThemeName;
    if (saved && THEMES[saved]) setThemeName(saved);
    setMounted(true);
  }, []);

  const setTheme = (n: ThemeName) => {
    setThemeName(n);
    localStorage.setItem('shop_os_theme', n);
  };

  const toggleTheme = () => setTheme(themeName === 'dark' ? 'light' : 'dark');

  const theme = THEMES[themeName];

  if (!mounted) return (
    <div style={{ background: THEMES.dark.bg, minHeight: '100vh' }}>{children}</div>
  );

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme.isDark, themeName, setTheme, toggleTheme }}>
      <div style={{ background: theme.bg, color: theme.text, minHeight: '100vh' }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
