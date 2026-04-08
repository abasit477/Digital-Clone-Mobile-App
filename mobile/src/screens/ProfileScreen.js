import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../store/authStore';
import { PrimaryButton } from '../components';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius, shadows } from '../theme/spacing';

const ProfileScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayEmail = user?.username ?? '';
  const displayName  = user?.displayName
    ?? (displayEmail.includes('@') ? displayEmail.split('@')[0] : displayEmail)
    ?? 'User';
  const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
  const roleLabel     = user?.role === 'admin' ? 'Admin' : 'User';

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await signOut();
        },
      },
    ]);
  }, [signOut]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>

        {/* Avatar hero */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {formattedName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.heroName}>{formattedName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
        </LinearGradient>

        {/* Details card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account details</Text>

          <View style={styles.row}>
            <Text style={styles.rowKey}>Full Name</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {user?.displayName ?? '—'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowKey}>Email</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {displayEmail || '—'}
            </Text>
          </View>

          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowKey}>Account type</Text>
            <Text style={styles.rowValue}>{roleLabel}</Text>
          </View>
        </View>

        {/* Provider card */}
        <View style={[styles.card, styles.cardSecondary]}>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Authenticated via AWS Cognito</Text>
          </View>
        </View>

        {/* Sign out */}
        <PrimaryButton
          title="Sign Out"
          onPress={handleLogout}
          loading={loggingOut}
          variant="outline"
          style={styles.signOutButton}
        />
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
    paddingBottom: spacing[20],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    paddingHorizontal: spacing[5],
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
  hero: {
    margin: spacing[5],
    borderRadius: radius['2xl'],
    padding: spacing[6],
    alignItems: 'center',
    ...shadows.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    marginBottom: spacing[3],
  },
  avatarText: {
    ...typography.displayMedium,
    color: colors.white,
    fontWeight: '700',
  },
  heroName: {
    ...typography.headingMedium,
    color: colors.white,
    fontWeight: '700',
    marginBottom: spacing[3],
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1.5],
    borderRadius: radius.full,
  },
  roleBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardSecondary: {
    backgroundColor: colors.surfaceSecondary,
  },
  cardTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing[4],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2.5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowKey: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  rowValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    marginRight: spacing[2],
  },
  statusText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  signOutButton: {
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
  },
});

export default ProfileScreen;
