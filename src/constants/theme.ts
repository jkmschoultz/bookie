import { Platform } from 'react-native';

/** One warm "evening library" palette used throughout the app. */
export const Colors = {
  background: '#1a120c',
  surface: '#271b13',
  surfaceRaised: '#33251a',
  border: '#4a3626',
  text: '#f3e9d6',
  textMuted: '#b9a68d',
  accent: '#d9a441',
  accentText: '#1a120c',
  danger: '#d4634a',
  ribbon: '#b3202a',
} as const;

export const Wood = {
  backPanel: ['#20150d', '#2c1d12', '#23170e'] as const,
  side: ['#4a2e1a', '#6b4526', '#4a2e1a'] as const,
  plankTop: ['#a0703f', '#7d5230'] as const,
  plankFront: ['#6e4526', '#4f311b', '#3d2514'] as const,
  brass: ['#e8c875', '#b88a36'] as const,
  brassText: '#3a2708',
} as const;

export const Shelf = {
  /** Inner height available for books (tallest spine is 212). */
  innerHeight: 228,
  plankTop: 6,
  plankFront: 22,
  sidePanel: 10,
  gutter: 14,
  gap: 1,
} as const;

export const Fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
  sans: Platform.select({ ios: 'System', android: 'sans-serif-condensed', default: 'system-ui, sans-serif' }),
} as const;
