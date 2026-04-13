import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import authService from '../services/authService';
import { useAuth } from '../store/authStore';

const RoleSelectScreen = () => {
  const { updateRole } = useAuth();
  const [loading, setLoading] = useState(false);

  const selectRole = async (role) => {
    setLoading(true);
    const { error } = await authService.setUserRole(role);
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message || 'Could not save your role. Please try again.');
      return;
    }
    updateRole(role);
    // Navigation handled by AppNavigator reacting to role change
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#4f46e5', '#7c3aed']}
        style={styles.header}
      >
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>How would you like to use Digital Assistant?</Text>
      </LinearGradient>

      <View style={styles.cardsContainer}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => selectRole('creator')}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.cardEmoji}>🧑‍💼</Text>
          <Text style={styles.cardTitle}>Create My Clone</Text>
          <Text style={styles.cardDescription}>
            I want my family to interact with a personal AI version of me. I'll answer some questions to help shape my clone's personality.
          </Text>
          <LinearGradient
            colors={['#4f46e5', '#7c3aed']}
            style={styles.cardButton}
          >
            <Text style={styles.cardButtonText}>Get Started</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => selectRole('member')}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.cardEmoji}>👨‍👩‍👧‍👦</Text>
          <Text style={styles.cardTitle}>Join a Family</Text>
          <Text style={styles.cardDescription}>
            I was invited by a family member. I have an invite code and want to start a conversation with their clone.
          </Text>
          <View style={[styles.cardButton, styles.cardButtonOutline]}>
            <Text style={[styles.cardButtonText, styles.cardButtonTextOutline]}>Join with Code</Text>
          </View>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
  },
  cardsContainer: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
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
  cardEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text || '#1a1a2e',
    marginBottom: 10,
  },
  cardDescription: {
    fontSize: 15,
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
  cardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardButtonTextOutline: {
    color: '#4f46e5',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RoleSelectScreen;
