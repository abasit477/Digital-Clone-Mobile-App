/**
 * ChatScreen
 * Text chat with the family clone.
 * Loads assessment answers from AsyncStorage, builds a system prompt,
 * and calls AWS Bedrock via bedrockService.
 *
 * On first open (no saved history) the clone automatically sends a personalised
 * opening message. Subsequent opens restore the saved conversation.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../store/authStore';
import { storageKey, KEYS } from '../utils/userStorage';
import { colors } from '../theme/colors';
import { streamCloneResponse } from '../services/bedrockService';

// ── Label maps (mirrors QUESTION_BANK options) ────────────────────────────────

const AGE_LABELS = {
  toddler:     'under 5',
  child:       '5–10 years old',
  teen:        '11–17 years old',
  young_adult: '18–25 years old',
  adult:       '26 or older',
};

const REL_LABELS = {
  very_close: 'very close',
  warm:       'warm and loving',
  distant:    'close but could communicate more',
  working:    'working on building a stronger bond',
  complex:    'complex — different with each child',
};

const LIVING_LABELS = {
  together:     'lives with family',
  same_city:    'same city as family',
  diff_city:    'different city from family',
  diff_country: 'different country from family',
};

const FREQ_LABELS = {
  weekly:   'multiple times a week',
  monthly:  'a few times a month',
  few_year: 'a few times a year',
  rarely:   'rarely',
};

const EDU_LABELS = {
  high_school: 'high school',
  vocational:  'vocational/trade qualification',
  university:  'university degree',
  postgrad:    'postgraduate degree',
};

const WORK_LABELS = {
  technology: 'technology/engineering',
  healthcare: 'healthcare/medicine',
  business:   'business/finance',
  education:  'education/teaching',
  trades:     'trades/manual work',
  arts:       'arts/creative/media',
  other:      'other field',
};

// ── Member System Prompt ──────────────────────────────────────────────────────

const BOND_LABELS    = { very_close: 'very close', warm: 'warm and loving', distant: 'distant but caring', building: 'still building' };
const CONTACT_LABELS = { daily: 'every day', frequent: 'a few times a week', weekly: 'about once a week', less: 'less often than they would like' };
const TOPIC_LABELS   = { advice: 'life advice and guidance', checkins: 'everyday check-ins', memories: 'shared memories', anything: 'staying connected' };

function buildMemberSystemPrompt(familyInfo, memberAnswers) {
  const creatorName  = familyInfo.creator_name || familyInfo.creator_email?.split('@')[0] || 'the family member';
  const memberName   = memberAnswers?.m_nickname || 'them';
  const relationship = familyInfo.relationship  || 'family member';

  const lines = [
    memberAnswers?.m_bond    && `- Their bond with you: ${BOND_LABELS[memberAnswers.m_bond]    ?? memberAnswers.m_bond}`,
    memberAnswers?.m_contact && `- How often they are in touch: ${CONTACT_LABELS[memberAnswers.m_contact] ?? memberAnswers.m_contact}`,
    memberAnswers?.m_topic   && `- What they most want to talk about: ${TOPIC_LABELS[memberAnswers.m_topic] ?? memberAnswers.m_topic}`,
  ].filter(Boolean);

  return [
    `You are an AI clone of ${creatorName}. You are speaking with ${memberName}, who is your ${relationship}.`,
    lines.length > 0 ? `Here is some context about ${memberName}:` : '',
    ...lines,
    '',
    'Guidelines:',
    `- Address them as ${memberName} when natural.`,
    `- Be warm and personal, as ${creatorName} speaking to their ${relationship}.`,
    '- Keep responses under 3 sentences unless asked for more detail.',
    '- When starting a fresh conversation, open with a warm personalised greeting.',
    '- Never break character or refer to yourself as an AI.',
  ].filter(l => l !== null).join('\n');
}

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(answers) {
  const lines = [];
  const cc = answers.q_children_count;

  if (!cc || cc === 'zero') {
    lines.push('- Children: no children');
  } else {
    const n1 = answers.q_child1_name || 'first child';
    lines.push(`- First child: ${n1}, ${AGE_LABELS[answers.q_child1_age] ?? answers.q_child1_age ?? ''}`);

    if (cc === 'two') {
      const n2 = answers.q_child2_name || 'second child';
      lines.push(`- Second child: ${n2}, ${AGE_LABELS[answers.q_child2_age] ?? answers.q_child2_age ?? ''}`);
    }

    if (cc === 'three_plus' && answers.q_other_children) {
      lines.push(`- Other children: ${answers.q_other_children}`);
    }

    const rel = answers.q_child1_relationship ?? answers.q_children_relationship;
    if (rel) lines.push(`- Relationship with children: ${REL_LABELS[rel] ?? rel}`);
  }

  if (answers.q_living_with) {
    lines.push(`- Living situation: ${LIVING_LABELS[answers.q_living_with] ?? answers.q_living_with}`);
  }
  if (answers.q_meeting_freq) {
    lines.push(`- Family time in person: ${FREQ_LABELS[answers.q_meeting_freq] ?? answers.q_meeting_freq}`);
  }
  if (answers.q_education) {
    lines.push(`- Education: ${EDU_LABELS[answers.q_education] ?? answers.q_education}`);
  }
  if (answers.q_work_field) {
    lines.push(`- Work: ${WORK_LABELS[answers.q_work_field] ?? answers.q_work_field}`);
  }

  return [
    "You are an AI clone of the user's father. Respond warmly and personally, as if you are him speaking directly to his child.",
    'Here is what he shared about himself and his family:',
    ...lines,
    '',
    'Guidelines:',
    '- Keep responses conversational and under 3 sentences unless asked for more detail.',
    '- Be warm, supportive, and use a fatherly tone.',
    '- Reference family members by name when relevant.',
    '- When starting a fresh conversation, open with a warm, personal greeting that references something specific from the family context above.',
    '- Never break character or refer to yourself as an AI.',
  ].join('\n');
}

// ── Component ─────────────────────────────────────────────────────────────────

const ChatScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [messages, setMessages]     = useState([]);
  const [inputText, setInputText]   = useState('');
  const [isStreaming, setStreaming]  = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [loading, setLoading]       = useState(true);
  const [cloneName, setCloneName]   = useState('Family Clone');

  const flatListRef      = useRef(null);
  const streamingTextRef = useRef('');
  const historyKeyRef    = useRef(KEYS.chatHistory);

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        const [fiRaw, answersRaw, mAnswersRaw] = await Promise.all([
          AsyncStorage.getItem(storageKey(user?.username, KEYS.memberFamilyInfo)),
          AsyncStorage.getItem(storageKey(user?.username, KEYS.assessmentAnswers)),
          AsyncStorage.getItem(storageKey(user?.username, KEYS.memberAnswers)),
        ]);

        const isMember = !!fiRaw;
        historyKeyRef.current = isMember ? KEYS.memberChatHistory : KEYS.chatHistory;

        const historyRaw = await AsyncStorage.getItem(storageKey(user?.username, historyKeyRef.current));

        let builtPrompt;
        if (isMember) {
          const familyInfo   = JSON.parse(fiRaw);
          const memberAnswers = mAnswersRaw ? JSON.parse(mAnswersRaw) : {};
          builtPrompt = buildMemberSystemPrompt(familyInfo, memberAnswers);
          const name = familyInfo.creator_name || familyInfo.creator_email?.split('@')[0] || 'Family';
          setCloneName(`${name}'s Clone`);
        } else {
          const answers = answersRaw ? JSON.parse(answersRaw) : {};
          builtPrompt = buildSystemPrompt(answers);
        }
        setSystemPrompt(builtPrompt);

        if (historyRaw) {
          setMessages(JSON.parse(historyRaw));
          setLoading(false);
        } else {
          // First open — clone initiates the conversation
          setLoading(false);
          triggerOpeningMessage(builtPrompt, user?.username);
        }
      } catch {
        const fallback = buildSystemPrompt({});
        setSystemPrompt(fallback);
        setLoading(false);
        triggerOpeningMessage(fallback, user?.username);
      }
    };
    init();
  }, []);

  // ── Opening message ─────────────────────────────────────────────────────────

  const triggerOpeningMessage = async (prompt, username) => {
    setStreaming(true);
    const assistantId  = Date.now().toString();
    const assistantMsg = { id: assistantId, role: 'assistant', content: '' };
    setMessages([assistantMsg]);
    streamingTextRef.current = '';

    try {
      await streamCloneResponse(
        prompt,
        [{ role: 'user', content: 'Please start our conversation.' }],
        (chunk) => {
          streamingTextRef.current += chunk;
          const accumulated = streamingTextRef.current;
          setMessages([{ ...assistantMsg, content: accumulated }]);
          flatListRef.current?.scrollToEnd({ animated: true });
        }
      );
      const finalMsg = { ...assistantMsg, content: streamingTextRef.current };
      setMessages([finalMsg]);
      AsyncStorage.setItem(
        storageKey(username, historyKeyRef.current),
        JSON.stringify([finalMsg])
      ).catch(() => {});
    } catch (err) {
      console.error('[ChatScreen] opening message error:', err?.message);
      setMessages([{ ...assistantMsg, content: 'Hello! Great to hear from you. How are you doing?' }]);
    } finally {
      setStreaming(false);
    }
  };

  // ── Send ────────────────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  const send = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    setInputText('');

    const userMsg      = { id: Date.now().toString(), role: 'user', content: text };
    const assistantId  = (Date.now() + 1).toString();
    const assistantMsg = { id: assistantId, role: 'assistant', content: '' };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);
    streamingTextRef.current = '';

    // Bedrock requires conversation to start with a user message.
    // The opening clone greeting is an assistant message — strip any leading assistant turns.
    const allMsgs = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
    const firstUserIdx = allMsgs.findIndex(m => m.role === 'user');
    const history = firstUserIdx > 0 ? allMsgs.slice(firstUserIdx) : allMsgs;

    try {
      await streamCloneResponse(systemPrompt, history, (chunk) => {
        streamingTextRef.current += chunk;
        const accumulated = streamingTextRef.current;
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m)
        );
        scrollToBottom();
      });

      setMessages(prev => {
        const finalMessages = prev.map(m =>
          m.id === assistantId ? { ...m, content: streamingTextRef.current } : m
        );
        AsyncStorage.setItem(
          storageKey(user?.username, historyKeyRef.current),
          JSON.stringify(finalMessages)
        ).catch(() => {});
        return finalMessages;
      });
    } catch (err) {
      console.error('[ChatScreen] send error:', err?.name, err?.message, err);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `Error: ${err?.message ?? 'Unknown error'}` }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          {isUser ? (
            <Text style={styles.bubbleTextUser}>{item.content}</Text>
          ) : item.content === '' ? (
            <ActivityIndicator size="small" color={colors.primary} />
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
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message…"
            placeholderTextColor={colors.inputPlaceholder}
            multiline
            maxLength={500}
            returnKeyType="default"
            editable={!isStreaming}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isStreaming) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!inputText.trim() || isStreaming}
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
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  cloneAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  cloneAvatarEmoji: {
    fontSize: 20,
  },
  headerCenter: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  headerStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.indigo100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 38,
    justifyContent: 'center',
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleTextUser: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 21,
  },
  bubbleTextAssistant: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
  },
});

export default ChatScreen;
