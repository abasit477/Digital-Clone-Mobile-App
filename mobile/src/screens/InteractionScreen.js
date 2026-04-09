/**
 * InteractionScreen — animated face avatar, app light theme.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Easing,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { Audio }          from 'expo-av';
import * as FileSystem    from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth }      from '../store/authStore';
import { voiceService } from '../services/voiceService';
import authService      from '../services/authService';
import { colors }       from '../theme/colors';
import { typography }   from '../theme/typography';
import { spacing, radius, shadows } from '../theme/spacing';

// ─── Constants ────────────────────────────────────────────────────────────────
const S = {
  IDLE:      'idle',
  LISTENING: 'listening',
  THINKING:  'thinking',
  SPEAKING:  'speaking',
};

const STATE_GRAD = {
  [S.IDLE]:      [colors.gradientStart, colors.gradientEnd],
  [S.LISTENING]: ['#22C55E', '#16A34A'],
  [S.THINKING]:  ['#F59E0B', '#D97706'],
  [S.SPEAKING]:  [colors.gradientStart, colors.gradientEnd],
};

const STATE_GLOW = {
  [S.IDLE]:      'rgba(168,85,247,0.18)',
  [S.LISTENING]: 'rgba(34,197,94,0.2)',
  [S.THINKING]:  'rgba(245,158,11,0.2)',
  [S.SPEAKING]:  'rgba(99,102,241,0.2)',
};

const STATE_LABEL = {
  [S.IDLE]:      'Ready to listen',
  [S.LISTENING]: 'Listening…',
  [S.THINKING]:  'Thinking…',
  [S.SPEAKING]:  'Speaking…',
};

const DOMAIN_META = {
  family:       { label: 'Family',       icon: '🏠' },
  professional: { label: 'Professional', icon: '💼' },
  general:      { label: 'General',      icon: '💬' },
  mentorship:   { label: 'Mentorship',   icon: '🎓' },
};

// ─── Face Avatar ──────────────────────────────────────────────────────────────
const FaceAvatar = ({ state }) => {
  const eyeScaleY   = useRef(new Animated.Value(1)).current;
  const mouthOpen   = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.6)).current;
  const glowScale   = useRef(new Animated.Value(1)).current;
  const faceScale   = useRef(new Animated.Value(1)).current;
  const blinkRef    = useRef(null);

  // Random blink
  useEffect(() => {
    const schedule = () => {
      blinkRef.current = setTimeout(() => {
        Animated.sequence([
          Animated.timing(eyeScaleY, { toValue: 0.07, duration: 65, useNativeDriver: true }),
          Animated.timing(eyeScaleY, { toValue: 1,    duration: 65, useNativeDriver: true }),
        ]).start(() => schedule());
      }, 2500 + Math.random() * 2500);
    };
    schedule();
    return () => clearTimeout(blinkRef.current);
  }, []);

  // State expressions
  useEffect(() => {
    mouthOpen.stopAnimation();
    glowScale.stopAnimation();
    faceScale.stopAnimation();

    if (state === S.LISTENING) {
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(mouthOpen,   { toValue: 0.35, duration: 280, useNativeDriver: true }),
        Animated.loop(Animated.sequence([
          Animated.timing(glowScale, { toValue: 1.18, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 1.04, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])),
        Animated.loop(Animated.sequence([
          Animated.timing(faceScale, { toValue: 1.025, duration: 550, useNativeDriver: true }),
          Animated.timing(faceScale, { toValue: 0.975, duration: 550, useNativeDriver: true }),
        ])),
      ]).start();

    } else if (state === S.THINKING) {
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.7, duration: 350, useNativeDriver: true }),
        Animated.timing(glowScale,   { toValue: 1.06, duration: 300, useNativeDriver: true }),
        Animated.timing(mouthOpen,   { toValue: 0,    duration: 220, useNativeDriver: true }),
        Animated.loop(Animated.sequence([
          Animated.timing(faceScale, { toValue: 1.012, duration: 1000, useNativeDriver: true }),
          Animated.timing(faceScale, { toValue: 0.988, duration: 1000, useNativeDriver: true }),
        ])),
      ]).start();

    } else if (state === S.SPEAKING) {
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.9, duration: 300, useNativeDriver: true }),
        Animated.timing(glowScale,   { toValue: 1.1,  duration: 300, useNativeDriver: true }),
        Animated.loop(Animated.sequence([
          Animated.timing(mouthOpen, { toValue: 1,    duration: 130, useNativeDriver: true }),
          Animated.timing(mouthOpen, { toValue: 0.18, duration: 130, useNativeDriver: true }),
          Animated.timing(mouthOpen, { toValue: 0.75, duration: 100, useNativeDriver: true }),
          Animated.timing(mouthOpen, { toValue: 0.1,  duration: 140, useNativeDriver: true }),
          Animated.timing(mouthOpen, { toValue: 0.85, duration: 110, useNativeDriver: true }),
          Animated.timing(mouthOpen, { toValue: 0.05, duration: 160, useNativeDriver: true }),
          Animated.timing(mouthOpen, { toValue: 0.6,  duration: 120, useNativeDriver: true }),
          Animated.timing(mouthOpen, { toValue: 0.08, duration: 130, useNativeDriver: true }),
        ])),
        Animated.loop(Animated.sequence([
          Animated.timing(faceScale, { toValue: 1.018, duration: 380, useNativeDriver: true }),
          Animated.timing(faceScale, { toValue: 0.982, duration: 380, useNativeDriver: true }),
        ])),
      ]).start();

    } else {
      // IDLE — subtle breathing
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.55, duration: 500, useNativeDriver: true }),
        Animated.timing(glowScale,   { toValue: 1,    duration: 400, useNativeDriver: true }),
        Animated.timing(mouthOpen,   { toValue: 0,    duration: 400, useNativeDriver: true }),
        Animated.loop(Animated.sequence([
          Animated.timing(faceScale, { toValue: 1.01, duration: 2300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(faceScale, { toValue: 0.99, duration: 2300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])),
      ]).start();
    }

    return () => {
      mouthOpen.stopAnimation();
      glowScale.stopAnimation();
      faceScale.stopAnimation();
      glowOpacity.stopAnimation();
    };
  }, [state]);

  const grad = STATE_GRAD[state];
  const glowColor = STATE_GLOW[state];

  const smileOpacity = mouthOpen.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 0.2, 0] });
  const openOpacity  = mouthOpen.interpolate({ inputRange: [0, 0.3,  1], outputRange: [0, 0.7, 1] });
  const openScaleY   = mouthOpen.interpolate({ inputRange: [0, 1],       outputRange: [0.12, 1]   });

  return (
    <View style={faceStyles.wrapper}>
      {/* Soft glow behind face */}
      <Animated.View style={[
        faceStyles.glow,
        { opacity: glowOpacity, transform: [{ scale: glowScale }], backgroundColor: glowColor },
      ]} />

      {/* Face */}
      <Animated.View style={{ transform: [{ scale: faceScale }] }}>
        <LinearGradient colors={grad} style={faceStyles.face}>

          {/* Eyes */}
          <View style={faceStyles.eyeRow}>
            <View style={faceStyles.eyeWrap}>
              <Animated.View style={[faceStyles.eyeWhite, { transform: [{ scaleY: eyeScaleY }] }]} />
              <View style={faceStyles.pupil} />
            </View>
            <View style={faceStyles.eyeWrap}>
              <Animated.View style={[faceStyles.eyeWhite, { transform: [{ scaleY: eyeScaleY }] }]} />
              <View style={faceStyles.pupil} />
            </View>
          </View>

          {/* Mouth */}
          <View style={faceStyles.mouthArea}>
            {/* Smile — white arc using bottom border radius */}
            <Animated.View style={[faceStyles.smile, { opacity: smileOpacity }]} />
            {/* Open oval for speaking/listening */}
            <Animated.View style={[
              faceStyles.openMouth,
              { opacity: openOpacity, transform: [{ scaleY: openScaleY }] },
            ]} />
          </View>

        </LinearGradient>
      </Animated.View>

      {/* State badge */}
      <View style={[faceStyles.badge, { backgroundColor: grad[0] + '18' }]}>
        <View style={[faceStyles.badgeDot, { backgroundColor: grad[0] }]} />
        <Text style={[faceStyles.badgeText, { color: grad[0] }]}>{STATE_LABEL[state]}</Text>
      </View>
    </View>
  );
};

const faceStyles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  glow: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    top: -18,
  },
  face: {
    width: 172,
    height: 172,
    borderRadius: 86,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.gradientEnd,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  eyeRow: {
    flexDirection: 'row',
    marginBottom: 16,
    marginTop: -6,
  },
  eyeWrap: {
    width: 30,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 13,
  },
  eyeWhite: {
    width: 30,
    height: 22,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.95)',
    position: 'absolute',
  },
  pupil: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(30,20,60,0.85)',
    position: 'absolute',
  },
  mouthArea: {
    width: 56,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Smile: a wide rectangle with only bottom corners rounded heavily
  // creates a clear upward curve (U-shape = smile)
  smile: {
    position: 'absolute',
    width: 46,
    height: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomWidth: 3.5,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'transparent',
  },
  openMouth: {
    position: 'absolute',
    width: 42,
    height: 26,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.93)',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[4],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.full,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────
const Bubble = ({ role, text }) => {
  const isUser = role === 'user';
  return (
    <View style={[bubbleStyles.row, isUser && bubbleStyles.rowUser]}>
      {!isUser && (
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={bubbleStyles.avatar}
        >
          <Text style={bubbleStyles.avatarText}>A</Text>
        </LinearGradient>
      )}
      <View style={[bubbleStyles.bubble, isUser ? bubbleStyles.userBubble : bubbleStyles.cloneBubble]}>
        <Text style={[bubbleStyles.text, isUser && bubbleStyles.userText]}>{text}</Text>
      </View>
    </View>
  );
};

const bubbleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing[2],
    paddingHorizontal: spacing[4],
  },
  rowUser: { justifyContent: 'flex-end' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[2],
    marginBottom: 2,
    flexShrink: 0,
  },
  avatarText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  bubble: {
    maxWidth: '74%',
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
  },
  cloneBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
    ...shadows.sm,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  text: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  userText: { color: colors.white },
});

// ─── Mic Button ───────────────────────────────────────────────────────────────
const MicButton = ({ recording, connected, onPressIn, onPressOut }) => {
  const ripple   = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (recording) {
      Animated.loop(Animated.sequence([
        Animated.timing(ripple, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(ripple, { toValue: 0, duration: 0,   useNativeDriver: true }),
      ])).start();
    } else {
      ripple.stopAnimation();
      ripple.setValue(0);
    }
  }, [recording]);

  const rippleScale   = ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.95] });
  const rippleOpacity = ripple.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.4, 0.1, 0] });

  const handlePressIn = () => {
    Animated.spring(btnScale, { toValue: 0.93, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
    onPressIn();
  };
  const handlePressOut = () => {
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
    onPressOut();
  };

  const rippleColor = recording ? '#22C55E' : colors.gradientStart;

  return (
    <View style={micStyles.wrapper}>
      <Animated.View style={[
        micStyles.ripple,
        { opacity: rippleOpacity, transform: [{ scale: rippleScale }], backgroundColor: rippleColor },
      ]} />
      <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1} disabled={!connected}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <LinearGradient
            colors={recording ? ['#22C55E', '#16A34A'] : [colors.gradientStart, colors.gradientEnd]}
            style={[micStyles.btn, !connected && micStyles.btnDisabled]}
          >
            <Text style={micStyles.icon}>{recording ? '⏹' : '🎤'}</Text>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const micStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  ripple: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  btn: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.gradientEnd,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  btnDisabled: { opacity: 0.45 },
  icon: { fontSize: 32 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
const InteractionScreen = ({ route, navigation }) => {
  const { clone } = route.params;

  const [avatarState, setAvatarState] = useState(S.IDLE);
  const [messages,    setMessages]    = useState([]);
  const [domain,      setDomain]      = useState('general');
  const [connected,   setConnected]   = useState(false);
  const [statusText,  setStatusText]  = useState('Connecting…');
  const [isRecording, setIsRecording] = useState(false);

  const sessionRef        = useRef(null);
  const recordingRef      = useRef(null);
  const soundRef          = useRef(null);
  const scrollRef         = useRef(null);
  const audioQueue        = useRef([]);
  const recordingStartRef = useRef(null);
  const segmentQueue      = useRef([]);
  const isPlayingSegment  = useRef(false);
  const turnDoneRef       = useRef(false);

  const domains = clone?.domains?.split(',').map((d) => d.trim()).filter(Boolean) ?? ['general'];

  // ── Connect ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        const { data: session } = await authService.getSession();
        const token = session?.getIdToken?.()?.getJwtToken?.() ?? '';

        const sess = voiceService.createSession(token, {
          onReady: () => {
            if (!mounted) return;
            setConnected(true);
            setStatusText('Ready');
          },
          onTranscript: (text) => {
            if (!mounted) return;
            setMessages((m) => [...m, { role: 'user', text }]);
            setAvatarState(S.THINKING);
            setStatusText('Thinking…');
          },
          onResponseText: (text) => {
            if (!mounted) return;
            setMessages((m) => [...m, { role: 'clone', text }]);
          },
          onAudioChunk: (chunk) => { audioQueue.current.push(chunk); },
          onAudioSegmentDone: (chunks) => {
            if (!mounted) return;
            setAvatarState(S.SPEAKING);
            setStatusText('Speaking…');
            segmentQueue.current.push(chunks.join(''));
            if (!isPlayingSegment.current) playNextSegment();
          },
          onTurnDone: () => {
            turnDoneRef.current = true;
            if (!isPlayingSegment.current && mounted) {
              turnDoneRef.current = false;
              setAvatarState(S.IDLE);
              setStatusText('Ready');
            }
          },
          onError: (msg) => {
            if (!mounted) return;
            setStatusText('Error — try again');
            setAvatarState(S.IDLE);
            console.warn('[VoiceSession] error:', msg);
          },
          onClose: () => {
            if (!mounted) return;
            setConnected(false);
            setStatusText('Disconnected');
          },
        });

        sessionRef.current = sess;
        await sess.connect();
        sess.init(clone.id, domain);
      } catch (e) {
        if (!mounted) return;
        setStatusText('Connection failed');
        console.warn('[InteractionScreen] connect error:', e);
      }
    };

    connect();
    return () => {
      mounted = false;
      sessionRef.current?.disconnect();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [clone.id, domain]);

  const handleDomainChange = useCallback((d) => {
    setDomain(d);
    setMessages([]);
    sessionRef.current?.init(clone.id, d);
  }, [clone.id]);

  // ── Playback ───────────────────────────────────────────────────────────────
  // Segment queue player — plays audio segments back-to-back as they arrive.
  // Each segment is one synthesized sentence; we start playing segment 1 while
  // segments 2, 3, … are still being generated on the backend.
  const playNextSegment = useCallback(async () => {
    if (segmentQueue.current.length === 0) {
      isPlayingSegment.current = false;
      if (turnDoneRef.current) {
        turnDoneRef.current = false;
        setAvatarState(S.IDLE);
        setStatusText('Ready');
      }
      return;
    }
    isPlayingSegment.current = true;
    const combined = segmentQueue.current.shift();
    try {
      const uri = FileSystem.cacheDirectory + `seg_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(uri, combined, { encoding: 'base64' });
      if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      await sound.playAsync();
      await new Promise((resolve) => {
        sound.setOnPlaybackStatusUpdate((s) => { if (s.didJustFinish) resolve(); });
      });
    } catch (e) { console.warn('[playSegment] error:', e); }
    playNextSegment();
  }, []);

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!connected || isRecording) return;
    setIsRecording(true);
    setAvatarState(S.LISTENING);
    setStatusText('Listening…');
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync({
        isMeteringEnabled: false,
        android: { extension: '.mp4', outputFormat: 2, audioEncoder: 3, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        ios:     { extension: '.wav', outputFormat: 'lpcm', audioQuality: 127, sampleRate: 16000, numberOfChannels: 1, bitRate: 256000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web:     { mimeType: 'audio/webm', bitsPerSecond: 128000 },
      });
      recordingRef.current = recording;
      recordingStartRef.current = Date.now();
    } catch (e) {
      setIsRecording(false);
      setAvatarState(S.IDLE);
      setStatusText('Ready');
      console.warn('[startRecording] error:', e.message ?? e);
    }
  }, [connected, isRecording]);

  const stopRecording = useCallback(async () => {
    if (!isRecording || !recordingRef.current) return;
    setIsRecording(false);
    setAvatarState(S.THINKING);
    setStatusText('Processing…');
    try {
      const duration = Date.now() - (recordingStartRef.current ?? 0);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (duration < 700) {
        setAvatarState(S.IDLE);
        setStatusText('Hold longer to speak');
        setTimeout(() => setStatusText('Ready'), 2000);
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const format = uri.endsWith('.wav') ? 'wav' : 'mp4';
      sessionRef.current?.sendAudio(base64);
      sessionRef.current?.endSpeech(format);
    } catch (e) {
      console.warn('[stopRecording] error:', e);
      setAvatarState(S.IDLE);
      setStatusText('Ready');
    }
  }, [isRecording]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>{clone.name}</Text>
          {clone.title ? <Text style={styles.headerSub}>{clone.title}</Text> : null}
        </View>
        <View style={[styles.liveChip, connected && styles.liveChipOn]}>
          <View style={[styles.liveDot, connected && styles.liveDotOn]} />
          <Text style={[styles.liveText, connected && styles.liveTextOn]}>
            {connected ? 'Live' : 'Off'}
          </Text>
        </View>
      </View>

      {/* Domain tabs */}
      {domains.length > 1 && (
        <View style={styles.domainRow}>
          {domains.map((d) => {
            const meta   = DOMAIN_META[d] ?? { label: d, icon: '💬' };
            const active = domain === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => handleDomainChange(d)}
                activeOpacity={0.75}
                style={[styles.domainChip, active && styles.domainChipActive]}
              >
                {active ? (
                  <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.domainChipInner}>
                    <Text style={styles.domainIcon}>{meta.icon}</Text>
                    <Text style={[styles.domainLabel, styles.domainLabelActive]}>{meta.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.domainChipInner}>
                    <Text style={styles.domainIcon}>{meta.icon}</Text>
                    <Text style={styles.domainLabel}>{meta.label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <FaceAvatar state={avatarState} />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Transcript */}
      <ScrollView
        ref={scrollRef}
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <Text style={styles.emptyHint}>Hold the mic button and start speaking</Text>
        ) : (
          messages.map((msg, i) => <Bubble key={i} role={msg.role} text={msg.text} />)
        )}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        <Text style={styles.statusText}>{statusText}</Text>
        <MicButton
          recording={isRecording}
          connected={connected}
          onPressIn={startRecording}
          onPressOut={stopRecording}
        />
        <Text style={styles.hint}>
          {connected ? (isRecording ? 'Release to send' : 'Hold to speak') : 'Connecting…'}
        </Text>
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.indigo50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon:    { fontSize: 18, color: colors.primary },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerName:  { ...typography.headingSmall, color: colors.textPrimary },
  headerSub:   { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveChipOn:  { backgroundColor: colors.successLight, borderColor: '#BBF7D0' },
  liveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted, marginRight: 4 },
  liveDotOn:   { backgroundColor: colors.success },
  liveText:    { ...typography.caption, fontWeight: '600', color: colors.textMuted },
  liveTextOn:  { color: colors.success },

  // Domain row
  domainRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing[2],
  },
  domainChip: {
    borderRadius: radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  domainChipActive: { borderColor: 'transparent' },
  domainChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    backgroundColor: colors.surfaceSecondary,
  },
  domainIcon:        { fontSize: 14, marginRight: 5 },
  domainLabel:       { ...typography.label, color: colors.textSecondary },
  domainLabelActive: { color: colors.white },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    backgroundColor: colors.background,
  },

  // Divider
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing[5] },

  // Transcript
  transcript: { flex: 1, backgroundColor: colors.background },
  transcriptContent: {
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
  },

  // Controls
  controls: {
    alignItems: 'center',
    paddingBottom: spacing[8],
    paddingTop: spacing[4],
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.sm,
  },
  statusText: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing[4],
    letterSpacing: 0.2,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[3],
  },
});

export default InteractionScreen;
