/**
 * THE CRUNCH Design Tokens
 * Shared color palette used by WorksWheel and Products V2 page
 * Ensures visual consistency across components
 */

// ── Core Palette ──
export const COLORS = {
  // Base neutrals
  DEEP_BASE: '#0A0A0A',
  STAGE_BASE: '#0D0D0D',
  CARD_SURFACE: '#131313',

  // Borders
  CARD_BORDER: 'rgba(201, 168, 76, 0.12)',
  CARD_BORDER_STRONG: 'rgba(201, 168, 76, 0.22)',

  // Brand gold
  GOLD: '#C9A84C',
  GOLD_DIM: '#B8953A',
  GOLD_LIGHT: '#E8D4A0',

  // Typography
  CREAM: '#F5F2EA',
  MUTED: '#ACA69A',
  MUTED_DIM: '#7A756B',

  // Ambient effects
  SPOTLIGHT: 'rgba(201, 168, 76, 0.08)',
  SPOTLIGHT_STRONG: 'rgba(201, 168, 76, 0.15)',
  ORBITAL: 'rgba(201, 168, 76, 0.06)',
  ORBITAL_ACTIVE: 'rgba(201, 168, 76, 0.18)',
  PEDESTAL: 'rgba(201, 168, 76, 0.04)',
  PEDESTAL_ACTIVE: 'rgba(201, 168, 76, 0.1)',
  GLOW: 'rgba(201, 168, 76, 0.25)',
  GLOW_STRONG: 'rgba(201, 168, 76, 0.4)',

  // Navbar / Page
  NAVBAR_BG: 'rgba(26, 26, 26, 0.92)',
  NAVBAR_BORDER: 'rgba(89, 92, 86, 0.25)',
  NAVBAR_SHADOW: '0 8px 30px rgba(0, 0, 0, 0.35)',
  PAGE_BG: '#0D0D0D',
  CARD_BG: '#1A1A1A',
  TEXT_PRIMARY: '#F5F0E8',
  TEXT_MUTED: 'rgba(245, 240, 232, 0.58)',
} as const;

// ── Semantic aliases for page-level usage ──
export const PAGE_COLORS = {
  background: COLORS.PAGE_BG,
  surface: COLORS.CARD_BG,
  border: COLORS.NAVBAR_BORDER,
  text: COLORS.TEXT_PRIMARY,
  textMuted: COLORS.TEXT_MUTED,
  brand: COLORS.GOLD,
  brandDim: COLORS.GOLD_DIM,
  brandLight: COLORS.GOLD_LIGHT,
  accent: COLORS.GOLD,
  accentDim: COLORS.GOLD_DIM,
  accentLight: COLORS.GOLD_LIGHT,
} as const;

// ── WorksWheel-specific tokens (re-exported for convenience) ──
export const WHEEL_COLORS = {
  deepBase: COLORS.DEEP_BASE,
  stageBase: COLORS.STAGE_BASE,
  cardSurface: COLORS.CARD_SURFACE,
  cardBorder: COLORS.CARD_BORDER,
  cardBorderStrong: COLORS.CARD_BORDER_STRONG,
  gold: COLORS.GOLD,
  goldDim: COLORS.GOLD_DIM,
  goldLight: COLORS.GOLD_LIGHT,
  cream: COLORS.CREAM,
  muted: COLORS.MUTED,
  mutedDim: COLORS.MUTED_DIM,
  spotlight: COLORS.SPOTLIGHT,
  spotlightStrong: COLORS.SPOTLIGHT_STRONG,
  orbital: COLORS.ORBITAL,
  orbitalActive: COLORS.ORBITAL_ACTIVE,
  pedestal: COLORS.PEDESTAL,
  pedestalActive: COLORS.PEDESTAL_ACTIVE,
  glow: COLORS.GLOW,
  glowStrong: COLORS.GLOW_STRONG,
} as const;

// ── Typography ──
export const FONTS = {
  display: "'Poppins', 'Inter', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

// ── Spacing scale ──
export const SPACING = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
  '4xl': '6rem',   // 96px
} as const;

// ── Breakpoints ──
export const BREAKPOINTS = {
  xs: '320px',
  sm: '375px',
  md: '390px',
  lg: '430px',
  tablet: '768px',
  laptop: '1024px',
  desktop: '1440px',
} as const;

// ── Z-index scale ──
export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  modal: 100,
  popover: 200,
  tooltip: 300,
  toast: 400,
  navbar: 100,
} as const;

// ── Transition durations ──
export const TRANSITIONS = {
  fast: '150ms',
  normal: '250ms',
  slow: '400ms',
  slower: '600ms',
} as const;

// ── Easing curves ──
export const EASING = {
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;