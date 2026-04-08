import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';

import { PrimaryButton, ErrorMessage } from '../components';
import { cloneService }  from '../services/cloneService';
import { colors }        from '../theme/colors';
import { typography }    from '../theme/typography';
import { spacing, radius, shadows } from '../theme/spacing';

// ─── Info row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value, isLast }) => (
  <View style={[infoStyles.row, isLast && infoStyles.rowLast]}>
    <Text style={infoStyles.label}>{label}</Text>
    <Text style={infoStyles.value} numberOfLines={2}>{value || '—'}</Text>
  </View>
);
const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing[2.5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  value: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '500', flex: 2, textAlign: 'right' },
});

// ─── Manage Clone Screen ──────────────────────────────────────────────────────
const ManageCloneScreen = ({ route, navigation }) => {
  const { clone: initialClone } = route.params;
  const [clone, setClone] = useState(initialClone);

  // ── Knowledge — text ──────────────────────────────────────────────────────
  const [knowledgeText,   setKnowledgeText]   = useState('');
  const [knowledgeSource, setKnowledgeSource] = useState('');
  const [ingestingText,   setIngestingText]   = useState(false);
  const [textSuccess,     setTextSuccess]     = useState('');
  const [textError,       setTextError]       = useState('');

  // ── Knowledge — file ──────────────────────────────────────────────────────
  const [ingestingFile,   setIngestingFile]   = useState(false);
  const [fileSuccess,     setFileSuccess]     = useState('');
  const [fileError,       setFileError]       = useState('');

  const domains = clone.domains?.split(',').map((d) => d.trim()) ?? [];
  const initial = clone.name?.charAt(0)?.toUpperCase() ?? '?';

  // ── Ingest text ───────────────────────────────────────────────────────────
  const handleIngestText = useCallback(async () => {
    if (!knowledgeText.trim()) {
      setTextError('Please enter some text to add.');
      return;
    }
    setTextError('');
    setTextSuccess('');
    setIngestingText(true);

    const { data, error } = await cloneService.ingestText(
      clone.id,
      knowledgeText.trim(),
      knowledgeSource.trim() || 'Manual entry',
    );
    setIngestingText(false);

    if (error) {
      setTextError(error?.message ?? 'Failed to add knowledge.');
      return;
    }
    setTextSuccess(`Added ~${data.chunks_added} knowledge chunk${data.chunks_added !== 1 ? 's' : ''}.`);
    setKnowledgeText('');
    setKnowledgeSource('');
  }, [clone.id, knowledgeText, knowledgeSource]);

  // ── Ingest file ───────────────────────────────────────────────────────────
  const handlePickFile = useCallback(async () => {
    setFileError('');
    setFileSuccess('');

    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'text/markdown'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const ext = asset.name?.split('.').pop()?.toLowerCase();
    if (!['txt', 'md'].includes(ext)) {
      setFileError('Only .txt and .md files are supported.');
      return;
    }

    setIngestingFile(true);
    const { data, error } = await cloneService.ingestFile(
      clone.id,
      asset.uri,
      asset.name,
    );
    setIngestingFile(false);

    if (error) {
      setFileError(error?.message ?? 'Failed to upload file.');
      return;
    }
    setFileSuccess(`"${asset.name}" added — ~${data.chunks_added} knowledge chunks.`);
  }, [clone.id]);

  // ── Clear knowledge ───────────────────────────────────────────────────────
  const handleClearKnowledge = useCallback(() => {
    Alert.alert(
      'Clear all knowledge',
      `This removes all knowledge from "${clone.name}". The persona prompt is kept. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const { error } = await cloneService.clearKnowledge(clone.id);
            if (error) {
              Alert.alert('Error', 'Failed to clear knowledge.');
            } else {
              Alert.alert('Done', 'All knowledge has been removed.');
              setTextSuccess('');
              setFileSuccess('');
            }
          },
        },
      ],
    );
  }, [clone]);

  // ── Delete clone ──────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Clone',
      `Remove "${clone.name}" from the app? Users will no longer see it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await cloneService.deleteClone(clone.id);
            if (error) {
              Alert.alert('Error', 'Failed to delete clone.');
            } else {
              navigation.goBack();
            }
          },
        },
      ],
    );
  }, [clone, navigation]);

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

        {/* Clone hero */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.heroMeta}>
              <Text style={styles.heroName}>{clone.name}</Text>
              {clone.title ? (
                <Text style={styles.heroTitle}>{clone.title}</Text>
              ) : null}
              <View style={styles.domainRow}>
                {domains.map((d) => (
                  <View key={d} style={styles.domainBadge}>
                    <Text style={styles.domainBadgeText}>{d}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Clone details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Clone details</Text>
          <InfoRow label="Name"        value={clone.name} />
          <InfoRow label="Title"       value={clone.title} />
          <InfoRow label="Description" value={clone.description} />
          <InfoRow label="Voice"       value={clone.voice_id || 'Matthew'} />
          <InfoRow label="Domains"     value={domains.join(', ')} isLast />
        </View>

        {/* Persona prompt preview */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Persona prompt</Text>
          <Text style={styles.personaText} numberOfLines={5}>
            {clone.persona_prompt || '—'}
          </Text>
        </View>

        {/* ── Knowledge management ── */}
        <Text style={styles.sectionTitle}>Knowledge base</Text>
        <Text style={styles.sectionSubtitle}>
          Add text that this clone should know about — writings, beliefs, stories, lessons. More content = more authentic responses.
        </Text>

        {/* Paste text */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paste text</Text>
          <Text style={styles.inputHint}>
            Articles, quotes, interview transcripts, personal writings — anything written by or about this person.
          </Text>

          <ErrorMessage message={textError} onDismiss={() => setTextError('')} />
          {textSuccess ? (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>✓  {textSuccess}</Text>
            </View>
          ) : null}

          <View style={styles.textAreaWrapper}>
            <TextInput
              style={styles.textArea}
              value={knowledgeText}
              onChangeText={setKnowledgeText}
              placeholder="Paste text here…"
              placeholderTextColor={colors.inputPlaceholder}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoCapitalize="sentences"
              selectionColor={colors.primary}
            />
          </View>

          <View style={styles.sourceRow}>
            <TextInput
              style={styles.sourceInput}
              value={knowledgeSource}
              onChangeText={setKnowledgeSource}
              placeholder="Source label (optional) — e.g. Blog post 2023"
              placeholderTextColor={colors.inputPlaceholder}
              autoCapitalize="sentences"
              selectionColor={colors.primary}
            />
          </View>

          <PrimaryButton
            title={ingestingText ? 'Adding…' : 'Add to Knowledge Base'}
            onPress={handleIngestText}
            loading={ingestingText}
            disabled={ingestingText || !knowledgeText.trim()}
            style={{ marginTop: spacing[2] }}
          />
        </View>

        {/* Upload file */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upload a file</Text>
          <Text style={styles.inputHint}>
            Supported formats: .txt and .md — plain text files only.
          </Text>

          {fileError ? (
            <ErrorMessage message={fileError} onDismiss={() => setFileError('')} />
          ) : null}
          {fileSuccess ? (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>✓  {fileSuccess}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.uploadZone, ingestingFile && styles.uploadZoneDisabled]}
            onPress={handlePickFile}
            disabled={ingestingFile}
            activeOpacity={0.75}
          >
            {ingestingFile ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={styles.uploadIcon}>📄</Text>
                <Text style={styles.uploadLabel}>Tap to choose file</Text>
                <Text style={styles.uploadHint}>.txt or .md</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={styles.cardTitle}>Danger zone</Text>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleClearKnowledge}
            activeOpacity={0.8}
          >
            <Text style={styles.dangerButtonText}>Clear all knowledge</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerButton, { marginTop: spacing[3] }]}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Text style={styles.dangerButtonText}>Delete this clone</Text>
          </TouchableOpacity>
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
    paddingBottom: spacing[10],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    paddingHorizontal: spacing[5],
    alignSelf: 'flex-start',
  },
  backIcon: { fontSize: 18, color: colors.primary, marginRight: spacing[1.5] },
  backText:  { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },

  // Hero
  hero: {
    margin: spacing[5],
    borderRadius: radius['2xl'],
    padding: spacing[5],
    ...shadows.lg,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    marginRight: spacing[4],
    flexShrink: 0,
  },
  avatarText:  { ...typography.headingMedium, color: colors.white, fontWeight: '700' },
  heroMeta:    { flex: 1 },
  heroName:    { ...typography.headingMedium, color: colors.white, fontWeight: '700' },
  heroTitle:   { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  domainRow:   { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[2], gap: 6 },
  domainBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing[2.5],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  domainBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'capitalize',
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  dangerCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  cardTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  personaText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Section
  sectionTitle: {
    ...typography.headingSmall,
    color: colors.textPrimary,
    marginHorizontal: spacing[5],
    marginBottom: spacing[1],
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    lineHeight: 18,
  },
  inputHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    lineHeight: 16,
  },

  // Text area
  textAreaWrapper: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing[3],
    minHeight: 130,
    marginBottom: spacing[3],
  },
  textArea: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    lineHeight: 22,
    minHeight: 110,
  },
  sourceRow: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    height: 46,
    justifyContent: 'center',
  },
  sourceInput: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },

  // File upload
  uploadZone: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: spacing[6],
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    marginTop: spacing[2],
  },
  uploadZoneDisabled: { opacity: 0.5 },
  uploadIcon:  { fontSize: 32, marginBottom: spacing[2] },
  uploadLabel: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
  uploadHint:  { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  // Success
  successBanner: {
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  successText: { ...typography.bodySmall, color: '#15803D', fontWeight: '600' },

  // Danger
  dangerButton: {
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  dangerButtonText: { ...typography.bodySmall, color: colors.error, fontWeight: '600' },
});

export default ManageCloneScreen;
