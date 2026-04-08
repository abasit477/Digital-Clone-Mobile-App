import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: {
    regular: 'System',
    medium:  'System',
    semibold: 'System',
    bold:    'System',
  },
  android: {
    regular: 'Roboto',
    medium:  'Roboto',
    semibold: 'Roboto',
    bold:    'Roboto',
  },
});

export const typography = {
  // Font sizes
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   19,
  xl:   22,
  '2xl': 26,
  '3xl': 30,
  '4xl': 36,

  // Font weights
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  extrabold:'800',

  // Line heights
  tight:   1.2,
  snug:    1.375,
  normal:  1.5,
  relaxed: 1.625,

  // Presets
  displayLarge: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  displayMedium: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  headingLarge: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  headingMedium: {
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 24,
  },
  headingSmall: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  bodyLarge: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: 16,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
};

export default typography;
