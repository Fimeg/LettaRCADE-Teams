/**
 * Design tokens for the Letta component library.
 * These map to CSS custom properties defined in index.css
 */

export const colors = {
  brand: {
    DEFAULT: '#0606ac',
    content: '#fafafa',
    hover: '#4a4a8c',
    light: '#f5f5ff',
    'light-content': '#0606ac',
  },
  surface: {
    DEFAULT: '#ffffff',
    secondary: '#fafafa',
    tertiary: '#f5f5f5',
    hover: '#fafafa',
  },
  ink: {
    900: '#141414',
    800: '#474747',
    700: '#474747',
    600: '#737373',
    500: '#8c8c8c',
    400: '#a6a6a6',
  },
  accent: {
    DEFAULT: '#0606ac',
    hover: '#4a4a8c',
    light: '#f5f5ff',
    subtle: '#ebebf5',
  },
  status: {
    error: '#c41952',
    'error-light': '#fdf2f5',
    success: '#16a34a',
    'success-light': '#f0fdf4',
    info: '#0606ac',
    'info-light': '#f5f5ff',
    warning: '#b87800',
    'warning-light': '#fffbeb',
  },
  border: {
    DEFAULT: '#e8e8e8',
    hover: '#c7c7e8',
  },
  bg: {
    0: '#ffffff',
    100: '#fafafa',
    200: '#f5f5f5',
    300: '#e8e8e8',
    400: '#d9d9d9',
  },
  muted: {
    DEFAULT: '#9ca3af',
    light: '#a6a6a6',
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem',    // 4px
  2: '0.5rem',     // 8px
  3: '0.75rem',    // 12px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  8: '2rem',       // 32px
  10: '2.5rem',    // 40px
  12: '3rem',      // 48px
  16: '4rem',      // 64px
} as const;

export const typography = {
  fontFamily: {
    sans: ['"Onest"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
    mono: ['"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const shadows = {
  soft: '0 1px 2px rgba(0, 0, 0, 0.05)',
  card: '0 4px 16px rgba(0, 0, 0, 0.08)',
  elevated: '0 8px 32px rgba(0, 0, 0, 0.12)',
} as const;

export const radii = {
  none: '0',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  full: '9999px',
} as const;

export const transitions = {
  fast: '150ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
} as const;

export const zIndices = {
  hide: -1,
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const touch = {
  minTarget: '44px',
} as const;
