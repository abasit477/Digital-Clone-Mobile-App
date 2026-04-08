import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../store/authStore';
import { cloneService } from '../services/cloneService';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius, shadows } from '../theme/spacing';

// ─── Domain badge ─────────────────────────────────────────────────────────────
const DomainBadge = ({ label }) => (
  <View style={badgeStyles.container}>
    <Text style={badgeStyles.text}>{label}</Text>
  </View>
);

const badgeStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.indigo50,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: 3,
    marginRight: spacing[1.5],
    marginTop: spacing[1],
  },
  text: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'capitalize',
  },
});

// ─── Clone card ───────────────────────────────────────────────────────────────
const CloneCard = ({ clone, onPress }) => {
  const initial = clone.name?.charAt(0)?.toUpperCase() ?? '?';
  const domains = clone.domains?.split(',').map((d) => d.trim()) ?? ['general'];

  return (
    <TouchableOpacity
      style={cardStyles.container}
      onPress={() => onPress(clone)}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={cardStyles.avatar}
      >
        <Text style={cardStyles.avatarText}>{initial}</Text>
      </LinearGradient>

      {/* Info */}
      <View style={cardStyles.info}>
        <Text style={cardStyles.name}>{clone.name}</Text>
        {clone.title ? (
          <Text style={cardStyles.title} numberOfLines={1}>{clone.title}</Text>
        ) : null}
        {clone.description ? (
          <Text style={cardStyles.description} numberOfLines={2}>
            {clone.description}
          </Text>
        ) : null}
        <View style={cardStyles.domainRow}>
          {domains.map((d) => (
            <DomainBadge key={d} label={d} />
          ))}
        </View>
      </View>

      {/* Arrow */}
      <Text style={cardStyles.arrow}>›</Text>
    </TouchableOpacity>
  );
};

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[4],
    flexShrink: 0,
  },
  avatarText: {
    ...typography.headingMedium,
    color: colors.white,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.headingSmall,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  title: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: spacing[1.5],
  },
  domainRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  arrow: {
    fontSize: 22,
    color: colors.textMuted,
    marginLeft: spacing[2],
  },
});

// ─── Clone List Screen ────────────────────────────────────────────────────────
const CloneListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [clones,     setClones]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const displayName = user?.displayName
    ?? (user?.username?.split('@')[0] ?? 'there');
  const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  const fetchClones = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError('');

    const { data, error: err } = await cloneService.listClones();
    if (err) {
      setError('Failed to load clones. Please try again.');
    } else {
      setClones(data ?? []);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchClones();
  }, [fetchClones]);

  const handleSelectClone = useCallback((clone) => {
    navigation.navigate('Interaction', { clone });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hello, {formattedName}</Text>
          <Text style={styles.subtitle}>Who would you like to talk to?</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={styles.profileAvatar}
          >
            <Text style={styles.profileAvatarText}>
              {formattedName.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchClones()} activeOpacity={0.7}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
          {clones.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🤖</Text>
              <Text style={styles.emptyTitle}>No clones available yet</Text>
              <Text style={styles.emptySubtitle}>
                Check back soon — digital mentors are being added.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>
                {clones.length} {clones.length === 1 ? 'mentor' : 'mentors'} available
              </Text>
              {clones.map((clone) => (
                <CloneCard key={clone.id} clone={clone} onPress={handleSelectClone} />
              ))}
            </>
          )}
          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    ...typography.displayMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileButton: {
    marginLeft: spacing[3],
  },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    ...typography.headingSmall,
    color: colors.white,
    fontWeight: '700',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[4],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  retryText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing[16] ?? 64,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    ...typography.headingSmall,
    color: colors.textPrimary,
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bottomPad: {
    height: spacing[10],
  },
});

export default CloneListScreen;
