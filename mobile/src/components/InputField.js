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
 * InputField — stateless except for the secure-text toggle.
 * No isFocused state: avoids re-render loops that steal focus.
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
    const [isSecure, setIsSecure] = useState(secureTextEntry);

    return (
      <View style={[styles.root, style]}>
        {label ? <Text style={styles.label}>{label}</Text> : null}

        <View
          style={[
            styles.inputWrapper,
            error ? styles.inputWrapperError : null,
            !editable ? styles.inputWrapperDisabled : null,
          ]}
        >
          {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}

          <TextInput
            ref={ref}
            style={[styles.input, leftIcon ? styles.inputWithLeftIcon : null, inputStyle]}
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
            editable={editable}
            selectionColor={colors.primary}
            underlineColorAndroid="transparent"
            maxLength={maxLength}
            {...rest}
          />

          {secureTextEntry ? (
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setIsSecure(prev => !prev)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.6}
            >
              <Text style={styles.eyeIcon}>{isSecure ? '👁' : '🙈'}</Text>
            </TouchableOpacity>
          ) : null}
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
    fontSize: 15,
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
    fontSize: 11,
    color: colors.error,
    marginTop: spacing[1.5],
    marginLeft: spacing[1],
  },
});

export default InputField;
