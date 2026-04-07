import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';

/**
 * InputField
 *
 * Props:
 *  label           string    — field label displayed above the input
 *  value           string    — controlled value
 *  onChangeText    fn        — called on every keystroke
 *  placeholder     string
 *  error           string    — inline error message
 *  secureTextEntry bool      — show/hide toggle automatically rendered
 *  keyboardType    string    — passed straight to TextInput
 *  autoCapitalize  string
 *  autoCorrect     bool
 *  returnKeyType   string
 *  onSubmitEditing fn
 *  editable        bool
 *  leftIcon        ReactNode — optional icon on the left
 */
const InputField = React.forwardRef(
  (
    {
      label,
      value,
      onChangeText,
      placeholder,
      error,
      secureTextEntry = false,
      keyboardType = 'default',
      autoCapitalize = 'none',
      autoCorrect = false,
      returnKeyType = 'done',
      onSubmitEditing,
      editable = true,
      leftIcon,
      style,
      inputStyle,
      maxLength,
      ...rest
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isSecure, setIsSecure] = useState(secureTextEntry);

    const containerStyle = [
      styles.inputWrapper,
      isFocused && styles.inputWrapperFocused,
      error && styles.inputWrapperError,
      !editable && styles.inputWrapperDisabled,
    ];

    return (
      <View style={[styles.root, style]}>
        {label ? <Text style={styles.label}>{label}</Text> : null}

        <View style={containerStyle}>
          {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}

          <TextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon && styles.inputWithLeftIcon,
              inputStyle,
            ]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.inputPlaceholder}
            secureTextEntry={isSecure}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            editable={editable}
            selectionColor={colors.primary}
            maxLength={maxLength}
            {...rest}
          />

          {secureTextEntry && (
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setIsSecure((prev) => !prev)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.6}
            >
              <Text style={styles.eyeIcon}>{isSecure ? '👁' : '🙈'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  },
);

InputField.displayName = 'InputField';

const styles = StyleSheet.create({
  root: {
    marginBottom: spacing[4],
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing[1.5],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    minHeight: 52,
  },
  inputWrapperFocused: {
    borderColor: colors.inputBorderFocus,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
  inputWrapperError: {
    borderColor: colors.error,
    backgroundColor: '#FEF2F2',
  },
  inputWrapperDisabled: {
    backgroundColor: colors.surfaceSecondary,
    opacity: 0.6,
  },
  input: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.textPrimary,
    paddingVertical: spacing[3],
  },
  inputWithLeftIcon: {
    marginLeft: spacing[2],
  },
  leftIcon: {
    marginRight: spacing[1],
  },
  eyeButton: {
    padding: spacing[1],
    marginLeft: spacing[2],
  },
  eyeIcon: {
    fontSize: 16,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing[1.5],
    marginLeft: spacing[1],
  },
});

export default InputField;
