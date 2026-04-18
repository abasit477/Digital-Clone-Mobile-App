/**
 * FaceChatScreen
 * Clone of ChatScreen with face-avatar support.
 * Identical chat flow (text + voice), but:
 *  - Header shows the user's face avatar (or a placeholder when not yet set up)
 *  - Setup banner prompts face scanning when no avatar is configured
 *  - Voice messages will surface a video_url from SadTalker once wired up
 *  - Video responses render inline when present
 *
 * Current state: fully functional chat — SadTalker video generation plugs in
 * without changing any of this screen's structure.
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
  Modal,
  Image,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../store/authStore';
import { colors } from '../theme/colors';
import { storageKey, KEYS } from '../utils/userStorage';
import chatService from '../services/chatService';

const FaceChatScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [messages, setMessages]       = useState([]);
  const [inputText, setInputText]     = useState('');
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [cloneName, setCloneName]     = useState('Family Clone');
  const [isRecording, setIsRecording] = useState(false);
  const [avatarUrl, setAvatarUrl]     = useState(null);   // face photo URL (null = not set up)
  const [videoModal, setVideoModal]   = useState(null);   // video URL to play in modal

  const flatListRef    = useRef(null);
  const recordingRef   = useRef(null);
  const recordStartTs  = useRef(null);
  const videoRef       = useRef(null);
  const pollTimers     = useRef({});   // jobId → intervalId

  // ── Video polling ─────────────────────────────────────────────────────────

  const startPolling = useCallback((jobId, messageId) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 200; // 10 min at 3s intervals
    const timer = setInterval(async () => {
      attempts++;
      const { data } = await chatService.pollVideoStatus(jobId);
      if (!data) return;
      if (data.status === 'done' && data.video_url) {
        clearInterval(timer);
        delete pollTimers.current[jobId];
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, video_url: data.video_url, video_generating: false } : m
        ));
      } else if (data.status === 'failed' || attempts >= MAX_ATTEMPTS) {
        clearInterval(timer);
        delete pollTimers.current[jobId];
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, video_generating: false } : m
        ));
      }
    }, 3000);
    pollTimers.current[jobId] = timer;
  }, []);

  // Clean up polling on unmount
  useEffect(() => {
    return () => Object.values(pollTimers.current).forEach(clearInterval);
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      // Load face avatar URL from local cache
      const saved = await AsyncStorage.getItem(storageKey(user?.username, KEYS.faceAvatarUrl));
      if (saved) setAvatarUrl(saved);

      // Load chat history
      try {
        const { data, error } = await chatService.getHistory();
        if (error) throw new Error(error.message);

        if (data.clone_name) setCloneName(data.clone_name);

        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map(m => ({
            id: m.id, role: m.role, content: m.content, video_url: m.video_url ?? null,
          })));
          setLoading(false);
        } else {
          setLoading(false);
          triggerOpeningMessage();
        }
      } catch (err) {
        console.error('[FaceChatScreen] init error:', err?.message);
        setLoading(false);
        triggerOpeningMessage();
      }
    };
    init();
  }, []);

  // ── Opening message ───────────────────────────────────────────────────────

  const triggerOpeningMessage = async () => {
    const placeholderId = 'opening-placeholder';
    setMessages([{ id: placeholderId, role: 'assistant', content: '', video_url: null }]);
    setSending(true);

    try {
      const { data, error } = await chatService.sendMessage('', true);
      if (error) throw new Error(error.message);
      setMessages([{ id: data.id, role: 'assistant', content: data.content, video_url: null }]);
    } catch (err) {
      console.error('[FaceChatScreen] opening message error:', err?.message);
      setMessages([{
        id: placeholderId, role: 'assistant',
        content: 'Hello! Great to hear from you. How are you doing?',
        video_url: null,
      }]);
    } finally {
      setSending(false);
    }
  };

  // ── Text send ─────────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  const send = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');

    const userMsg      = { id: `u-${Date.now()}`, role: 'user',      content: text, video_url: null };
    const placeholderId = `a-${Date.now()}`;
    const placeholder   = { id: placeholderId,   role: 'assistant', content: '',   video_url: null };

    setMessages(prev => [...prev, userMsg, placeholder]);
    setSending(true);

    try {
      const { data, error } = await chatService.sendMessage(text);
      if (error) throw new Error(error.message);

      setMessages(prev =>
        prev.map(m => m.id === placeholderId
          ? { id: data.id, role: 'assistant', content: data.content, video_url: null }
          : m
        )
      );
    } catch (err) {
      console.error('[FaceChatScreen] send error:', err?.message);
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

    if (duration < 700) return;

    const uri    = recording.getURI();
    const format = uri.endsWith('.wav') ? 'wav' : 'mp4';
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

    const placeholderUserMsg = { id: `uv-${Date.now()}`, role: 'user',      content: '🎤 …',  video_url: null };
    const placeholderAsstId  = `av-${Date.now()}`;
    const placeholderAsst    = { id: placeholderAsstId,  role: 'assistant', content: '',      video_url: null };
    setMessages(prev => [...prev, placeholderUserMsg, placeholderAsst]);
    setSending(true);

    try {
      const { data, error } = await chatService.sendVoiceMessage(base64, format);
      if (error) throw new Error(error.message ?? 'Voice message failed');

      const isGenerating = !!data.video_job_id && !data.video_url;
      setMessages(prev => prev.map(m => {
        if (m.id === placeholderUserMsg.id)
          return { ...m, content: `🎤 ${data.transcript}` };
        if (m.id === placeholderAsstId)
          return {
            id: data.id,
            role: 'assistant',
            content: data.content,
            video_url: data.video_url ?? null,
            video_generating: isGenerating,
          };
        return m;
      }));

      // Start polling if video is being generated in the background
      if (isGenerating) startPolling(data.video_job_id, data.id);

    } catch (err) {
      console.error('[FaceChatScreen] voice send error:', err?.message);
      setMessages(prev => prev.map(m =>
        m.id === placeholderAsstId
          ? { ...m, content: `Error: ${err?.message ?? 'Something went wrong'}` }
          : m
      ));
    } finally {
      setSending(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
        {!isUser && (
          <View style={styles.avatarBubble}>
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              : <Text style={styles.avatarText}>🎭</Text>
            }
          </View>
        )}
        <View style={styles.bubbleCol}>
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
            {item.content === '' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : isUser ? (
              <Text style={styles.bubbleTextUser}>{item.content}</Text>
            ) : (
              <Text style={styles.bubbleTextAssistant}>{item.content}</Text>
            )}
          </View>
          {/* Video response button — shown when SadTalker video is ready */}
          {!isUser && item.video_url && (
            <TouchableOpacity
              style={styles.watchBtn}
              onPress={() => setVideoModal(item.video_url)}
              activeOpacity={0.8}
            >
              <Text style={styles.watchBtnText}>▶  Watch Response</Text>
            </TouchableOpacity>
          )}
          {/* Generating indicator — shown while SadTalker is running in background */}
          {!isUser && item.video_generating && !item.video_url && (
            <View style={styles.generatingRow}>
              <ActivityIndicator size="small" color="#7C3AED" />
              <Text style={styles.generatingText}>Generating face video…</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSetupBanner = () => (
    <TouchableOpacity
      style={styles.setupBanner}
      onPress={() => navigation.navigate('FaceScan')}
      activeOpacity={0.85}
    >
      <Text style={styles.setupBannerIcon}>🎭</Text>
      <View style={styles.setupBannerText}>
        <Text style={styles.setupBannerTitle}>Set up your face avatar</Text>
        <Text style={styles.setupBannerSub}>Scan your face so your clone can speak as you</Text>
      </View>
      <Text style={styles.setupBannerArrow}>›</Text>
    </TouchableOpacity>
  );

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
      <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.header}>
        <View style={styles.headerAvatar}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={styles.headerAvatarImage} />
            : <Text style={styles.headerAvatarEmoji}>🎭</Text>
          }
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>{cloneName}</Text>
          <View style={styles.headerStatusRow}>
            <View style={[styles.headerStatusDot, !avatarUrl && styles.headerStatusDotWarning]} />
            <Text style={styles.headerSub}>{avatarUrl ? 'Face avatar active' : 'Face avatar not set up'}</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {/* Setup banner — shown until face avatar is configured */}
      {!avatarUrl && renderSetupBanner()}

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
            <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.sendGradient}>
              <Text style={styles.sendIcon}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Video modal — plays SadTalker response video full-screen */}
      <Modal visible={!!videoModal} animationType="fade" statusBarTranslucent>
        <View style={styles.videoModalBg}>
          {videoModal && (
            <Video
              ref={videoRef}
              source={{ uri: videoModal }}
              style={styles.videoPlayer}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              onPlaybackStatusUpdate={status => {
                if (status.didJustFinish) setVideoModal(null);
              }}
            />
          )}
          <TouchableOpacity style={styles.videoClose} onPress={() => setVideoModal(null)}>
            <Text style={styles.videoCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  headerAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarEmoji: { fontSize: 20 },
  headerCenter:     { flex: 1 },
  headerName:       { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerStatusRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  headerStatusDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  headerStatusDotWarning: { backgroundColor: '#FBBF24' },
  headerSub:        { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  // Setup banner
  setupBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderBottomWidth: 1, borderBottomColor: '#DDD6FE',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  setupBannerIcon:  { fontSize: 28 },
  setupBannerText:  { flex: 1 },
  setupBannerTitle: { fontSize: 14, fontWeight: '600', color: '#5B21B6' },
  setupBannerSub:   { fontSize: 12, color: '#7C3AED', marginTop: 2 },
  setupBannerArrow: { fontSize: 22, color: '#7C3AED', fontWeight: '300' },

  // Messages
  messageList:        { padding: 16, paddingBottom: 8 },
  bubbleRow:          { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  bubbleRowUser:      { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  avatarBubble: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.indigo100,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, flexShrink: 0, overflow: 'hidden',
  },
  avatarImage: { width: 32, height: 32, borderRadius: 16 },
  avatarText:  { fontSize: 16 },
  bubbleCol:   { flexShrink: 1, maxWidth: '75%' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
    minHeight: 38, justifyContent: 'center',
  },
  bubbleUser: {
    backgroundColor: '#7C3AED',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  bubbleTextUser:      { fontSize: 15, color: '#fff', lineHeight: 21 },
  bubbleTextAssistant: { fontSize: 15, color: colors.textPrimary, lineHeight: 21 },

  // Generating indicator
  generatingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 6, paddingHorizontal: 4,
  },
  generatingText: { fontSize: 12, color: '#7C3AED', fontStyle: 'italic' },

  // Watch response button
  watchBtn: {
    marginTop: 6, alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#C4B5FD',
  },
  watchBtnText: { fontSize: 13, color: '#5B21B6', fontWeight: '600' },

  // Input
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
  micBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  micBtnActive: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  micIcon:      { fontSize: 20 },

  // Video modal
  videoModalBg:  { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  videoPlayer:   { width: '100%', height: '100%' },
  videoClose: {
    position: 'absolute', top: 52, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});

export default FaceChatScreen;
