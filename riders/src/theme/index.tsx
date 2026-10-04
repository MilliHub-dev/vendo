import { createContext, use, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '@/store/settings';

import { darkColors, lightColors, type ThemeColors } from './tokens';

export type Theme = { scheme: 'light' | 'dark'; colors: ThemeColors };

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: lightColors });

/** Resolves the theme: the user's choice in Settings, otherwise the phone's setting. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const preference = useSettings((s) => s.appearance);
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const theme: Theme = { scheme, colors: scheme === 'dark' ? darkColors : lightColors };
  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

export function useTheme() {
  return use(ThemeContext);
}

export * from './tokens';
