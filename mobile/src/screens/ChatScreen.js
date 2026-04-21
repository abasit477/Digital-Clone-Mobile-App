/**
 * ChatScreen
 * Sends messages to the backend chat endpoint and renders the conversation.
 * Works for both creator mode and member mode — the backend detects the role
 * from the JWT and returns the appropriate clone response.
 *
 * On first open (empty history from backend) the clone automatically sends a
 * personalised opening message triggered by POST /chat/message with is_opening=true.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../store/authStore';
import { colors } from '../theme/colors';
import chatService from '../services/chatService';

const ChatScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [messages, setMessages]   = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [cloneName, setCloneName]   = useState('Family Clone');
  const [isRecording, setIsRecording] = useState(false);

  const [lastAudioUrl, setLastAudioUrl] = useState(null);

  const flatListRef    = useRef(null);
  const recordingRef   = useRef(null);
  const recordStartTs  = useRef(null);
  const responseSndRef = useRef(null);  // current TTS response sound

  // ── Cleanup audio on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => { responseSndRef.current?.unloadAsync(); };
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await chatService.getHistory();
        if (error) throw new Error(error.message);

        if (data.clone_name) setCloneName(data.clone_name);

        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map(m => ({ id: m.id, role: m.role, content: m.content })));
          setLoading(false);
        } else {
          // First open — trigger personalised opening from the clone
          setLoading(false);
          triggerOpeningMessage();
        }
      } catch (err) {
        console.error('[ChatScreen] init error:', err?.message);
        setLoading(false);
        triggerOpeningMessage();
      }
    };
    init();
  }, []);

  // ── Opening message ───────────────────────────────────────────────────────

  const triggerOpeningMessage = async () => {
    const placeholderId = 'opening-placeholder';
    setMessages([{ id: placeholderId, role: 'assistant', content: '' }]);
    setSending(true);

    try {
      const { data, error } = await chatService.sendMessage('', true);
      if (error) throw new Error(error.message);
      setMessages([{ id: data.id, role: 'assistant', content: data.content }]);
    } catch (err) {
      console.error('[ChatScreen] opening message error:', err?.message);
      setMessages([{
        id: placeholderId,
        role: 'assistant',
        content: 'Hello! Great to hear from you. How are you doing?',
      }]);
    } finally {
      setSending(false);
    }
  };

  // ── Send ──────────────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  const send = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: text };
    const placeholderId = `a-${Date.now()}`;
    const placeholder   = { id: placeholderId, role: 'assistant', content: '' };

    setMessages(prev => [...prev, userMsg, placeholder]);
    setSending(true);

    try {
      const { data, error } = await chatService.sendMessage(text);
      if (error) throw new Error(error.message);

      setMessages(prev =>
        prev.map(m => m.id === placeholderId
          ? { id: data.id, role: 'assistant', content: data.content }
          : m
        )
      );
    } catch (err) {
      console.error('[ChatScreen] send error:', err?.message);
      setMessages(prev =>
        prev.map(m => m.id === placeholderId
          ? { ...m, content: `Error: ${err?.message ?? 'Something went wrong'}` }
          : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  // ── Audio playback ────────────────────────────────────────────────────────

  const playAudioUrl = async (url) => {
    try {
      if (responseSndRef.current) await responseSndRef.current.unloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, isLooping: false },
      );
      responseSndRef.current = sound;
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish && !status.isLooping) {
          sound.unloadAsync();
        }
      });
    } catch (audioErr) {
      console.warn('[ChatScreen] TTS playback error:', audioErr?.message);
    }
  };

  // ── Voice recording ───────────────────────────────────────────────────────

  const startRecording = async () => {
    if (sending) return;
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync({
      isMeteringEnabled: false,
      android: { extension: '.mp4', outputFormat: 2, audioEncoder: 3, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
      ios:     { extension: '.wav', outputFormat: 'lpcm', audioQuality: 127, sampleRate: 16000, numberOfChannels: 1, bitRate: 256000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
    });
    recordingRef.current  = recording;
    recordStartTs.current = Date.now();
    setIsRecording(true);
  };

  const stopAndSendRecording = async () => {
    setIsRecording(false);
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return;

    const duration = Date.now() - (recordStartTs.current ?? 0);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    if (duration < 700) return; // too short — discard silently

    const uri    = recording.getURI();
    const format = uri.endsWith('.wav') ? 'wav' : 'mp4';
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

    const placeholderUserMsg = { id: `uv-${Date.now()}`, role: 'user', content: '🎤 …' };
    const placeholderAsstId  = `av-${Date.now()}`;
    const placeholderAsst    = { id: placeholderAsstId, role: 'assistant', content: '' };
    setMessages(prev => [...prev, placeholderUserMsg, placeholderAsst]);
    setSending(true);

    try {
      const { data, error } = await chatService.sendVoiceMessage(base64, format);
      if (error) throw new Error(error.message ?? 'Voice message failed');
      setMessages(prev => prev.map(m => {
        if (m.id === placeholderUserMsg.id) return { ...m, content: `🎤 ${data.transcript}` };
        if (m.id === placeholderAsstId)     return { id: data.id, role: 'assistant', content: data.content };
        return m;
      }));
      // Auto-play TTS response if backend returned an audio URL
      if (data.audio_url) {
        setLastAudioUrl(data.audio_url);
        await playAudioUrl(data.audio_url);
      }
    } catch (err) {
      console.error('[ChatScreen] voice send error:', err?.message);
      setMessages(prev => prev.map(m =>
        m.id === placeholderAsstId ? { ...m, content: `Error: ${err?.message ?? 'Something went wrong'}` } : m
      ));
    } finally {
      setSending(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>🧬</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          {item.content === '' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : isUser ? (
            <Text style={styles.bubbleTextUser}>{item.content}</Text>
          ) : (
            <Text style={styles.bubbleTextAssistant}>{item.content}</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.header}>
        <View style={styles.cloneAvatarSmall}>
          <Text style={styles.cloneAvatarEmoji}>🧬</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>{cloneName}</Text>
          <View style={styles.headerStatusRow}>
            <View style={styles.headerStatusDot} />
            <Text style={styles.headerSub}>Online</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={scrollToBottom}
      />

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          {lastAudioUrl && !isRecording && (
            <Pressable
              style={styles.replayBtn}
              onPress={() => playAudioUrl(lastAudioUrl)}
              disabled={sending}
            >
              <Text style={styles.micIcon}>🔊</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPressIn={startRecording}
            onPressOut={stopAndSendRecording}
            disabled={sending && !isRecording}
          >
            <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎤'}</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message…"
            placeholderTextColor={colors.inputPlaceholder}
            multiline
            maxLength={500}
            returnKeyType="default"
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={styles.sendGradient}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  cloneAvatarSmall: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  cloneAvatarEmoji: { fontSize: 20 },
  headerCenter:     { flex: 1 },
  headerName:       { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerStatusRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  headerStatusDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  headerSub:        { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  messageList:      { padding: 16, paddingBottom: 8 },
  bubbleRow:        { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  bubbleRowUser:    { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.indigo100,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, flexShrink: 0,
  },
  avatarText: { fontSize: 16 },
  bubble: {
    maxWidth: '75%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
    minHeight: 38, justifyContent: 'center',
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  bubbleTextUser:      { fontSize: 15, color: '#fff', lineHeight: 21 },
  bubbleTextAssistant: { fontSize: 15, color: colors.textPrimary, lineHeight: 21 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: 10,
  },
  input: {
    flex: 1, minHeight: 42, maxHeight: 120,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 21, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: colors.textPrimary,
  },
  sendBtn:         { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', flexShrink: 0 },
  sendBtnDisabled: { opacity: 0.4 },
  sendGradient:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sendIcon:        { fontSize: 20, color: '#fff', fontWeight: '700' },
  replayBtn:       { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  micBtn:          { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  micBtnActive:    { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  micIcon:         { fontSize: 20 },
});

export default ChatScreen;
