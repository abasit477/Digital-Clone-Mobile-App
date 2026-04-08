import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import authService from '../services/authService';
import { InputField, PrimaryButton, ErrorMessage } from '../components';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';
import { validatePassword, validateConfirmPassword, parseCognitoError } from '../utils/validation';

const ResetPasswordScreen = ({ navigation, route }) => {
  const email = route.params?.email ?? '';

  const [code,            setCode]            = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors,          setErrors]          = useState({});
  const [apiError,        setApiError]        = useState('');
  const [loading,         setLoading]         = useState(false);

  const passwordRef        = useRef(null);
  const confirmPasswordRef = useRef(null);

  const validate = useCallback(() => {
    const newErrors = {};
    if (!code.trim())               newErrors.code    = 'Verification code is required.';
    const passErr    = validatePassword(password);
    const confirmErr = validateConfirmPassword(password, confirmPassword);
    if (passErr)    newErrors.password        = passErr;
    if (confirmErr) newErrors.confirmPassword = confirmErr;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [code, password, confirmPassword]);

  const handleReset = useCallback(async () => {
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    const { data, error } = await authService.confirmForgotPassword(email, code, password);
    setLoading(false);

    if (error) {
      setApiError(parseCognitoError(error));
      return;
    }

    navigation.navigate('Login');
  }, [email, code, password, validate, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="none"
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.badge}
          >
            <Text style={styles.badgeText}>New password</Text>
          </LinearGradient>
          <Text style={styles.heading}>Reset your password</Text>
          <Text style={styles.subheading}>
            Enter the code sent to{' '}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <ErrorMessage message={apiError} onDismiss={() => setApiError('')} />

          {/* Reset code */}
          <InputField
            label="Reset code"
            value={code}
            onChangeText={(text) => {
              setCode(text);
              if (errors.code) setErrors((e) => ({ ...e, code: null }));
            }}
            placeholder="Enter the code from your email"
            keyboardType="number-pad"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={errors.code}
          />

          {/* New password */}
          <InputField
            ref={passwordRef}
            label="New password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors((e) => ({ ...e, password: null }));
            }}
            placeholder="Min 8 chars, uppercase & number"
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            error={errors.password}
          />

          {/* Confirm password */}
          <InputField
            ref={confirmPasswordRef}
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errors.confirmPassword) setErrors((e) => ({ ...e, confirmPassword: null }));
            }}
            placeholder="Re-enter your new password"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleReset}
            error={errors.confirmPassword}
          />

          <PrimaryButton
            title="Reset Password"
            onPress={handleReset}
            loading={loading}
            disabled={loading}
            style={styles.button}
          />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkLabel}>Back to </Text>
            <Text style={styles.link}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[10],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    alignSelf: 'flex-start',
  },
  backIcon: {
    fontSize: 18,
    color: colors.primary,
    marginRight: spacing[1.5],
  },
  backText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  header: {
    marginBottom: spacing[6],
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    marginBottom: spacing[3],
  },
  badgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heading: {
    ...typography.displayMedium,
    color: colors.textPrimary,
    marginBottom: spacing[1],
  },
  subheading: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  emailHighlight: {
    color: colors.primary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[8],
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  button: {
    marginBottom: spacing[5],
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  link: {
    ...typography.bodySmall,
    color: colors.textLink,
    fontWeight: '600',
  },
});

export default ResetPasswordScreen;
