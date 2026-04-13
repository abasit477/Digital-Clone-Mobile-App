import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import cloneService from '../services/cloneService';

const PersonalCloneScreen = ({ route, navigation }) => {
  // Clone may be passed as a param (right after onboarding) or fetched
  const [clone, setClone] = useState(route?.params?.clone ?? null);
  const [loading, setLoading] = useState(!route?.params?.clone);

  const loadClone = useCallback(async () => {
    // listClones returns CloneListItem (no persona_prompt); fetch by ID for full object
    const { data: list } = await cloneService.listClones();
    if (list && list.length > 0) {
      const { data: full } = await cloneService.getClone(list[0].id);
      if (full) setClone(full);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!clone) loadClone();
  }, [clone, loadClone]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>My Clone</Text>
            {clone && <Text style={styles.headerSubtitle}>{clone.name}</Text>}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileBtn}>
            <Text style={styles.profileBtnText}>👤</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {clone ? (
          <>
            <View style={styles.cloneCard}>
              <View style={styles.cloneAvatar}>
                <Text style={styles.cloneAvatarText}>
                  {(clone.name?.[0] || '?').toUpperCase()}
                </Text>
              </View>
              <View style={styles.cloneInfo}>
                <Text style={styles.cloneName}>{clone.name}</Text>
                <Text style={styles.cloneTitle}>{clone.title}</Text>
                <View style={styles.activePill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activePillText}>Active</Text>
                </View>
              </View>
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => navigation.navigate('Interaction', { clone })}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.primaryActionGradient}>
                  <Text style={styles.primaryActionText}>💬  Talk to My Clone</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => navigation.navigate('ManageClone', { clone })}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryActionText}>⚙️  Manage Clone</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🤖</Text>
            <Text style={styles.emptyTitle}>No clone found</Text>
            <Text style={styles.emptySubtitle}>Something went wrong. Please restart the app.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 50,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBtnText: { fontSize: 18 },
  body: { flex: 1, padding: 20 },
  cloneCard: {
    backgroundColor: colors.surface || '#fff',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  cloneAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloneAvatarText: { fontSize: 28, fontWeight: '700', color: '#4f46e5' },
  cloneInfo: { flex: 1 },
  cloneName: { fontSize: 18, fontWeight: '700', color: colors.text || '#1a1a2e' },
  cloneTitle: { fontSize: 14, color: colors.textSecondary || '#888', marginTop: 2, marginBottom: 8 },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  activePillText: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  actionsContainer: { gap: 14 },
  primaryAction: {},
  primaryActionGradient: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryActionText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryAction: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.surface || '#fff',
  },
  secondaryActionText: { fontSize: 16, fontWeight: '600', color: colors.text || '#1a1a2e' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text || '#1a1a2e', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary || '#888', textAlign: 'center' },
});

export default PersonalCloneScreen;
