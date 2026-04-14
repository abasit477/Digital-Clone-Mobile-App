/**
 * JoinFamilyScreen
 * Members enter their 8-character invite code to join a family.
 * On success: saves family info to AsyncStorage → MemberAssessment.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../store/authStore';
import { storageKey, KEYS } from '../utils/userStorage';
import { colors } from '../theme/colors';
import familyService from '../services/familyService';

const JoinFamilyScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 8) {
      Alert.alert('Invalid Code', 'The invite code must be 8 characters.');
      return;
    }

    setLoading(true);
    const { data, error } = await familyService.joinFamily(trimmed);
    setLoading(false);

    if (error) {
      const msg = error.message || 'Invalid or already used invite code.';
      Alert.alert('Join Failed', msg);
      return;
    }

    // Save family context for use in onboarding and chat
    const creatorEmail = data.creator_email || '';
    const creatorName  = creatorEmail.split('@')[0] || 'Family';
    const familyInfo   = {
      family_id:     data.family_id   || '',
      family_name:   data.family_name || 'My Family',
      creator_email: creatorEmail,
      creator_name:  creatorName,
      relationship:  data.relationship || null,
    };

    try {
      await AsyncStorage.setItem(
        storageKey(user?.username, KEYS.memberFamilyInfo),
        JSON.stringify(familyInfo)
      );
    } catch {}

    navigation.replace('MemberAssessment');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={styles.heroSection}
        >
          <Text style={styles.heroEmoji}>🔑</Text>
          <Text style={styles.heroTitle}>Join Your Family</Text>
          <Text style={styles.heroSubtitle}>
            Enter the 8-character invite code you received by email
          </Text>
        </LinearGradient>

        <View style={styles.formSection}>
          <Text style={styles.label}>Invite Code</Text>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="XXXXXXXX"
            placeholderTextColor="#bbb"
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
          />
          <Text style={styles.hint}>
            Check your email for a code from the family creator.
          </Text>

          <TouchableOpacity
            onPress={handleJoin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={loading ? ['#a0aec0', '#a0aec0'] : [colors.gradientStart, colors.gradientEnd]}
              style={styles.joinButton}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.joinButtonText}>Join Family</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1 },
  heroSection: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  heroEmoji: { fontSize: 48, marginBottom: 12 },
  heroTitle: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8 },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
  },
  formSection: { flex: 1, padding: 24 },
  label: {
    fontSize: 14, fontWeight: '600', color: colors.textPrimary,
    marginBottom: 8, marginTop: 16,
  },
  codeInput: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    color: colors.primary,
    backgroundColor: colors.indigo100,
  },
  hint: {
    fontSize: 13, color: colors.textSecondary,
    marginTop: 8, marginBottom: 32, textAlign: 'center',
  },
  joinButton: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  joinButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

export default JoinFamilyScreen;
