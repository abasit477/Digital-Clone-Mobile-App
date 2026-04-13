import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useAuth } from '../store/authStore';

const CreatorHomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const displayName = user?.displayName || 'there';

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.greeting}>Hi, {displayName} 👋</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileBtn}>
            <Text style={styles.profileBtnText}>👤</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Create Your AI Clone</Text>
        <Text style={styles.heroSubtitle}>
          Capture your personality, values, and wisdom — and let the people who matter interact with a version of you.
        </Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.featureList}>
          {[
            { icon: '🎤', text: 'Answer 20 questions about yourself — type or speak' },
            { icon: '🧠', text: 'AI builds your personality from your answers' },
            { icon: '💬', text: 'Your clone talks like you, thinks like you' },
            { icon: '🔒', text: 'Only the people you invite can interact with your clone' },
          ].map((item, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{item.icon}</Text>
              <Text style={styles.featureText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('CloneTypeSelect')}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>Create My Clone</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.timeHint}>Takes about 10–15 minutes</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingTop: 60,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBtnText: { fontSize: 18 },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 23,
  },
  body: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  featureList: { gap: 16, marginTop: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featureIcon: { fontSize: 22, width: 28 },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: colors.text || '#1a1a2e',
    lineHeight: 22,
  },
  ctaButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  timeHint: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textSecondary || '#888',
    marginTop: 10,
    marginBottom: 8,
  },
});

export default CreatorHomeScreen;
