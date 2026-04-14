import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { spacing, radius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';
import familyService from '../services/familyService';

const RELATIONSHIPS = [
  { key: 'child',   label: 'Child' },
  { key: 'parent',  label: 'Parent' },
  { key: 'spouse',  label: 'Spouse' },
  { key: 'sibling', label: 'Sibling' },
];

const FamilyManagementScreen = ({ navigation }) => {
  const [family, setFamily]                     = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail]           = useState('');
  const [inviteRelationship, setInviteRelationship] = useState(null);
  const [inviting, setInviting]                 = useState(false);

  const loadFamily = useCallback(async () => {
    const { data } = await familyService.getMyFamily();
    setLoading(false);
    setFamily(data ?? null);
  }, []);

  useEffect(() => { loadFamily(); }, [loadFamily]);

  const closeModal = () => {
    setInviteModalVisible(false);
    setInviteEmail('');
    setInviteRelationship(null);
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Enter a valid email address.');
      return;
    }
    if (!inviteRelationship) {
      Alert.alert('Select Relationship', 'Please select your relationship with this person.');
      return;
    }
    setInviting(true);

    // Lazy family creation on first invite
    if (!family) {
      const { error: createErr } = await familyService.createFamily('My Family');
      if (createErr && createErr.status !== 409) {
        setInviting(false);
        Alert.alert('Error', createErr.message || 'Could not create family.');
        return;
      }
      await loadFamily();
    }

    const { data, error } = await familyService.inviteMember(email, inviteRelationship);
    setInviting(false);
    if (error) {
      Alert.alert('Invite Failed', error.message || 'Could not invite member.');
      return;
    }
    closeModal();
    Alert.alert(
      'Invite Sent',
      `An email has been sent to ${email} with invite code:\n\n${data.invite_code}`,
    );
    loadFamily();
  };

  const handleShareCode = async (member) => {
    try {
      await Share.share({
        message: `Join ${family?.name ?? 'our family'} on Digital Assistant!\n\nYour invite code: ${member.invite_code}`,
      });
    } catch (_) {}
  };

  const handleRemove = (member) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.email} from the family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } = await familyService.removeMember(member.id);
            if (error) {
              Alert.alert('Error', error.message || 'Could not remove member.');
              return;
            }
            loadFamily();
          },
        },
      ],
    );
  };

  const renderMember = ({ item }) => {
    const isCreator = item.role === 'creator';
    const joined    = !!item.accepted_at;

    return (
      <View style={styles.memberCard}>
        <View style={styles.memberInfo}>
          <View style={[styles.memberAvatar, isCreator && styles.memberAvatarCreator]}>
            <Text style={styles.memberAvatarText}>
              {(item.email[0] || '?').toUpperCase()}
            </Text>
          </View>
          <View style={styles.memberTextContainer}>
            <Text style={styles.memberEmail} numberOfLines={1}>{item.email}</Text>
            <View style={styles.memberStatusRow}>
              <View style={[styles.statusPill, joined ? styles.statusJoined : styles.statusPending]}>
                <Text style={[styles.statusPillText, joined ? styles.statusJoinedText : styles.statusPendingText]}>
                  {joined ? 'Joined' : 'Pending'}
                </Text>
              </View>
              {isCreator && (
                <View style={styles.creatorBadge}>
                  <Text style={styles.creatorBadgeText}>Creator</Text>
                </View>
              )}
              {item.relationship && !isCreator && (
                <View style={styles.relationshipBadge}>
                  <Text style={styles.relationshipBadgeText} numberOfLines={1}>
                    {item.relationship.charAt(0).toUpperCase() + item.relationship.slice(1)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {!isCreator && (
          <View style={styles.memberActions}>
            {!joined && (
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShareCode(item)}
              >
                <Text style={styles.shareButtonText}>Share Code</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemove(item)}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />

      {/* Nav bar */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.navBar}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navTitle}>{family ? family.name : 'Family'}</Text>
          {family && (
            <Text style={styles.navSubtitle}>
              {family.members.length} member{family.members.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.inviteBtn}
          onPress={() => setInviteModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.inviteBtnText}>+ Invite</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : family && family.members.length > 0 ? (
        <FlatList
          data={family.members}
          keyExtractor={(item) => item.id}
          renderItem={renderMember}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👨‍👩‍👧‍👦</Text>
          <Text style={styles.emptyTitle}>No members yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap "+ Invite" above to invite your family members
          </Text>
        </View>
      )}

      {/* Invite modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invite a Family Member</Text>
            <Text style={styles.modalSubtitle}>
              They'll receive an email with an 8-character code to join.
            </Text>

            {/* Relationship picker */}
            <Text style={styles.modalLabel}>Relationship</Text>
            <View style={styles.relationshipRow}>
              {RELATIONSHIPS.map(r => {
                const selected = inviteRelationship === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.relationshipPill, selected && styles.relationshipPillSelected]}
                    onPress={() => setInviteRelationship(r.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.relationshipPillText, selected && styles.relationshipPillTextSelected]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>Email address</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="family@example.com"
              placeholderTextColor={colors.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={closeModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSend}
                onPress={handleInvite}
                disabled={inviting}
              >
                {inviting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalSendText}>Send Invite</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Nav bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '600',
  },
  navCenter: {
    flex: 1,
  },
  navTitle: {
    fontSize: typography.lg ?? 18,
    fontWeight: '700',
    color: '#fff',
  },
  navSubtitle: {
    fontSize: typography.xs ?? 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  inviteBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  inviteBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.sm ?? 14,
  },

  // List
  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },
  memberCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.indigo100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
    flexShrink: 0,
  },
  memberAvatarCreator: {
    backgroundColor: colors.primary,
  },
  memberAvatarText: {
    fontSize: typography.md ?? 16,
    fontWeight: '700',
    color: colors.primary,
  },
  memberTextContainer: {
    flex: 1,
  },
  memberEmail: {
    fontSize: typography.sm ?? 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  memberStatusRow: {
    flexDirection: 'row',
    gap: spacing[1.5],
    marginTop: spacing[1],
    flexWrap: 'wrap',
  },
  statusPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusJoined:      { backgroundColor: '#dcfce7' },
  statusPending:     { backgroundColor: '#fef9c3' },
  statusPillText:    { fontSize: 11, fontWeight: '600' },
  statusJoinedText:  { color: '#16a34a' },
  statusPendingText: { color: '#ca8a04' },
  creatorBadge: {
    backgroundColor: colors.indigo100,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  creatorBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  relationshipBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  relationshipBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  memberActions: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    flexShrink: 0,
  },
  shareButton: {
    backgroundColor: colors.indigo100,
    borderRadius: radius.md,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
  },
  shareButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[10],
  },
  emptyEmoji:    { fontSize: 48, marginBottom: spacing[4] },
  emptyTitle: {
    fontSize: typography.lg ?? 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: typography.sm ?? 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    padding: spacing[7],
    width: '100%',
  },
  modalTitle: {
    fontSize: typography.lg ?? 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing[1.5],
  },
  modalSubtitle: {
    fontSize: typography.sm ?? 14,
    color: colors.textSecondary,
    marginBottom: spacing[5],
    lineHeight: 20,
  },
  modalLabel: {
    fontSize: typography.xs ?? 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  relationshipRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[5],
    flexWrap: 'wrap',
  },
  relationshipPill: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  relationshipPillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.indigo100,
  },
  relationshipPillText: {
    fontSize: typography.sm ?? 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  relationshipPillTextSelected: {
    color: colors.primary,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: spacing[3.5] ?? 14,
    paddingHorizontal: spacing[4],
    fontSize: typography.base ?? 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    marginBottom: spacing[5],
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: typography.base ?? 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalSend: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  modalSendText: {
    color: '#fff',
    fontSize: typography.base ?? 15,
    fontWeight: '700',
  },
});

export default FamilyManagementScreen;
