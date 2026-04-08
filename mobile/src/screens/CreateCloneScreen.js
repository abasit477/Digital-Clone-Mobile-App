import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { InputField, PrimaryButton, ErrorMessage } from '../components';
import { cloneService } from '../services/cloneService';
import { colors }       from '../theme/colors';
import { typography }   from '../theme/typography';
import { spacing, radius, shadows } from '../theme/spacing';

// ─── Available domains ────────────────────────────────────────────────────────
const DOMAIN_OPTIONS = [
  { key: 'general',      label: 'General',       desc: 'Open-ended conversations' },
  { key: 'family',       label: 'Family',         desc: 'Parental guidance, relationships' },
  { key: 'professional', label: 'Professional',   desc: 'Career, leadership, strategy' },
  { key: 'mentorship',   label: 'Mentorship',     desc: 'Personal growth, life lessons' },
];

// ─── Available Polly voices ───────────────────────────────────────────────────
const VOICE_OPTIONS = [
  { id: 'Matthew', label: 'Matthew', desc: 'Male · American' },
  { id: 'Joanna',  label: 'Joanna',  desc: 'Female · American' },
  { id: 'Brian',   label: 'Brian',   desc: 'Male · British' },
  { id: 'Amy',     label: 'Amy',     desc: 'Female · British' },
  { id: 'Raveena', label: 'Raveena', desc: 'Female · Indian' },
  { id: 'Lupe',    label: 'Lupe',    desc: 'Female · Spanish' },
];

// ─── Section heading ──────────────────────────────────────────────────────────
const SectionHeading = ({ text }) => (
  <Text style={secStyles.heading}>{text}</Text>
);
const secStyles = StyleSheet.create({
  heading: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
    marginTop: spacing[2],
  },
});

// ─── Create Clone Screen ──────────────────────────────────────────────────────
const CreateCloneScreen = ({ navigation }) => {
  const [name,          setName]          = useState('');
  const [title,         setTitle]         = useState('');
  const [description,   setDescription]   = useState('');
  const [personaPrompt, setPersonaPrompt] = useState('');
  const [selectedDomains, setSelectedDomains] = useState(['general']);
  const [selectedVoice, setSelectedVoice] = useState('Matthew');
  const [errors,        setErrors]        = useState({});
  const [apiError,      setApiError]      = useState('');
  const [loading,       setLoading]       = useState(false);

  const titleRef       = useRef(null);
  const descriptionRef = useRef(null);

  const toggleDomain = useCallback((key) => {
    setSelectedDomains((prev) =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter((d) => d !== key) : prev   // keep at least one
        : [...prev, key],
    );
  }, []);

  const validate = useCallback(() => {
    const newErrors = {};
    if (!name.trim())          newErrors.name          = 'Name is required.';
    if (!personaPrompt.trim()) newErrors.personaPrompt = 'Persona prompt is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, personaPrompt]);

  const handleCreate = useCallback(async () => {
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    const payload = {
      name:           name.trim(),
      title:          title.trim(),
      description:    description.trim(),
      persona_prompt: personaPrompt.trim(),
      domains:        selectedDomains.join(','),
      voice_id:       selectedVoice,
    };

    const { data, error } = await cloneService.createClone(payload);
    setLoading(false);

    if (error) {
      setApiError(error?.message ?? 'Failed to create clone. Please try again.');
      return;
    }

    Alert.alert(
      'Clone Created',
      `"${data.name}" has been created. You can now add knowledge to it.`,
      [
        {
          text: 'Add Knowledge',
          onPress: () => {
            navigation.replace('ManageClone', { clone: data });
          },
        },
        {
          text: 'Done',
          onPress: () => navigation.goBack(),
        },
      ],
    );
  }, [name, title, description, personaPrompt, selectedDomains, selectedVoice, validate, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="none"
      >
        {/* Back */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backText}>Dashboard</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.badge}
          >
            <Text style={styles.badgeText}>New Clone</Text>
          </LinearGradient>
          <Text style={styles.heading}>Create a digital clone</Text>
          <Text style={styles.subheading}>
            Define who this clone is and how they should speak.
          </Text>
        </View>

        <View style={styles.card}>
          <ErrorMessage message={apiError} onDismiss={() => setApiError('')} />

          {/* Basic info */}
          <SectionHeading text="Basic info" />

          <InputField
            label="Full name *"
            value={name}
            onChangeText={(t) => { setName(t); if (errors.name) setErrors((e) => ({ ...e, name: null })); }}
            placeholder="e.g. John Smith"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => titleRef.current?.focus()}
            error={errors.name}
          />

          <InputField
            ref={titleRef}
            label="Title / Role"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Father, Entrepreneur, Coach"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => descriptionRef.current?.focus()}
          />

          <InputField
            ref={descriptionRef}
            label="Short description"
            value={description}
            onChangeText={setDescription}
            placeholder="Shown on the clone selection screen"
            autoCapitalize="sentences"
            returnKeyType="done"
            maxLength={200}
          />

          {/* Persona prompt */}
          <SectionHeading text="Persona prompt" />
          <Text style={styles.promptHint}>
            Write in first person. Describe who this person is, what they believe, how they speak, and what experiences shaped them. The more detail, the more authentic the clone.
          </Text>

          <View style={[styles.textAreaWrapper, errors.personaPrompt && styles.textAreaError]}>
            <TextInput
              style={styles.textArea}
              value={personaPrompt}
              onChangeText={(t) => {
                setPersonaPrompt(t);
                if (errors.personaPrompt) setErrors((e) => ({ ...e, personaPrompt: null }));
              }}
              placeholder={
                'e.g. You are John Smith. You grew up in a small town and built your first business at 24. You believe that hard work and integrity are the only shortcuts worth taking. You speak directly but with warmth, often using stories from your own life to make a point...'
              }
              placeholderTextColor={colors.inputPlaceholder}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoCapitalize="sentences"
              selectionColor={colors.primary}
            />
          </View>
          {errors.personaPrompt ? (
            <Text style={styles.fieldError}>{errors.personaPrompt}</Text>
          ) : null}

          {/* Domains */}
          <SectionHeading text="Interaction domains" />
          <Text style={styles.promptHint}>
            Select all contexts this clone should support.
          </Text>
          <View style={styles.domainGrid}>
            {DOMAIN_OPTIONS.map((d) => {
              const active = selectedDomains.includes(d.key);
              return (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.domainCard, active && styles.domainCardActive]}
                  onPress={() => toggleDomain(d.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.domainLabel, active && styles.domainLabelActive]}>
                    {d.label}
                  </Text>
                  <Text style={[styles.domainDesc, active && styles.domainDescActive]}>
                    {d.desc}
                  </Text>
                  {active && (
                    <View style={styles.domainCheck}>
                      <Text style={styles.domainCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Voice */}
          <SectionHeading text="Voice (AWS Polly)" />
          <View style={styles.voiceGrid}>
            {VOICE_OPTIONS.map((v) => {
              const active = selectedVoice === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.voiceChip, active && styles.voiceChipActive]}
                  onPress={() => setSelectedVoice(v.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.voiceLabel, active && styles.voiceLabelActive]}>
                    {v.label}
                  </Text>
                  <Text style={[styles.voiceDesc, active && styles.voiceDescActive]}>
                    {v.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <PrimaryButton
            title="Create Clone"
            onPress={handleCreate}
            loading={loading}
            disabled={loading}
            style={{ marginTop: spacing[4] }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[10],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    alignSelf: 'flex-start',
  },
  backIcon: { fontSize: 18, color: colors.primary, marginRight: spacing[1.5] },
  backText:  { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  header: { marginBottom: spacing[6] },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    marginBottom: spacing[3],
  },
  badgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heading: {
    ...typography.displayMedium,
    color: colors.textPrimary,
    marginBottom: spacing[1],
  },
  subheading: { ...typography.bodyMedium, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[6],
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  promptHint: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: spacing[3],
    marginTop: -spacing[1],
  },
  textAreaWrapper: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[4],
    minHeight: 140,
  },
  textAreaError: {
    borderColor: colors.error,
    backgroundColor: '#FEF2F2',
  },
  textArea: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    lineHeight: 22,
    minHeight: 120,
  },
  fieldError: {
    fontSize: 11,
    color: colors.error,
    marginTop: -spacing[3],
    marginBottom: spacing[3],
    marginLeft: spacing[1],
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[5],
  },
  domainCard: {
    width: '47%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing[3],
    backgroundColor: colors.surface,
    position: 'relative',
  },
  domainCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.indigo50,
  },
  domainLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  domainLabelActive: { color: colors.primary },
  domainDesc: { ...typography.caption, color: colors.textMuted, lineHeight: 14 },
  domainDescActive: { color: colors.primary, opacity: 0.8 },
  domainCheck: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainCheckText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  voiceChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.surface,
    minWidth: '30%',
  },
  voiceChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.indigo50,
  },
  voiceLabel: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '700' },
  voiceLabelActive: { color: colors.primary },
  voiceDesc: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  voiceDescActive: { color: colors.primary, opacity: 0.8 },
});

export default CreateCloneScreen;
