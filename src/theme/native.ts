export type AppearancePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const APPEARANCE_STORAGE_KEY = 'tally.appearance';

/** Concrete hex for React Navigation, Switch, StatusBar — Uniwind classNames cannot drive these. */
export const nativeColors = {
  light: {
    canvas: '#f9f8f7',
    ink: '#32302f',
    inkMuted: '#686664',
    inkFaint: '#94908d',
    sage: '#486635',
    sageMist: '#e8efe3',
    dust: '#e4e2e1',
    chip: '#efece8',
    surface: '#fcfcfc',
    surfaceRaised: '#ffffff',
    line: '#e8e6e4',
    switchThumb: '#fcfcfc',
    switchTrackOff: '#e4e2e1',
  },
  dark: {
    canvas: '#121110',
    ink: '#f2efeb',
    inkMuted: '#a8a39c',
    inkFaint: '#7a756f',
    sage: '#8fad73',
    sageMist: '#243022',
    dust: '#2a2826',
    chip: '#2a2826',
    surface: '#1a1917',
    surfaceRaised: '#22211e',
    line: '#2e2c29',
    switchThumb: '#f2efeb',
    switchTrackOff: '#2a2826',
  },
} as const;

export function colorsFor(theme: ResolvedTheme) {
  return nativeColors[theme];
}

export function stackHeaderOptions(theme: ResolvedTheme) {
  const c = colorsFor(theme);
  return {
    headerTintColor: c.ink,
    headerStyle: { backgroundColor: c.canvas },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
  };
}

export function tabBarColors(theme: ResolvedTheme) {
  const c = colorsFor(theme);
  return {
    tabBarStyle: {
      backgroundColor: c.canvas,
      borderTopColor: c.line,
      borderTopWidth: 1,
      height: 88,
      paddingTop: 10,
    },
    tabBarActiveTintColor: c.ink,
    tabBarInactiveTintColor: c.inkFaint,
  };
}
