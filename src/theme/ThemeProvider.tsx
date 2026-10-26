import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, Palette, SubjectTone, subjectKey } from './tokens';
import { useAppStore, ThemeMode } from '../lib/store/useAppStore';

interface ThemeValue {
  colors: Palette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  subject: (name?: string | null) => SubjectTone;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const mode = useAppStore((s) => s.themeMode);
  const setMode = useAppStore((s) => s.setThemeMode);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  const value = useMemo<ThemeValue>(() => {
    const colors = isDark ? darkPalette : lightPalette;
    return {
      colors,
      isDark,
      mode,
      setMode,
      subject: (name) => colors.subjects[subjectKey(name)] ?? colors.subjects.default,
    };
  }, [isDark, mode, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
