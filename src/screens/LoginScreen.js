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

import { useAuth } from '../store/authStore';
import { InputField, PrimaryButton, ErrorMessage } from '../components';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';
import { validateEmail, validatePassword, parseCognitoError } from '../utils/validation';

const LoginScreen = ({ navigation }) => {
  const { signIn } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [errors,   setErrors]   = useState({});
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);

  const passwordRef = useRef(null);

  const validate = useCallback(() => {
    const newErrors = {};
    const emailErr = validateEmail(email);
    const passErr  = validatePassword(password);
    if (emailErr) newErrors.email    = emailErr;
    if (passErr)  newErrors.password = passErr;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password]);

  const handleLogin = useCallback(async () => {
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    const { success, error } = await signIn(email, password);
    setLoading(false);

    if (!success) {
      const msg = parseCognitoError(error);
      // Handle unconfirmed accounts — redirect to verification
      if (error?.name === 'UserNotConfirmedException') {
        navigation.navigate('Verification', { email: email.trim().toLowerCase() });
        return;
      }
      setApiError(msg);
    }
    // On success, AppNavigator automatically switches to MainNavigator
  }, [email, password, validate, signIn, navigation]);

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
          {/* Header accent bar */}
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentBar}
          />

          {/* Logo / Brand */}
          <View style={styles.brand}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                style={styles.logo}
              >
                <Text style={styles.logoText}>DA</Text>
              </LinearGradient>
            </View>
            <Text style={styles.appName}>Digital Assistant</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>Sign in to continue</Text>

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
              autoCorrect={false}
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
              placeholder="••••••••"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              error={errors.password}
            />

            {/* Login button */}
            <PrimaryButton
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Sign up link */}
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkLabel}>Don't have an account? </Text>
              <Text style={styles.link}>Create one</Text>
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
  accentBar: {
    height: 4,
    borderRadius: radius.full,
    marginTop: spacing[4],
    marginBottom: spacing[10],
    width: 48,
    alignSelf: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing[10],
  },
  logoContainer: {
    marginBottom: spacing[3],
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gradientStart,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoText: {
    ...typography.headingLarge,
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 1,
  },
  appName: {
    ...typography.headingSmall,
    color: colors.textPrimary,
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
  heading: {
    ...typography.displayMedium,
    color: colors.textPrimary,
    marginBottom: spacing[1],
  },
  subheading: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing[6],
  },
  button: {
    marginTop: spacing[2],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[5],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textMuted,
    marginHorizontal: spacing[3],
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

export default LoginScreen;
