/**
 * FamilyAssessmentScreen
 * Adaptive personal onboarding — up to 10 questions that branch based on answers.
 * Covers: children (names, ages, relationships), living situation, meeting frequency,
 * education, and field of work.
 *
 * Exports:
 *   QUESTION_BANK        — all question definitions
 *   getQuestionSequence  — returns ordered question keys for a given answer set
 */
import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../store/authStore';
import { storageKey, KEYS } from '../utils/userStorage';
import { colors } from '../theme/colors';

// ── Question Bank ─────────────────────────────────────────────────────────────

const AGE_OPTIONS = {
  toddler:     'Under 5 years old',
  child:       '5 to 10 years old',
  teen:        '11 to 17 years old',
  young_adult: '18 to 25 years old',
  adult:       '26 or older',
};

export const QUESTION_BANK = {
  q_children_count: {
    id: 'q_children_count',
    category: 'Family',
    text: 'How many children do you have?',
    type: 'mcq',
    options: {
      zero:       "I don't have any children",
      one:        'I have 1 child',
      two:        'I have 2 children',
      three_plus: 'I have 3 or more children',
    },
  },
  q_child1_name: {
    id: 'q_child1_name',
    category: 'Family',
    text: "What is your first child's name?",
    type: 'text',
    placeholder: 'Enter their name',
  },
  q_child1_age: {
    id: 'q_child1_age',
    category: 'Family',
    text: 'How old is {{child1Name}}?',
    type: 'mcq',
    options: AGE_OPTIONS,
  },
  q_child1_relationship: {
    id: 'q_child1_relationship',
    category: 'Family',
    text: 'How would you describe your relationship with {{child1Name}}?',
    type: 'mcq',
    options: {
      very_close: 'Very close — we talk about everything',
      warm:       'Warm and loving, with normal friction',
      distant:    'Close but we could communicate more',
      working:    'Working on building a stronger bond',
    },
  },
  q_child2_name: {
    id: 'q_child2_name',
    category: 'Family',
    text: "What is your second child's name?",
    type: 'text',
    placeholder: 'Enter their name',
  },
  q_child2_age: {
    id: 'q_child2_age',
    category: 'Family',
    text: 'How old is {{child2Name}}?',
    type: 'mcq',
    options: AGE_OPTIONS,
  },
  q_other_children: {
    id: 'q_other_children',
    category: 'Family',
    text: 'Tell us about your other children — their names and rough ages',
    type: 'text',
    placeholder: 'e.g. Emma (14), Ali (9), Sara (6)',
  },
  q_children_relationship: {
    id: 'q_children_relationship',
    category: 'Family',
    text: 'How would you describe your relationship with your children overall?',
    type: 'mcq',
    options: {
      very_close: 'Very close — we share a lot together',
      warm:       "Warm, though we're all busy with life",
      working:    "I'm working on being more present",
      complex:    "It's complex — different with each child",
    },
  },
  q_living_with: {
    id: 'q_living_with',
    category: 'Living',
    text: 'Where do you currently live relative to your family?',
    type: 'mcq',
    options: {
      together:     'We all live together',
      same_city:    'Same city, but separate homes',
      diff_city:    'Different city or region',
      diff_country: 'Different country',
    },
  },
  q_meeting_freq: {
    id: 'q_meeting_freq',
    category: 'Living',
    text: 'How often do you get to spend time together in person?',
    type: 'mcq',
    options: {
      weekly:   'Multiple times a week',
      monthly:  'A few times a month',
      few_year: 'A few times a year',
      rarely:   'Rarely — mainly stay in touch remotely',
    },
  },
  q_education: {
    id: 'q_education',
    category: 'Background',
    text: 'What is your highest level of education?',
    type: 'mcq',
    options: {
      high_school: 'High school / Secondary school',
      vocational:  'Vocational / Trade qualification',
      university:  'University / College degree',
      postgrad:    'Postgraduate (Masters, PhD, etc.)',
    },
  },
  q_work_field: {
    id: 'q_work_field',
    category: 'Background',
    text: 'What field do you work in?',
    type: 'mcq',
    options: {
      technology: 'Technology / Engineering',
      healthcare: 'Healthcare / Medicine',
      business:   'Business / Finance',
      education:  'Education / Teaching',
      trades:     'Trades / Manual work',
      arts:       'Arts / Creative / Media',
      other:      'Other',
    },
  },
};

// ── Sequence Logic ────────────────────────────────────────────────────────────

export function getQuestionSequence(answers) {
  const seq = ['q_children_count'];
  const cc = answers.q_children_count;

  if (cc === 'one') {
    seq.push('q_child1_name', 'q_child1_age', 'q_child1_relationship');
  } else if (cc === 'two') {
    seq.push('q_child1_name', 'q_child1_age', 'q_child2_name', 'q_child2_age', 'q_children_relationship');
  } else if (cc === 'three_plus') {
    seq.push('q_child1_name', 'q_child1_age', 'q_other_children', 'q_children_relationship');
  }

  seq.push('q_living_with');

  if (answers.q_living_with && answers.q_living_with !== 'together') {
    seq.push('q_meeting_freq');
  }

  seq.push('q_education', 'q_work_field');
  return seq;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  Family:     '#6366F1',
  Living:     '#10B981',
  Background: '#F59E0B',
};

function resolveText(template, answers) {
  return template
    .replace('{{child1Name}}', answers.q_child1_name || 'your child')
    .replace('{{child2Name}}', answers.q_child2_name || 'your second child');
}

// ── Component ─────────────────────────────────────────────────────────────────

const FamilyAssessmentScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const textInputRef = useRef(null);

  const sequence    = getQuestionSequence(answers);
  const questionKey = sequence[currentStep];
  const question    = QUESTION_BANK[questionKey];
  const totalSteps  = sequence.length;
  const currentValue = answers[questionKey] ?? '';
  const canAdvance  = typeof currentValue === 'string' && currentValue.trim().length > 0;
  const isLast      = currentStep === totalSteps - 1;

  const categoryColor = CATEGORY_COLORS[question?.category] ?? colors.primary;
  const progressPct   = ((currentStep + 1) / totalSteps) * 100;

  const questionText = question ? resolveText(question.text, answers) : '';

  const selectMcq = (optionKey) => {
    setAnswers(prev => ({ ...prev, [questionKey]: optionKey }));
  };

  const setTextAnswer = (value) => {
    setAnswers(prev => ({ ...prev, [questionKey]: value }));
  };

  const canGoBack = currentStep > 0 || navigation.canGoBack();

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const goNext = async () => {
    if (!canAdvance) return;

    if (!isLast) {
      setCurrentStep(s => s + 1);
      return;
    }

    // Last question — save and proceed
    try {
      await AsyncStorage.setItem(
        storageKey(user?.username, KEYS.assessmentAnswers),
        JSON.stringify(answers)
      );
    } catch {
      // Non-critical; proceed anyway
    }
    navigation.replace('MainTabs');
  };

  if (!question) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.headerTitle}>Tell Us About You</Text>
        <Text style={styles.counter}>{currentStep + 1} / {totalSteps}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: categoryColor }]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Category badge */}
          <View style={[styles.badge, { backgroundColor: categoryColor + '20', borderColor: categoryColor }]}>
            <Text style={[styles.badgeText, { color: categoryColor }]}>{question.category}</Text>
          </View>

          {/* Question */}
          <Text style={styles.questionText}>{questionText}</Text>

          {/* Options — MCQ */}
          {question.type === 'mcq' && (
            <View style={styles.optionsContainer}>
              {Object.entries(question.options).map(([key, label]) => {
                const isSelected = currentValue === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.optionCard,
                      isSelected && { borderColor: categoryColor, backgroundColor: categoryColor + '12' },
                    ]}
                    onPress={() => selectMcq(key)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionDot, isSelected && { backgroundColor: categoryColor, borderColor: categoryColor }]}>
                      {isSelected && <View style={styles.optionDotInner} />}
                    </View>
                    <Text style={[styles.optionLabel, isSelected && { color: colors.textPrimary, fontWeight: '600' }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Text input */}
          {question.type === 'text' && (
            <View style={[styles.textInputCard, { borderColor: currentValue.trim() ? categoryColor : colors.border }]}>
              <TextInput
                ref={textInputRef}
                style={[styles.textInput, { color: colors.textPrimary }]}
                value={currentValue}
                onChangeText={setTextAnswer}
                placeholder={question.placeholder ?? 'Type your answer…'}
                placeholderTextColor={colors.inputPlaceholder ?? colors.textMuted}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={canAdvance ? goNext : undefined}
                autoFocus
              />
            </View>
          )}
        </ScrollView>

        {/* Footer CTA */}
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
                {isLast ? 'Create My Clone →' : 'Next →'}
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
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: colors.textPrimary,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  counter: {
    width: 36,
    textAlign: 'right',
    fontSize: 13,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    marginHorizontal: 20,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  body: {
    padding: 24,
    paddingBottom: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 28,
    marginBottom: 28,
  },
  optionsContainer: {
    gap: 12,
  },
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
  optionDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  textInputCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 22,
    minHeight: 44,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.background,
  },
  nextBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  nextBtnDisabled: {
    opacity: 0.6,
  },
  nextGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  nextTextDisabled: {
    color: colors.buttonDisabledText,
  },
});

export default FamilyAssessmentScreen;
