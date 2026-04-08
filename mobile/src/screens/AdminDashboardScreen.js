import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth }        from '../store/authStore';
import { PrimaryButton }  from '../components';
import { cloneService }   from '../services/cloneService';
import { colors }         from '../theme/colors';
import { typography }     from '../theme/typography';
import { spacing, radius, shadows } from '../theme/spacing';

// ─── Clone row ────────────────────────────────────────────────────────────────
const CloneRow = ({ clone, onManage }) => {
  const initial = clone.name?.charAt(0)?.toUpperCase() ?? '?';
  const domains = clone.domains?.split(',').map((d) => d.trim()) ?? [];

  return (
    <TouchableOpacity
      style={rowStyles.container}
      onPress={() => onManage(clone)}
      activeOpacity={0.75}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={rowStyles.avatar}
      >
        <Text style={rowStyles.avatarText}>{initial}</Text>
      </LinearGradient>

      <View style={rowStyles.info}>
        <Text style={rowStyles.name}>{clone.name}</Text>
        {clone.title ? (
          <Text style={rowStyles.title} numberOfLines={1}>{clone.title}</Text>
        ) : null}
        <Text style={rowStyles.domains} numberOfLines={1}>
          {domains.join(' · ')}
        </Text>
      </View>

      <View style={rowStyles.right}>
        <View style={[rowStyles.statusDot, clone.is_active && rowStyles.statusDotOn]} />
        <Text style={rowStyles.manageText}>Manage ›</Text>
      </View>
    </TouchableOpacity>
  );
};

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
    flexShrink: 0,
  },
  avatarText: {
    ...typography.headingSmall,
    color: colors.white,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  title: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  domains: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  statusDotOn: {
    backgroundColor: colors.success,
  },
  manageText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
const AdminDashboardScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [loggingOut,  setLoggingOut]  = useState(false);
  const [clones,      setClones]      = useState([]);
  const [loadingClones, setLoadingClones] = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const displayName   = user?.displayName ?? user?.username ?? 'Admin';
  const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  const fetchClones = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoadingClones(true);

    const { data, error } = await cloneService.listClones();
    if (!error) setClones(data ?? []);

    setLoadingClones(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => fetchClones());
    return unsubscribe;
  }, [navigation, fetchClones]);

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

  const handleDeleteClone = useCallback((clone) => {
    Alert.alert(
      'Delete Clone',
      `Remove "${clone.name}"? This hides it from users but keeps the data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await cloneService.deleteClone(clone.id);
            fetchClones();
          },
        },
      ],
    );
  }, [fetchClones]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchClones(true)}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {formattedName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.heroMeta}>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
              <Text style={styles.heroName}>{formattedName}</Text>
              <Text style={styles.heroEmail} numberOfLines={1}>
                {user?.username ?? ''}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Clones section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Digital Clones
            {clones.length > 0 ? `  (${clones.length})` : ''}
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CreateClone')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createButtonInner}
            >
              <Text style={styles.createButtonText}>+ Create Clone</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.cloneList}>
          {loadingClones ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ paddingVertical: spacing[8] }}
            />
          ) : clones.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🤖</Text>
              <Text style={styles.emptyTitle}>No clones yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap "Create Clone" to add the first digital mentor.
              </Text>
            </View>
          ) : (
            clones.map((clone) => (
              <CloneRow
                key={clone.id}
                clone={clone}
                onManage={(c) => navigation.navigate('ManageClone', { clone: c })}
              />
            ))
          )}
        </View>

        {/* System status */}
        <Text style={[styles.sectionTitle, { marginTop: spacing[4] }]}>System status</Text>
        <View style={styles.card}>
          {[
            { label: 'Auth Service',   status: 'Operational' },
            { label: 'API Gateway',    status: 'Operational' },
            { label: 'Cognito Pool',   status: 'Operational' },
            { label: 'Vector Store',   status: 'Operational' },
          ].map(({ label, status }, i, arr) => (
            <View
              key={label}
              style={[
                styles.statusRow,
                i === arr.length - 1 && styles.statusRowLast,
              ]}
            >
              <View style={styles.statusDot} />
              <Text style={[styles.statusLabel, { flex: 1 }]}>{label}</Text>
              <Text style={styles.statusValue}>{status}</Text>
            </View>
          ))}
        </View>

        {/* Sign out */}
        <PrimaryButton
          title="Sign Out"
          onPress={handleLogout}
          loading={loggingOut}
          variant="outline"
          style={styles.signOutButton}
        />

        <Text style={styles.footer}>Digital Assistant · Admin Panel · v1.0.0</Text>
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
  hero: {
    margin: spacing[5],
    borderRadius: radius['2xl'],
    padding: spacing[6],
    ...shadows.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    marginRight: spacing[4],
  },
  avatarText: {
    ...typography.headingMedium,
    color: colors.white,
    fontWeight: '700',
  },
  heroMeta: {
    flex: 1,
  },
  adminBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: spacing[2.5],
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginBottom: spacing[1.5],
  },
  adminBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  heroName: {
    ...typography.headingMedium,
    color: colors.white,
    fontWeight: '700',
  },
  heroEmail: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  sectionTitle: {
    ...typography.headingSmall,
    color: colors.textPrimary,
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  createButton: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  createButtonInner: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  createButtonText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
  cloneList: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[2],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing[3],
  },
  emptyTitle: {
    ...typography.headingSmall,
    color: colors.textPrimary,
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusRowLast: {
    borderBottomWidth: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    marginRight: spacing[3],
  },
  statusLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  statusValue: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  signOutButton: {
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[6],
  },
});

export default AdminDashboardScreen;
