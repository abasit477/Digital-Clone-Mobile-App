/**
 * VoiceRecordScreen
 * Creator records a voice sample (30s) to power XTTS voice cloning.
 * The clone will speak in the creator's voice on all future responses.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { colors } from '../theme/colors';
import chatService from '../services/chatService';

const TARGET_SECONDS = 30;

const READING_SCRIPT =
  `"Every morning I wake up and think about the people I love most — my family, " +
  "my friends, and all the little moments that make life worthwhile. " +
  "The weather today is perfect for a walk outside. " +
  "I enjoy cooking simple meals, reading before bed, and having long conversations over coffee. " +
  "Technology has changed the way we connect, but nothing replaces a warm smile and a kind word."`;

const VoiceRecordScreen = ({ navigation }) => {
  const [phase, setPhase]     = useState('idle'); // idle | recording | uploading | done
  const [elapsed, setElapsed] = useState(0);
  const recordingRef          = useRef(null);
  const timerRef              = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission required', 'Microphone access is needed to record your voice.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setElapsed(0);
      setPhase('recording');
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          if (prev + 1 >= TARGET_SECONDS) {
            clearInterval(timerRef.current);
            stopRecording();
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      Alert.alert('Error', 'Could not start recording: ' + err.message);
    }
  };

  const stopRecording = async () => {
    clearInterval(timerRef.current);
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return;

    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    const uri    = recording.getURI();
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    setPhase('uploading');
    const { data, error } = await chatService.uploadVoiceSample(base64);

    if (error) {
      Alert.alert('Upload failed', error?.message ?? 'Could not save voice sample. Try again.');
      setPhase('idle');
      return;
    }

    setPhase('done');
  };

  const progress  = Math.min(elapsed / TARGET_SECONDS, 1);
  const remaining = TARGET_SECONDS - elapsed;

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <SafeAreaView style={styles.safe}>

        {/* Header */}
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          <Text style={styles.title}>Clone Your Voice</Text>
          <Text style={styles.subtitle}>
            Read the text below out loud for 30 seconds. Speak clearly and naturally —
            your clone will respond in your voice.
          </Text>

          {/* Progress ring */}
          <View style={styles.ringOuter}>
            <View style={[
              styles.ringFill,
              phase === 'recording' && styles.ringActive,
            ]}>
              {phase === 'idle'      && <Text style={styles.ringIcon}>🎙️</Text>}
              {phase === 'recording' && (
                <>
                  <Text style={styles.ringCount}>{remaining}</Text>
                  <Text style={styles.ringLabel}>seconds left</Text>
                </>
              )}
              {phase === 'uploading' && <ActivityIndicator size="large" color="#fff" />}
              {phase === 'done'      && <Text style={styles.ringIcon}>✅</Text>}
            </View>
          </View>

          {/* Progress bar */}
          {phase === 'recording' && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
            </View>
          )}

          {/* Status */}
          <Text style={styles.statusText}>
            {phase === 'idle'      && 'Tap Start and read the text below'}
            {phase === 'recording' && '🔴 Recording — read the text below clearly'}
            {phase === 'uploading' && 'Saving your voice sample…'}
            {phase === 'done'      && '🎉 Done! Your clone will now speak in your voice.'}
          </Text>

          {/* Reading script card */}
          {(phase === 'idle' || phase === 'recording') && (
            <View style={styles.scriptCard}>
              <Text style={styles.scriptLabel}>READ THIS ALOUD</Text>
              <Text style={styles.scriptText}>
                Every morning I wake up and think about the people I love most — my family, my
                friends, and all the little moments that make life worthwhile. The weather today is
                perfect for a walk outside. I enjoy cooking simple meals, reading before bed, and
                having long conversations over coffee. Technology has changed the way we connect,
                but nothing replaces a warm smile and a kind word. I am grateful for each new day
                and the opportunities it brings to grow and share with others.
              </Text>
            </View>
          )}

          {/* Action button */}
          <View style={styles.btnRow}>
            {phase === 'idle' && (
              <TouchableOpacity style={styles.btn} onPress={startRecording}>
                <Text style={styles.btnText}>▶  Start Recording</Text>
              </TouchableOpacity>
            )}
            {phase === 'recording' && (
              <TouchableOpacity style={[styles.btn, styles.btnStop]} onPress={stopRecording}>
                <Text style={styles.btnText}>⏹  Stop Early</Text>
              </TouchableOpacity>
            )}
            {phase === 'done' && (
              <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
                <Text style={styles.btnText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1 },
  safe:        { flex: 1 },
  back:        { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backText:    { color: 'rgba(255,255,255,0.8)', fontSize: 16 },

  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },

  // Ring
  ringOuter:  { marginBottom: 20 },
  ringFill:   {
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  ringActive: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  ringIcon:  { fontSize: 44 },
  ringCount: { fontSize: 38, fontWeight: '800', color: '#fff' },
  ringLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // Progress bar
  progressTrack: {
    width: '100%', height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%', borderRadius: 3,
    backgroundColor: '#fff',
  },

  // Status
  statusText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 20,
    minHeight: 20,
  },

  // Script card
  scriptCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  scriptLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  scriptText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 26,
    fontWeight: '400',
  },

  // Button
  btnRow: { width: '100%', alignItems: 'center' },
  btn: {
    backgroundColor: '#fff',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 30,
    minWidth: 200,
    alignItems: 'center',
  },
  btnStop: { backgroundColor: '#e74c3c' },
  btnText: {
    color: colors.gradientEnd,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default VoiceRecordScreen;
