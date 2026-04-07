import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import authService from '../services/authService';
import { InputField, PrimaryButton, ErrorMessage } from '../components';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';
import { validateOtp, parseCognitoError } from '../utils/validation';

const RESEND_COOLDOWN = 60; // seconds

const VerificationScreen = ({ navigation, route }) => {
  const email = route?.params?.email ?? '';

  const [code,     setCode]     = useState('');
  const [error,    setError]    = useState('');
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);

  // Resend cooldown
  const [cooldown,     setCooldown]     = useState(0);
  const [resendStatus, setResendStatus] = useState('');
  const cooldownRef = useRef(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleVerify = useCallback(async () => {
    setApiError('');
    const codeError = validateOtp(code);
    if (codeError) {
      setError(codeError);
      return;
    }
    setError('');
    setLoading(true);
    const { error: err } = await authService.confirmSignUp(email, code);
    setLoading(false);

    if (err) {
      setApiError(parseCognitoError(err));
      return;
    }

    // Success — go to login with a success hint
    navigation.navigate('Login');
  }, [code, email, navigation]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setResendStatus('');
    setApiError('');

    const { error: err } = await authService.resendCode(email);
    if (err) {
      setApiError(parseCognitoError(err));
      return;
    }
    setResendStatus('A new code has been sent to your email.');
    startCooldown();
  }, [cooldown, email, startCooldown]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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

          {/* Illustration / Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={styles.iconCircle}
            >
              <Text style={styles.iconEmoji}>✉️</Text>
            </LinearGradient>
          </View>

          {/* Header */}
          <Text style={styles.heading}>Check your email</Text>
          <Text style={styles.subheading}>
            We sent a 6-digit code to
          </Text>
          <Text style={styles.emailText}>{email}</Text>

          {/* Card */}
          <View style={styles.card}>
            {/* Error banner */}
            <ErrorMessage
              message={apiError}
              onDismiss={() => setApiError('')}
            />

            {/* Success banner */}
            {resendStatus ? (
              <ErrorMessage
                message={resendStatus}
                type="success"
                onDismiss={() => setResendStatus('')}
              />
            ) : null}

            {/* OTP input */}
            <InputField
              label="Verification code"
              value={code}
              onChangeText={(text) => {
                setCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                if (error) setError('');
              }}
              placeholder="000000"
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={handleVerify}
              error={error}
              style={styles.otpInputContainer}
              inputStyle={styles.otpInput}
              maxLength={6}
            />

            {/* Verify button */}
            <PrimaryButton
              title="Verify Email"
              onPress={handleVerify}
              loading={loading}
              disabled={loading}
              style={styles.button}
            />

            {/* Resend */}
            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive the code? </Text>
              <TouchableOpacity
                onPress={handleResend}
                disabled={cooldown > 0}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.resendLink,
                    cooldown > 0 && styles.resendLinkDisabled,
                  ]}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer hint */}
          <Text style={styles.footerHint}>
            The code expires in 10 minutes. Check your spam folder if you don't
            see it in your inbox.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[10],
    alignItems: 'center',
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
  iconContainer: {
    marginBottom: spacing[6],
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gradientStart,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  iconEmoji: {
    fontSize: 32,
  },
  heading: {
    ...typography.displayMedium,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing[1.5],
  },
  subheading: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emailText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  card: {
    width: '100%',
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
  otpInputContainer: {
    marginBottom: spacing[5],
  },
  otpInput: {
    fontSize: typography.xl,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  button: {
    marginBottom: spacing[5],
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  resendLink: {
    ...typography.bodySmall,
    color: colors.textLink,
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: colors.textMuted,
  },
  footerHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[6],
    paddingHorizontal: spacing[4],
    lineHeight: 16,
  },
});

export default VerificationScreen;
