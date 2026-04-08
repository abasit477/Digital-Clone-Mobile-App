import React, { useState, useCallback } from 'react';
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
import { validateEmail, parseCognitoError } from '../utils/validation';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email,    setEmail]    = useState('');
  const [error,    setError]    = useState('');
  const [fieldErr, setFieldErr] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSend = useCallback(async () => {
    setError('');
    const emailErr = validateEmail(email);
    if (emailErr) { setFieldErr(emailErr); return; }
    setFieldErr('');

    setLoading(true);
    const { data, error: apiErr } = await authService.forgotPassword(email);
    setLoading(false);

    if (apiErr) {
      setError(parseCognitoError(apiErr));
      return;
    }

    navigation.navigate('ResetPassword', { email: email.trim().toLowerCase() });
  }, [email, navigation]);

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
            <Text style={styles.badgeText}>Password reset</Text>
          </LinearGradient>
          <Text style={styles.heading}>Forgot your password?</Text>
          <Text style={styles.subheading}>
            Enter your email and we'll send you a reset code.
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <ErrorMessage message={error} onDismiss={() => setError('')} />

          <InputField
            label="Email address"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (fieldErr) setFieldErr('');
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSend}
            error={fieldErr}
          />

          <PrimaryButton
            title="Send Reset Code"
            onPress={handleSend}
            loading={loading}
            disabled={loading}
            style={styles.button}
          />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkLabel}>Remember your password? </Text>
            <Text style={styles.link}>Sign in</Text>
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

export default ForgotPasswordScreen;
