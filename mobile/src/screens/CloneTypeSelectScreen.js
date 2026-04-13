import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

const CloneTypeSelectScreen = ({ navigation }) => {
  const select = (cloneType) => {
    navigation.navigate('CreatorOnboarding', { cloneType });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>What kind of clone?</Text>
        <Text style={styles.headerSubtitle}>
          Choose the type that best fits how your clone will be used
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.cardsContainer}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => select('family')}
          activeOpacity={0.85}
        >
          <Text style={styles.cardEmoji}>👨‍👩‍👧‍👦</Text>
          <Text style={styles.cardTitle}>Family Clone</Text>
          <Text style={styles.cardDescription}>
            Your family will interact with your clone. You'll invite them and manage who has access. Questions will cover your family life, children, traditions, and wisdom for your loved ones.
          </Text>
          <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.cardButton}>
            <Text style={styles.cardButtonText}>Choose Family Clone →</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => select('personal')}
          activeOpacity={0.85}
        >
          <Text style={styles.cardEmoji}>🧑</Text>
          <Text style={styles.cardTitle}>Personal Clone</Text>
          <Text style={styles.cardDescription}>
            A personal AI version of you — no family setup needed. Questions will focus on your relationships, values, personality, and personal wisdom.
          </Text>
          <View style={[styles.cardButton, styles.cardButtonOutline]}>
            <Text style={[styles.cardButtonText, styles.cardButtonTextOutline]}>
              Choose Personal Clone →
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 50,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  backBtn: { marginBottom: 16 },
  backBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 24 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 8 },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },
  cardsContainer: { padding: 20, gap: 16 },
  card: {
    backgroundColor: colors.surface || '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardEmoji: { fontSize: 40, marginBottom: 12 },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text || '#1a1a2e',
    marginBottom: 10,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary || '#666',
    lineHeight: 22,
    marginBottom: 20,
  },
  cardButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cardButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4f46e5',
  },
  cardButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardButtonTextOutline: { color: '#4f46e5' },
});

export default CloneTypeSelectScreen;
