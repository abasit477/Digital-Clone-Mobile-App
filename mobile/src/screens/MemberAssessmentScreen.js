/**
 * MemberAssessmentScreen
 * 4 short questions from the member's perspective.
 * Personalises question text using creator_name from memberFamilyInfo.
 * Saves answers to KEYS.memberAnswers then navigates to MemberTabs.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../store/authStore';
import { storageKey, KEYS } from '../utils/userStorage';
import { colors } from '../theme/colors';
import apiService from '../services/apiService';

// ── Question Definitions ───────────────────────────────────────────────────────

const MEMBER_QUESTIONS = [
  {
    key: 'm_nickname',
    text: 'What should the clone call you?',
    type: 'text',
    placeholder: 'Enter your name or nickname',
  },
  {
    key: 'm_bond',
    text: 'How would you describe your bond with {{creatorName}}?',
    type: 'mcq',
    options: {
      very_close: 'Very close — we share a lot',
      warm:       'Warm and loving, with our own rhythm',
      distant:    'Close but we could connect more',
      building:   'Still building our relationship',
    },
  },
  {
    key: 'm_contact',
    text: 'How often are you currently in touch with {{creatorName}}?',
    type: 'mcq',
    options: {
      daily:    'Every day',
      frequent: 'A few times a week',
      weekly:   'About once a week',
      less:     "Less often than I'd like",
    },
  },
  {
    key: 'm_topic',
    text: 'What do you most want to talk about?',
    type: 'mcq',
    options: {
      advice:   'Life advice and guidance',
      checkins: 'Everyday check-ins and updates',
      memories: 'Shared memories and stories',
      anything: 'Everything — just to feel connected',
    },
  },
];

const TOTAL = MEMBER_QUESTIONS.length;

function resolveText(template, creatorName) {
  return template.replace(/\{\{creatorName\}\}/g, creatorName || 'them');
}

// ── Component ─────────────────────────────────────────────────────────────────

const MemberAssessmentScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [creatorName, setCreatorName] = useState('');
  const [loadingInfo, setLoadingInfo] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(storageKey(user?.username, KEYS.memberFamilyInfo))
      .then(raw => {
        if (raw) {
          const info = JSON.parse(raw);
          setCreatorName(info.creator_name || info.creator_email?.split('@')[0] || 'them');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
  }, []);

  const question     = MEMBER_QUESTIONS[currentIndex];
  const currentValue = answers[question.key] ?? '';
  const canAdvance   = typeof currentValue === 'string' && currentValue.trim().length > 0;
  const isLast       = currentIndex === TOTAL - 1;
  const progressPct  = ((currentIndex + 1) / TOTAL) * 100;
  const questionText = resolveText(question.text, creatorName);

  const selectMcq = (key) => setAnswers(prev => ({ ...prev, [question.key]: key }));
  const setTextAnswer = (value) => setAnswers(prev => ({ ...prev, [question.key]: value }));

  const goNext = async () => {
    if (!canAdvance) return;
    if (!isLast) {
      setCurrentIndex(i => i + 1);
      return;
    }
    try {
      await AsyncStorage.setItem(
        storageKey(user?.username, KEYS.memberAnswers),
        JSON.stringify(answers)
      );
    } catch {}
    // Sync to backend (non-blocking)
    apiService.post('/assessments/member', { answers }).catch(() => {});
    navigation.replace('MemberTabs');
  };

  const goBack = () => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  };

  if (loadingInfo) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        {currentIndex > 0 ? (
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.headerTitle}>A Bit About You</Text>
        <Text style={styles.counter}>{currentIndex + 1} / {TOTAL}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Category badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Personal</Text>
          </View>

          <Text style={styles.questionText}>{questionText}</Text>

          {/* MCQ options */}
          {question.type === 'mcq' && (
            <View style={styles.optionsContainer}>
              {Object.entries(question.options).map(([key, label]) => {
                const isSelected = currentValue === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    onPress={() => selectMcq(key)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionDot, isSelected && styles.optionDotSelected]}>
                      {isSelected && <View style={styles.optionDotInner} />}
                    </View>
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Text input */}
          {question.type === 'text' && (
            <View style={[styles.textInputCard, currentValue.trim() && styles.textInputCardActive]}>
              <TextInput
                style={styles.textInput}
                value={currentValue}
                onChangeText={setTextAnswer}
                placeholder={question.placeholder}
                placeholderTextColor={colors.inputPlaceholder ?? colors.textMuted}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={canAdvance ? goNext : undefined}
                autoFocus
              />
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextBtn, !canAdvance && styles.nextBtnDisabled]}
            onPress={goNext}
            disabled={!canAdvance}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canAdvance ? [colors.gradientStart, colors.gradientEnd] : [colors.buttonDisabled, colors.buttonDisabled]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextGradient}
            >
              <Text style={[styles.nextText, !canAdvance && styles.nextTextDisabled]}>
                {isLast ? 'Start Chatting →' : 'Next →'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: colors.textPrimary },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  counter: { width: 36, textAlign: 'right', fontSize: 13, color: colors.textSecondary },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    marginHorizontal: 20,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  body: { padding: 24, paddingBottom: 12 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.indigo100,
    marginBottom: 20,
  },
  badgeText: { fontSize: 13, fontWeight: '600', color: colors.primary, letterSpacing: 0.3 },
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 28,
    marginBottom: 28,
  },
  optionsContainer: { gap: 12 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.indigo100,
  },
  optionDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  optionDotSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  optionLabel: { flex: 1, fontSize: 15, color: colors.textSecondary, lineHeight: 21 },
  optionLabelSelected: { color: colors.textPrimary, fontWeight: '600' },
  textInputCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textInputCardActive: { borderColor: colors.primary },
  textInput: { fontSize: 16, lineHeight: 22, minHeight: 44, color: colors.textPrimary },
  footer: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: colors.background },
  nextBtn: { borderRadius: 14, overflow: 'hidden' },
  nextBtnDisabled: { opacity: 0.6 },
  nextGradient: { paddingVertical: 16, alignItems: 'center' },
  nextText: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  nextTextDisabled: { color: colors.buttonDisabledText },
});

export default MemberAssessmentScreen;
