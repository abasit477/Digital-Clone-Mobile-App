/**
 * HomeScreen — Dashboard
 * No clone yet  → "Create Your Clone" CTA → starts assessment
 * Clone exists  → shows clone card + family profile snapshot
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../store/authStore';
import { storageKey, KEYS } from '../utils/userStorage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius, shadows } from '../theme/spacing';
const LIVING_MAP  = { together: 'With family', same_city: 'Same city', diff_city: 'Diff. city', diff_country: 'Abroad' };
const EDU_MAP     = { high_school: 'High school', vocational: 'Vocational', university: 'University', postgrad: 'Postgrad' };
const WORK_MAP    = { technology: 'Tech / Eng', healthcare: 'Healthcare', business: 'Business', education: 'Education', trades: 'Trades', arts: 'Arts / Media', other: 'Other' };

function getProfileCards(answers) {
  const cc = answers?.q_children_count;
  const childSummary = !cc || cc === 'zero'
    ? 'No children'
    : cc === 'one'
      ? answers.q_child1_name || '1 child'
      : cc === 'two'
        ? `${answers.q_child1_name || '?'} & ${answers.q_child2_name || '?'}`
        : `${answers.q_child1_name || '?'} + more`;

  return [
    { icon: '👨‍👩‍👧', label: 'Children',  value: childSummary },
    { icon: '🏡',     label: 'Living',    value: LIVING_MAP[answers?.q_living_with] ?? '—' },
    { icon: '🎓',     label: 'Education', value: EDU_MAP[answers?.q_education] ?? '—' },
    { icon: '💼',     label: 'Work',      value: WORK_MAP[answers?.q_work_field] ?? '—' },
  ];
}

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const rawName = user?.displayName
    ?? (user?.username?.includes('@') ? user.username.split('@')[0] : user?.username)
    ?? 'there';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const initial = displayName.charAt(0).toUpperCase();

  const [answers, setAnswers] = useState(null);   // null = loading, {} = no clone, {...} = has clone
  const [loading, setLoading] = useState(true);

  // Reload on every focus so returning from assessment reflects the new answers
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      AsyncStorage.getItem(storageKey(user?.username, KEYS.assessmentAnswers))
        .then(raw => setAnswers(raw ? JSON.parse(raw) : null))
        .catch(() => setAnswers(null))
        .finally(() => setLoading(false));
    }, [user?.username])
  );

  const hasClone = answers && Object.keys(answers).length > 0;

  const handleCreateClone = () => {
    navigation.navigate('FamilyAssessment');
  };

  const handleRetake = async () => {
    await AsyncStorage.multiRemove([
      storageKey(user?.username, KEYS.assessmentAnswers),
      storageKey(user?.username, KEYS.chatHistory),
    ]);
    setAnswers(null);
    navigation.navigate('FamilyAssessment');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {/* Gradient header */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View>
          <Text style={styles.greeting}>Good day,</Text>
          <Text style={styles.headerName}>{displayName} 👋</Text>
        </View>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{initial}</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : hasClone ? (
        /* ── Clone exists — dashboard view ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionLabel}>YOUR CLONE</Text>

          <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate('Chat')}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cloneCard}
            >
              <View style={styles.cloneAvatar}>
                <Text style={styles.cloneAvatarEmoji}>🧬</Text>
              </View>
              <View style={styles.cloneInfo}>
                <Text style={styles.cloneName}>Family Clone</Text>
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Ready to chat</Text>
                </View>
                <Text style={styles.cloneHint}>Tap to start a conversation</Text>
              </View>
              <View style={styles.arrowBadge}>
                <Text style={styles.arrowText}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { marginTop: spacing[7] }]}>FAMILY PROFILE</Text>
          <View style={styles.statsGrid}>
            {getProfileCards(answers).map(({ icon, label, value }) => (
              <View key={label} style={styles.statCard}>
                <Text style={styles.statIcon}>{icon}</Text>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue} numberOfLines={2}>{value}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} activeOpacity={0.75}>
            <Text style={styles.retakeBtnText}>Retake Assessment</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* ── No clone yet — create CTA ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.emptyContent}>
          <View style={styles.emptyIconWrapper}>
            <Text style={styles.emptyIcon}>🧬</Text>
          </View>

          <Text style={styles.emptyTitle}>Create Your AI Clone</Text>
          <Text style={styles.emptySubtitle}>
            Answer 10 quick questions about your family and we'll build a personalised AI clone you can chat with anytime.
          </Text>

          <View style={styles.featureList}>
            {[
              { icon: '❓', text: '10 multiple-choice questions' },
              { icon: '🧠', text: 'AI learns your family profile' },
              { icon: '💬', text: 'Chat with your clone instantly' },
              { icon: '🔒', text: 'Everything stored on your phone' },
            ].map((item, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureRowIcon}>{item.icon}</Text>
                <Text style={styles.featureRowText}>{item.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity onPress={handleCreateClone} activeOpacity={0.88} style={styles.ctaWrapper}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaBtn}
            >
              <Text style={styles.ctaBtnText}>Create My Clone →</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.ctaHint}>Takes about 2 minutes</Text>
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
    paddingBottom: spacing[6],
  },
  greeting: {
    fontSize: typography.sm,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 2,
  },
  headerName: {
    ...typography.displayMedium,
    color: '#fff',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  headerAvatarText: {
    fontSize: typography.md,
    fontWeight: '700',
    color: '#fff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Clone exists ──────────────────────────────────────────────────────────────
  scrollContent: {
    padding: spacing[5],
    paddingBottom: spacing[10],
  },
  sectionLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: spacing[3],
  },
  cloneCard: {
    borderRadius: radius['2xl'],
    padding: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    ...shadows.lg,
  },
  cloneAvatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    flexShrink: 0,
  },
  cloneAvatarEmoji: { fontSize: 30 },
  cloneInfo: { flex: 1 },
  cloneName: {
    ...typography.headingMedium,
    color: '#fff',
    marginBottom: spacing[1],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginBottom: spacing[1],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: '#4ADE80',
  },
  statusText: {
    fontSize: typography.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  cloneHint: {
    fontSize: typography.sm,
    color: 'rgba(255,255,255,0.65)',
  },
  arrowBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  arrowText: {
    fontSize: typography.md,
    color: '#fff',
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statIcon: { fontSize: 22, marginBottom: spacing[1.5] },
  statLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing[1],
  },
  statValue: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  retakeBtn: {
    marginTop: spacing[6],
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  retakeBtnText: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // ── No clone yet ──────────────────────────────────────────────────────────────
  emptyContent: {
    padding: spacing[6],
    paddingBottom: spacing[10],
    alignItems: 'center',
  },
  emptyIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.indigo100,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[6],
    marginBottom: spacing[5],
  },
  emptyIcon: { fontSize: 44 },
  emptyTitle: {
    ...typography.displayMedium,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  emptySubtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: spacing[7],
  },
  featureList: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[5],
    gap: spacing[4],
    marginBottom: spacing[7],
    ...shadows.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  featureRowIcon: { fontSize: 20, width: 28 },
  featureRowText: {
    fontSize: typography.base,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  ctaWrapper: {
    alignSelf: 'stretch',
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  ctaBtn: {
    paddingVertical: spacing[5],
    alignItems: 'center',
  },
  ctaBtnText: {
    fontSize: typography.md,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  ctaHint: {
    marginTop: spacing[3],
    fontSize: typography.sm,
    color: colors.textMuted,
  },
});

export default HomeScreen;
