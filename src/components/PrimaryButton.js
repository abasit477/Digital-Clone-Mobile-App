import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius, shadows } from '../theme/spacing';

/**
 * PrimaryButton
 *
 * Props:
 *  title         string   — button label
 *  onPress       fn
 *  loading       bool     — shows ActivityIndicator
 *  disabled      bool
 *  variant       'gradient' | 'solid' | 'outline' | 'ghost'
 *  size          'sm' | 'md' | 'lg'
 *  style         ViewStyle
 *  textStyle     TextStyle
 *  fullWidth     bool     (default true)
 */
const PrimaryButton = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'gradient',
  size = 'md',
  style,
  textStyle,
  fullWidth = true,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const sizeStyles = {
    sm: { height: 40, paddingHorizontal: spacing[4] },
    md: { height: 52, paddingHorizontal: spacing[6] },
    lg: { height: 58, paddingHorizontal: spacing[8] },
  };

  const textSizes = {
    sm: { fontSize: typography.sm,   fontWeight: '600' },
    md: { fontSize: typography.base, fontWeight: '600' },
    lg: { fontSize: typography.md,   fontWeight: '700' },
  };

  const renderContent = () => (
    <>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.white}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            textSizes[size],
            variant === 'outline' && styles.outlineText,
            variant === 'ghost' && styles.ghostText,
            isDisabled && styles.disabledText,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </>
  );

  if (variant === 'gradient' && !isDisabled) {
    return (
      <Animated.View
        style={[
          { transform: [{ scale: scaleAnim }] },
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          disabled={isDisabled}
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.button,
              sizeStyles[size],
              shadows.md,
              fullWidth && styles.fullWidth,
            ]}
          >
            {renderContent()}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.85}
        disabled={isDisabled}
        style={[
          styles.button,
          sizeStyles[size],
          fullWidth && styles.fullWidth,
          variant === 'solid' && styles.solidButton,
          variant === 'outline' && styles.outlineButton,
          variant === 'ghost' && styles.ghostButton,
          isDisabled && styles.disabledButton,
        ]}
      >
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  solidButton: {
    backgroundColor: colors.buttonPrimary,
    ...shadows.md,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  disabledButton: {
    backgroundColor: colors.buttonDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: colors.white,
    letterSpacing: 0.2,
  },
  outlineText: {
    color: colors.primary,
  },
  ghostText: {
    color: colors.primary,
  },
  disabledText: {
    color: colors.buttonDisabledText,
  },
});

export default PrimaryButton;
