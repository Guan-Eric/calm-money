import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Uniwind, useUniwind } from 'uniwind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APPEARANCE_STORAGE_KEY,
  type AppearancePreference,
  type ResolvedTheme,
  colorsFor,
} from '@/theme/native';

type ThemeContextValue = {
  appearance: AppearancePreference;
  setAppearance: (next: AppearancePreference) => void;
  resolvedTheme: ResolvedTheme;
  colors: ReturnType<typeof colorsFor>;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyUniwindTheme(pref: AppearancePreference) {
  Uniwind.setTheme(pref);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useUniwind();
  const [appearance, setAppearanceState] = useState<AppearancePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY);
        const pref =
          stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
        if (!cancelled) {
          setAppearanceState(pref);
          applyUniwindTheme(pref);
        }
      } catch {
        if (!cancelled) applyUniwindTheme('system');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setAppearance = useCallback((next: AppearancePreference) => {
    setAppearanceState(next);
    applyUniwindTheme(next);
    void AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, next);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'dark' ? 'dark' : 'light';

  const value = useMemo<ThemeContextValue>(
    () => ({
      appearance,
      setAppearance,
      resolvedTheme,
      colors: colorsFor(resolvedTheme),
      ready,
    }),
    [appearance, setAppearance, resolvedTheme, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
