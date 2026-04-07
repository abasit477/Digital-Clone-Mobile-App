import React, { useState, useRef, useCallback } from 'react';
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
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  parseCognitoError,
} from '../utils/validation';

const SignupScreen = ({ navigation }) => {
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors,          setErrors]          = useState({});
  const [apiError,        setApiError]        = useState('');
  const [loading,         setLoading]         = useState(false);

  const passwordRef        = useRef(null);
  const confirmPasswordRef = useRef(null);

  const validate = useCallback(() => {
    const newErrors = {};
    const emailErr   = validateEmail(email);
    const passErr    = validatePassword(password);
    const confirmErr = validateConfirmPassword(password, confirmPassword);
    if (emailErr)   newErrors.email           = emailErr;
    if (passErr)    newErrors.password        = passErr;
    if (confirmErr) newErrors.confirmPassword = confirmErr;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password, confirmPassword]);

  const handleSignup = useCallback(async () => {
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    const { data, error } = await authService.signUp(email, password);
    setLoading(false);

    if (error) {
      setApiError(parseCognitoError(error));
      return;
    }

    // Navigate to verification with the email pre-filled
    navigation.navigate('Verification', {
      email: email.trim().toLowerCase(),
    });
  }, [email, password, validate, navigation]);

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
            <Text style={styles.backText}>Sign In</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.badge}
            >
              <Text style={styles.badgeText}>New account</Text>
            </LinearGradient>
            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.subheading}>
              Get started with Digital Assistant
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Error banner */}
            <ErrorMessage
              message={apiError}
              onDismiss={() => setApiError('')}
            />

            {/* Email */}
            <InputField
              label="Email address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((e) => ({ ...e, email: null }));
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={errors.email}
            />

            {/* Password */}
            <InputField
              ref={passwordRef}
              label="Password"
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
              label="Confirm password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword)
                  setErrors((e) => ({ ...e, confirmPassword: null }));
              }}
              placeholder="Re-enter your password"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignup}
              error={errors.confirmPassword}
            />

            {/* Password hint */}
            <View style={styles.hint}>
              <Text style={styles.hintText}>
                Password must be at least 8 characters with an uppercase letter
                and a number.
              </Text>
            </View>

            {/* Signup button */}
            <PrimaryButton
              title="Create Account"
              onPress={handleSignup}
              loading={loading}
              disabled={loading}
              style={styles.button}
            />

            {/* Sign in link */}
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkLabel}>Already have an account? </Text>
              <Text style={styles.link}>Sign in</Text>
            </TouchableOpacity>
          </View>
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
  hint: {
    backgroundColor: colors.indigo50,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    marginBottom: spacing[5],
    marginTop: -spacing[2],
  },
  hintText: {
    ...typography.caption,
    color: colors.primary,
    lineHeight: 16,
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

export default SignupScreen;
