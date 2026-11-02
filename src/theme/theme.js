import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';

const LIGHT_COLORS = {
  accent: '#0099FF',
  accent_soft: 'rgba(0, 153, 255, 0.14)',
  on_accent: '#FFFFFF',
  canvas: '#FFFFFF',
  surface: '#F2F2F7',
  pane: '#F2F2F2',
  selection: '#F7F7F7',
  ink: '#000000',
  ink_soft: '#6C6C70',
  line: '#E5E5EA',
  bubble: 'rgba(255, 255, 255, 0.6)',
  scrim: 'rgba(0, 0, 0, 0.45)',
  danger: '#FF3B30',
};

const DARK_COLORS = {
  accent: '#7ECBFF',
  accent_soft: 'rgba(126, 203, 255, 0.16)',
  on_accent: '#00213A',
  canvas: '#000000',
  surface: '#19191A',
  pane: '#262626',
  selection: '#262626',
  ink: '#FFFFFF',
  ink_soft: '#98989F',
  line: '#38383A',
  bubble: 'rgba(0, 0, 0, 0.6)',
  scrim: 'rgba(0, 0, 0, 0.6)',
  danger: '#FF453A',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const GRID_TILE_MIN_WIDTH = 160;
export const GRID_GAP = 6;
export const MAX_CARD_PHOTO_HEIGHT = 600;

export function get_theme(is_dark) {
  return {
    is_dark,
    colors: is_dark ? DARK_COLORS : LIGHT_COLORS,
  };
}

export function use_theme() {
  return get_theme(useColorScheme() === 'dark');
}

export function build_navigation_theme(theme) {
  const base_theme = theme.is_dark ? DarkTheme : DefaultTheme;

  return {
    ...base_theme,
    colors: {
      ...base_theme.colors,
      background: theme.colors.canvas,
      border: theme.colors.line,
      card: theme.colors.canvas,
      notification: theme.colors.accent,
      primary: theme.colors.accent,
      text: theme.colors.ink,
    },
  };
}
