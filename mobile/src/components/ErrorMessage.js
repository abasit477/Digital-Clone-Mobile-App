import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';

/**
 * ErrorMessage
 *
 * Props:
 *  message    string   — the error text to display
 *  onDismiss  fn       — optional dismiss handler (shows ✕ button)
 *  type       'error' | 'warning' | 'info' | 'success'
 *  style      ViewStyle
 */
const ErrorMessage = ({ message, onDismiss, type = 'error', style }) => {
  const slideAnim = useRef(new Animated.Value(-8)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 30,
        bounciness: 6,
      }),
    ]).start();
  }, [message]);

  if (!message) return null;

  const typeConfig = {
    error: {
      bg:     colors.errorLight,
      border: colors.error,
      text:   colors.error,
      icon:   '⚠️',
    },
    warning: {
      bg:     '#FFFBEB',
      border: '#F59E0B',
      text:   '#92400E',
      icon:   '⚠️',
    },
    info: {
      bg:     colors.indigo50,
      border: colors.primary,
      text:   colors.primaryDark,
      icon:   'ℹ️',
    },
    success: {
      bg:     colors.successLight,
      border: colors.success,
      text:   '#166534',
      icon:   '✓',
    },
  };

  const config = typeConfig[type] || typeConfig.error;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor:     config.border,
          opacity:         fadeAnim,
          transform:       [{ translateY: slideAnim }],
        },
        style,
      ]}
    >
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={[styles.message, { color: config.text }]}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.dismissButton}
        >
          <Text style={[styles.dismissIcon, { color: config.text }]}>✕</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[4],
  },
  icon: {
    fontSize: 14,
    marginRight: spacing[2],
    marginTop: 1,
  },
  message: {
    flex: 1,
    ...typography.bodySmall,
    lineHeight: 18,
  },
  dismissButton: {
    marginLeft: spacing[2],
    paddingTop: 1,
  },
  dismissIcon: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ErrorMessage;
