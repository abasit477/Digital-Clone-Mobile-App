/**
 * Color System — Stripe / Linear inspired
 * Deep blue / indigo primary, gradient accents
 */

const palette = {
  // Core Indigo / Blue
  indigo50:  '#EEF2FF',
  indigo100: '#E0E7FF',
  indigo200: '#C7D2FE',
  indigo300: '#A5B4FC',
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  indigo700: '#4338CA',
  indigo800: '#3730A3',
  indigo900: '#312E81',

  // Purple accent
  purple400: '#C084FC',
  purple500: '#A855F7',
  purple600: '#9333EA',

  // Neutrals
  white:     '#FFFFFF',
  gray50:    '#F9FAFB',
  gray100:   '#F3F4F6',
  gray200:   '#E5E7EB',
  gray300:   '#D1D5DB',
  gray400:   '#9CA3AF',
  gray500:   '#6B7280',
  gray600:   '#4B5563',
  gray700:   '#374151',
  gray800:   '#1F2937',
  gray900:   '#111827',

  // Semantic
  red400:    '#F87171',
  red500:    '#EF4444',
  green400:  '#4ADE80',
  green500:  '#22C55E',

  // App background
  bgLight:   '#F8F9FF',
  bgDark:    '#0F0E17',
};

export const colors = {
  // Palette passthrough (for direct use)
  indigo50:          palette.indigo50,
  indigo100:         palette.indigo100,

  // Brand
  primary:           palette.indigo600,
  primaryLight:      palette.indigo400,
  primaryDark:       palette.indigo800,

  // Gradient stops
  gradientStart:     palette.purple500,
  gradientEnd:       palette.indigo600,

  // Backgrounds
  background:        palette.bgLight,
  backgroundDark:    palette.bgDark,
  surface:           palette.white,
  surfaceSecondary:  palette.gray50,

  // Text
  textPrimary:       palette.gray900,
  textSecondary:     palette.gray500,
  textMuted:         palette.gray400,
  textInverse:       palette.white,
  textLink:          palette.indigo600,

  // Borders
  border:            palette.gray200,
  borderFocus:       palette.indigo500,

  // Input
  inputBackground:   palette.white,
  inputBorder:       palette.gray200,
  inputBorderFocus:  palette.indigo500,
  inputPlaceholder:  palette.gray400,

  // States
  error:             palette.red500,
  errorLight:        '#FEF2F2',
  success:           palette.green500,
  successLight:      '#F0FDF4',

  // Button
  buttonPrimary:     palette.indigo600,
  buttonPrimaryText: palette.white,
  buttonDisabled:    palette.gray200,
  buttonDisabledText:palette.gray400,

  // Shadow
  shadow:            'rgba(79, 70, 229, 0.15)',
  shadowDark:        'rgba(0, 0, 0, 0.12)',
};

export default colors;
