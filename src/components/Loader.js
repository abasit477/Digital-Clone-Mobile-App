import React, { useEffect, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Text,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';

/**
 * Loader
 *
 * Variants:
 *  'fullscreen'  — centered overlay covering the entire screen
 *  'inline'      — small spinner inline with content
 *  'overlay'     — semi-transparent overlay on top of content
 *
 * Props:
 *  visible   bool
 *  variant   'fullscreen' | 'inline' | 'overlay'
 *  message   string — optional loading message
 *  color     string
 */
const Loader = ({
  visible = true,
  variant = 'fullscreen',
  message,
  color = colors.primary,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  if (!visible) return null;

  if (variant === 'inline') {
    return (
      <View style={styles.inlineContainer}>
        <ActivityIndicator color={color} size="small" />
        {message ? <Text style={[styles.message, { marginLeft: spacing[2] }]}>{message}</Text> : null}
      </View>
    );
  }

  if (variant === 'overlay') {
    return (
      <Animated.View style={[styles.overlayContainer, { opacity: fadeAnim }]}>
        <View style={styles.card}>
          <ActivityIndicator color={color} size="large" />
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </Animated.View>
    );
  }

  // fullscreen (default)
  return (
    <Animated.View style={[styles.fullscreenContainer, { opacity: fadeAnim }]}>
      <View style={styles.card}>
        <ActivityIndicator color={color} size="large" />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[10],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
  },
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing[3],
    textAlign: 'center',
  },
});

export default Loader;
