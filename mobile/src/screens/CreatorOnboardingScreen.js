/**
 * CreatorOnboardingScreen
 * 20-question multi-step onboarding. Receives cloneType param: 'family' | 'personal'.
 * Questions in Step 2, Step 4 (Q15), and Step 5 adapt based on clone type.
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { colors } from '../theme/colors';
import familyService from '../services/familyService';
import cloneService from '../services/cloneService';

// ── Question definitions ───────────────────────────────────────────────────────

const STEP1 = {
  title: 'About You',
  questions: [
    { key: 'q1', text: 'What is your full name and what do people call you?' },
    { key: 'q2', text: 'Describe your profession and career journey in your own words.' },
    { key: 'q3', text: 'Where did you grow up and how did that shape who you are?' },
    { key: 'q4', text: 'What is your educational background?' },
  ],
};

const STEP2_FAMILY = {
  title: 'Your Family',
  questions: [
    { key: 'q5', text: 'Tell me about your spouse or partner.' },
    { key: 'q6', text: 'How many children do you have? Tell me their names, ages, and something special about each one.' },
    { key: 'q7', text: 'What family traditions are most important to you?' },
    { key: 'q8', text: 'Share a favourite family memory.' },
  ],
};

const STEP2_PERSONAL = {
  title: 'Your Relationships',
  questions: [
    { key: 'q5', text: 'Tell me about the most important relationships in your life.' },
    { key: 'q6', text: 'Who are the closest people in your life and what makes those relationships special?' },
    { key: 'q7', text: 'What personal traditions or rituals are most important to you?' },
    { key: 'q8', text: 'Share a favourite personal memory.' },
  ],
};

const STEP3 = {
  title: 'Values & Life Philosophy',
  questions: [
    { key: 'q9',  text: 'What are your top 3 core values and why do they matter to you?' },
    { key: 'q10', text: 'What is the most important life lesson you have learned?' },
    { key: 'q11', text: 'How do you handle adversity? What advice would you give about it?' },
    { key: 'q12', text: 'What do you want your legacy to be?' },
  ],
};

const STEP4_FAMILY = {
  title: 'Personality & Communication',
  questions: [
    { key: 'q13', text: 'How would your family describe you in 3 words?' },
    { key: 'q14', text: 'What topics do you love discussing most?' },
    { key: 'q15', text: 'How do you typically show love and care to your family?' },
    { key: 'q16', text: 'Describe your sense of humor — share a joke or funny story.' },
  ],
};

const STEP4_PERSONAL = {
  title: 'Personality & Communication',
  questions: [
    { key: 'q13', text: 'How would the people close to you describe you in 3 words?' },
    { key: 'q14', text: 'What topics do you love discussing most?' },
    { key: 'q15', text: 'How do you typically show care and appreciation to the people close to you?' },
    { key: 'q16', text: 'Describe your sense of humor — share a joke or funny story.' },
  ],
};

const STEP5_FAMILY = {
  title: 'Wisdom for Your Family',
  questions: [
    { key: 'q17', text: 'What advice would you give your children about relationships and love?' },
    { key: 'q18', text: 'What do you wish you had known at 20 that you know now?' },
    { key: 'q19', text: "What are your hopes and dreams for your family's future?" },
    { key: 'q20', text: 'Is there anything else you want your family to know and remember about you?' },
  ],
};

const STEP5_PERSONAL = {
  title: 'Your Wisdom',
  questions: [
    { key: 'q17', text: 'What advice would you give someone younger about relationships and love?' },
    { key: 'q18', text: 'What do you wish you had known at 20 that you know now?' },
    { key: 'q19', text: 'What are your hopes and dreams for your future?' },
    { key: 'q20', text: 'Is there anything else you want people to know and remember about you?' },
  ],
};

const getSteps = (cloneType) => [
  STEP1,
  cloneType === 'personal' ? STEP2_PERSONAL : STEP2_FAMILY,
  STEP3,
  cloneType === 'personal' ? STEP4_PERSONAL : STEP4_FAMILY,
  cloneType === 'personal' ? STEP5_PERSONAL : STEP5_FAMILY,
];

// iOS: LinearPCM → .wav; Android: AAC → .mp4
const RECORDING_OPTIONS = {
  isMeteringEnabled: false,
  android: {
    extension: '.mp4',
    outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
    audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
    outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

const TOTAL_STEPS = 5;

const CreatorOnboardingScreen = ({ route, navigation }) => {
  const cloneType = route?.params?.cloneType ?? 'family';
  const STEPS = getSteps(cloneType);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [recording, setRecording] = useState(null);
  const [recordingKey, setRecordingKey] = useState(null);
  const [transcribing, setTranscribing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showFinalStep, setShowFinalStep] = useState(false);
  const [finalName, setFinalName] = useState('');
  const recordingRef = useRef(null);
  const recordingStartTime = useRef(null);

  const currentStepData = STEPS[step];

  const setAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  // ── Voice recording ───────────────────────────────────────────────────────────

  const startRecording = async (questionKey) => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone permission is required.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = rec;
      recordingStartTime.current = Date.now();
      setRecording(rec);
      setRecordingKey(questionKey);
    } catch (e) {
      console.error('[Onboarding] startRecording error', e);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async (questionKey) => {
    if (!recordingRef.current) return;
    const duration = Date.now() - (recordingStartTime.current ?? 0);
    setRecording(null);
    setRecordingKey(null);

    if (duration < 700) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch (_) {}
      recordingRef.current = null;
      Alert.alert('Too short', 'Hold the mic button longer to record your answer.');
      return;
    }

    const rec = recordingRef.current;
    recordingRef.current = null;
    try { await rec.stopAndUnloadAsync(); } catch (_) {}
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    const uri = rec.getURI();
    if (!uri) return;
    const format = uri.endsWith('.wav') ? 'wav' : 'mp4';

    setTranscribing(questionKey);
    try {
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const transcript = await transcribeAudio(base64Audio, format);
      if (transcript) {
        setAnswer(questionKey, (answers[questionKey] ? answers[questionKey] + ' ' : '') + transcript);
      }
    } catch (e) {
      console.error('[Onboarding] transcribe error', e);
    } finally {
      setTranscribing(null);
    }
  };

  const transcribeAudio = (base64Audio, format) => {
    return new Promise((resolve) => {
      import('../config/apiConfig').then(({ API_BASE_URL }) => {
        import('../services/authService').then(async ({ default: authService }) => {
          const { data: session } = await authService.getSession();
          const token = session?.getIdToken?.()?.getJwtToken?.();
          if (!token) return resolve(null);

          const wsUrl = API_BASE_URL
            .replace(/^http/, 'ws')
            .replace(/\/+$/, '')
            .replace('/api/v1', '') + '/api/v1/ws/voice';

          const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
          let transcript = null;
          let timer = null;

          const cleanup = () => {
            clearTimeout(timer);
            try { ws.close(); } catch (_) {}
          };

          timer = setTimeout(() => { cleanup(); resolve(transcript); }, 20000);

          ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'init', clone_id: 'stt-only', domain: 'general', session_id: 'onboarding' }));
            ws.send(JSON.stringify({ type: 'audio_chunk', data: base64Audio }));
            ws.send(JSON.stringify({ type: 'end_of_speech', format }));
          };
          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'transcript') { transcript = msg.data; cleanup(); resolve(transcript); }
              else if (msg.type === 'error') { cleanup(); resolve(null); }
            } catch (_) {}
          };
          ws.onerror = () => { cleanup(); resolve(null); };
          ws.onclose = () => { if (transcript === null) resolve(null); };
        });
      });
    });
  };

  // ── Navigation ────────────────────────────────────────────────────────────────

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      setShowFinalStep(true);
    }
  };

  const goBack = () => {
    if (showFinalStep) {
      setShowFinalStep(false);
    } else if (step > 0) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  // ── Submission ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const name = finalName.trim();
    if (!name) {
      const label = cloneType === 'personal' ? 'clone name' : 'family name';
      Alert.alert('Name Required', `Please enter a ${label} to continue.`);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Synthesize persona
      const { data: synthesis, error: synthError } = await familyService.synthesizePersona(answers);
      if (synthError) throw new Error(synthError.message || 'Persona synthesis failed');

      // 2. Create clone
      const cloneName = (answers.q1 || 'My Clone').split(' ').slice(0, 2).join(' ');
      const domains = cloneType === 'family' ? 'family,general' : 'general,mentorship';
      const { data: clone, error: cloneError } = await cloneService.createClone({
        name: cloneName,
        title: cloneType === 'family' ? 'Family AI Clone' : 'Personal AI Clone',
        description: `AI clone of ${cloneName}`,
        persona_prompt: synthesis.persona_prompt,
        domains,
        voice_id: '',
      });
      if (cloneError) throw new Error(cloneError.message || 'Clone creation failed');

      // 3. Ingest knowledge
      await cloneService.ingestText(clone.id, synthesis.knowledge_text, 'onboarding-questionnaire');

      // 4. Family type: create family record and go to FamilyManagement
      if (cloneType === 'family') {
        const { error: familyError } = await familyService.createFamily(name, clone.id);
        if (familyError) throw new Error(familyError.message || 'Family creation failed');
        navigation.replace('FamilyManagement');
      } else {
        // Personal type: no family record needed, go to PersonalClone screen
        navigation.replace('PersonalClone', { clone });
      }
    } catch (e) {
      Alert.alert('Setup Failed', e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Final step (name entry) ───────────────────────────────────────────────────

  const progressPct = ((step + (showFinalStep ? 1 : 0)) / TOTAL_STEPS) * 100;

  if (showFinalStep) {
    const isFamily = cloneType === 'family';
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.stepHeader}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '100%' }]} />
            </View>
            <Text style={styles.stepLabel}>Almost done!</Text>
            <Text style={styles.stepTitle}>{isFamily ? 'Name Your Family' : 'Name Your Clone'}</Text>
          </LinearGradient>

          <ScrollView style={styles.questionsContainer} contentContainerStyle={styles.questionsContent}>
            <View style={styles.questionBlock}>
              <Text style={styles.questionText}>
                {isFamily
                  ? 'What would you like to call your family group? (e.g. "The Johnson Family")'
                  : 'What should people call your clone? (e.g. "David\'s Clone" or just your name)'}
              </Text>
              <TextInput
                style={[styles.answerInput, { minHeight: 56 }]}
                value={finalName}
                onChangeText={setFinalName}
                placeholder={isFamily ? 'The Johnson Family' : 'David Johnson'}
                placeholderTextColor="#bbb"
                returnKeyType="done"
              />
            </View>
          </ScrollView>

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backButton} onPress={goBack}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextButton, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <LinearGradient
                colors={submitting ? ['#a0aec0', '#a0aec0'] : ['#4f46e5', '#7c3aed']}
                style={styles.nextButtonGradient}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.nextButtonText}>Create My Clone ✓</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Main questionnaire ────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.stepHeader}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.stepLabel}>Step {step + 1} of {TOTAL_STEPS}</Text>
          <Text style={styles.stepTitle}>{currentStepData.title}</Text>
        </LinearGradient>

        <ScrollView
          style={styles.questionsContainer}
          contentContainerStyle={styles.questionsContent}
          keyboardShouldPersistTaps="handled"
        >
          {currentStepData.questions.map((q, idx) => (
            <View key={q.key} style={styles.questionBlock}>
              <Text style={styles.questionNumber}>Q{step * 4 + idx + 1}</Text>
              <Text style={styles.questionText}>{q.text}</Text>
              <View style={styles.answerRow}>
                <TextInput
                  style={styles.answerInput}
                  multiline
                  value={answers[q.key] || ''}
                  onChangeText={(t) => setAnswer(q.key, t)}
                  placeholder="Type your answer here…"
                  placeholderTextColor="#bbb"
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[
                    styles.micButton,
                    recordingKey === q.key && styles.micButtonActive,
                    transcribing === q.key && styles.micButtonTranscribing,
                  ]}
                  onPressIn={() => startRecording(q.key)}
                  onPressOut={() => stopRecording(q.key)}
                  disabled={!!transcribing || (!!recording && recordingKey !== q.key)}
                >
                  {transcribing === q.key
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.micIcon}>{recordingKey === q.key ? '⏹' : '🎤'}</Text>
                  }
                </TouchableOpacity>
              </View>
              {recordingKey === q.key && (
                <Text style={styles.recordingHint}>Recording… release to stop</Text>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextButton} onPress={goNext}>
            <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.nextButtonGradient}>
              <Text style={styles.nextButtonText}>
                {step === TOTAL_STEPS - 1 ? 'Finish →' : 'Next →'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  stepHeader: { paddingTop: 48, paddingBottom: 20, paddingHorizontal: 24 },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  stepLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  questionsContainer: { flex: 1 },
  questionsContent: { padding: 16, paddingBottom: 8, gap: 16 },
  questionBlock: {
    backgroundColor: colors.surface || '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  questionNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text || '#1a1a2e',
    marginBottom: 12,
    lineHeight: 22,
  },
  answerRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  answerInput: {
    flex: 1,
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: colors.text || '#1a1a2e',
    lineHeight: 20,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  micButtonActive: { backgroundColor: '#ef4444' },
  micButtonTranscribing: { backgroundColor: '#f59e0b' },
  micIcon: { fontSize: 20 },
  recordingHint: { fontSize: 11, color: '#ef4444', marginTop: 4, fontStyle: 'italic' },
  navRow: { flexDirection: 'row', padding: 16, paddingBottom: 24, gap: 12, alignItems: 'center' },
  backButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary || '#888' },
  nextButton: { flex: 2 },
  nextButtonGradient: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default CreatorOnboardingScreen;
