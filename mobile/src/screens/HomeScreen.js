import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../store/authStore';
import { PrimaryButton } from '../components';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius, shadows } from '../theme/spacing';

// ─── Feature Card ──────────────────────────────────────────────────────────────
const FeatureCard = ({ title, description, emoji }) => (
  <View style={cardStyles.container}>
    <Text style={cardStyles.emoji}>{emoji}</Text>
    <Text style={cardStyles.title}>{title}</Text>
    <Text style={cardStyles.description}>{description}</Text>
  </View>
);

const cardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginHorizontal: spacing[1.5],
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: {
    fontSize: 24,
    marginBottom: spacing[2],
  },
  title: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing[1],
    fontWeight: '600',
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 15,
  },
});

// ─── Stat Chip ─────────────────────────────────────────────────────────────────
const StatChip = ({ label, value }) => (
  <View style={statStyles.chip}>
    <Text style={statStyles.value}>{value}</Text>
    <Text style={statStyles.label}>{label}</Text>
  </View>
);

const statStyles = StyleSheet.create({
  chip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    marginHorizontal: spacing[1],
  },
  value: {
    ...typography.headingMedium,
    color: colors.white,
    fontWeight: '700',
  },
  label: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
});

// ─── Home Screen ───────────────────────────────────────────────────────────────
const HomeScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [greeting,   setGreeting]   = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12)      setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else                setGreeting('Good evening');
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await signOut();
            // AppNavigator will auto-redirect to Auth stack
          },
        },
      ],
    );
  }, [signOut]);

  const displayEmail  = user?.username ?? '';
  const rawName       = user?.displayName
    ?? (displayEmail.includes('@') ? displayEmail.split('@')[0] : displayEmail)
    ?? 'User';
  const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Banner ── */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Avatar */}
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {formattedName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.avatarMeta}>
              <Text style={styles.heroGreeting}>{greeting}</Text>
              <Text style={styles.heroName}>{formattedName} 👋</Text>
            </View>
          </View>

          {/* Email badge */}
          <View style={styles.emailBadge}>
            <Text style={styles.emailBadgeText} numberOfLines={1}>
              {displayEmail}
            </Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatChip label="Sessions"   value="1" />
            <StatChip label="Queries"    value="0" />
            <StatChip label="Days Active" value="1" />
          </View>
        </LinearGradient>

        {/* ── Status chip ── */}
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Authenticated via AWS Cognito</Text>
        </View>

        {/* ── Features ── */}
        <Text style={styles.sectionTitle}>What's available</Text>

        <View style={styles.featureRow}>
          <FeatureCard
            emoji="🔐"
            title="Secure Auth"
            description="JWT session managed by AWS Cognito"
          />
          <FeatureCard
            emoji="📡"
            title="API Ready"
            description="Axios client with auto token injection"
          />
        </View>

        <View style={[styles.featureRow, { marginTop: spacing[3] }]}>
          <FeatureCard
            emoji="🎨"
            title="Modern UI"
            description="Stripe-inspired design system"
          />
          <FeatureCard
            emoji="⚡"
            title="Fast & Scalable"
            description="Optimised Expo JS architecture"
          />
        </View>

        {/* ── Info card ── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Session details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Name</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {user?.displayName ?? '—'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {user?.username ?? '—'}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoKey}>Provider</Text>
            <Text style={styles.infoValue}>AWS Cognito</Text>
          </View>
        </View>

        {/* ── Profile link ── */}
        <TouchableOpacity
          style={styles.profileLink}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
        >
          <Text style={styles.profileLinkText}>View my profile</Text>
          <Text style={styles.profileLinkIcon}>›</Text>
        </TouchableOpacity>

        {/* ── Sign out ── */}
        <PrimaryButton
          title="Sign Out"
          onPress={handleLogout}
          loading={loggingOut}
          variant="outline"
          style={styles.signOutButton}
        />

        <Text style={styles.footer}>Digital Assistant · v1.0.0</Text>
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

  // Hero
  hero: {
    margin: spacing[5],
    borderRadius: radius['2xl'],
    padding: spacing[6],
    paddingBottom: spacing[5],
    ...shadows.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    ...typography.headingMedium,
    color: colors.white,
    fontWeight: '700',
  },
  avatarMeta: {
    flex: 1,
  },
  heroGreeting: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 2,
  },
  heroName: {
    ...typography.headingMedium,
    color: colors.white,
    fontWeight: '700',
  },
  emailBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    alignSelf: 'flex-start',
    marginBottom: spacing[5],
  },
  emailBadgeText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[5],
    marginBottom: spacing[6],
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

  // Section
  sectionTitle: {
    ...typography.headingSmall,
    color: colors.textPrimary,
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  featureRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5] - spacing[1.5],
  },

  // Info card
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginHorizontal: spacing[5],
    marginTop: spacing[6],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  infoTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing[4],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2.5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoKey: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },

  // Profile link
  profileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.indigo50,
    borderRadius: radius.lg,
  },
  profileLinkText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  profileLinkIcon: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '600',
  },

  // Footer
  signOutButton: {
    marginHorizontal: spacing[5],
    marginTop: spacing[5],
  },
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[6],
  },
});

export default HomeScreen;
