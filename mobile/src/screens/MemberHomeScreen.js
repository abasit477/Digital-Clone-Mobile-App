/**
 * MemberHomeScreen
 * Simple dashboard for family members.
 * Shows the family clone card (tappable → Chat tab) + creator context.
 */
import React, { useState, useCallback } from 'react';
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
import { spacing, radius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';

const RELATIONSHIP_LABELS = {
  child:   'child',
  parent:  'parent',
  spouse:  'spouse',
  sibling: 'sibling',
};

const MemberHomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [familyInfo, setFamilyInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const rawName    = user?.displayName
    ?? (user?.username?.includes('@') ? user.username.split('@')[0] : user?.username)
    ?? 'there';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const initial     = displayName.charAt(0).toUpperCase();

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      AsyncStorage.getItem(storageKey(user?.username, KEYS.memberFamilyInfo))
        .then(raw => setFamilyInfo(raw ? JSON.parse(raw) : null))
        .catch(() => setFamilyInfo(null))
        .finally(() => setLoading(false));
    }, [user?.username])
  );

  const creatorName  = familyInfo?.creator_name
    || familyInfo?.creator_email?.split('@')[0]
    || 'Family';
  const relationship = familyInfo?.relationship
    ? RELATIONSHIP_LABELS[familyInfo.relationship] ?? familyInfo.relationship
    : 'family member';

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
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionLabel}>YOUR CLONE</Text>

          {/* Clone card — taps navigate to Chat tab */}
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
                <Text style={styles.cloneName}>{creatorName}'s Clone</Text>
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

          {/* Context card */}
          {familyInfo && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: spacing[7] }]}>YOUR CONNECTION</Text>
              <View style={styles.contextCard}>
                <View style={styles.contextRow}>
                  <Text style={styles.contextKey}>Family</Text>
                  <Text style={styles.contextValue}>{familyInfo.family_name || '—'}</Text>
                </View>
                <View style={styles.contextRow}>
                  <Text style={styles.contextKey}>Clone of</Text>
                  <Text style={styles.contextValue}>{creatorName}</Text>
                </View>
                <View style={[styles.contextRow, styles.contextRowLast]}>
                  <Text style={styles.contextKey}>Relationship</Text>
                  <Text style={styles.contextValue} style={{ textTransform: 'capitalize' }}>
                    {relationship}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  greeting: { fontSize: typography.sm, color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  headerName: { ...typography.displayMedium, color: '#fff' },
  headerAvatar: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  headerAvatarText: { fontSize: typography.md, fontWeight: '700', color: '#fff' },
  scrollContent: { padding: spacing[5], paddingBottom: spacing[10] },
  sectionLabel: {
    fontSize: typography.xs, fontWeight: '600', color: colors.textMuted,
    letterSpacing: 0.8, marginBottom: spacing[3],
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
    width: 64, height: 64, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', flexShrink: 0,
  },
  cloneAvatarEmoji: { fontSize: 30 },
  cloneInfo: { flex: 1 },
  cloneName: { ...typography.headingMedium, color: '#fff', marginBottom: spacing[1] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5], marginBottom: spacing[1] },
  statusDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: '#4ADE80' },
  statusText: { fontSize: typography.sm, color: 'rgba(255,255,255,0.85)' },
  cloneHint: { fontSize: typography.sm, color: 'rgba(255,255,255,0.65)' },
  arrowBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 36, height: 36, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  arrowText: { fontSize: typography.md, color: '#fff', fontWeight: '700' },
  contextCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[5],
    ...shadows.sm,
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2.5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contextRowLast: { borderBottomWidth: 0 },
  contextKey: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  contextValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
});

export default MemberHomeScreen;
