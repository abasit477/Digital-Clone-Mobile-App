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
  SafeAreaView,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import familyService from '../services/familyService';
import cloneService from '../services/cloneService';

const FamilyManagementScreen = ({ navigation }) => {
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const loadFamily = useCallback(async () => {
    const { data, error } = await familyService.getMyFamily();
    setLoading(false);
    if (data) {
      setFamily(data);
    } else if (error?.status === 404) {
      setFamily(null);
    }
  }, []);

  useEffect(() => { loadFamily(); }, [loadFamily]);

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Enter a valid email address.');
      return;
    }
    setInviting(true);
    const { data, error } = await familyService.inviteMember(email);
    setInviting(false);
    if (error) {
      Alert.alert('Invite Failed', error.message || 'Could not invite member.');
      return;
    }
    setInviteEmail('');
    setInviteModalVisible(false);
    Alert.alert(
      'Invite Sent',
      `An email has been sent to ${email} with invite code:\n\n${data.invite_code}`,
    );
    loadFamily();
  };

  const handleShareCode = async (member) => {
    try {
      await Share.share({
        message: `Join ${family.name} on Digital Assistant!\n\nYour invite code: ${member.invite_code}`,
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
    const joined = !!item.accepted_at;

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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>
              {family ? family.name : 'My Family'}
            </Text>
            {family && (
              <Text style={styles.headerSubtitle}>
                {family.members.length} member{family.members.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileBtn}>
            <Text style={styles.profileBtnText}>👤</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Action row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.manageCloneButton}
          onPress={async () => {
            const { data: clone } = await cloneService.getClone(family.clone_id);
            if (clone) navigation.navigate('ManageClone', { clone });
          }}
        >
          <Text style={styles.manageCloneText}>Manage Clone</Text>
        </TouchableOpacity>

        {family?.clone_id && (
          <TouchableOpacity
            style={styles.talkButton}
            onPress={async () => {
              const { data: clone } = await cloneService.getClone(family.clone_id);
              if (clone) navigation.navigate('Interaction', { clone });
            }}
          >
            <LinearGradient colors={['#7c3aed', '#4f46e5']} style={styles.inviteButtonGradient}>
              <Text style={styles.inviteButtonText}>Talk to Clone</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.inviteButton}
          onPress={() => setInviteModalVisible(true)}
        >
          <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.inviteButtonGradient}>
            <Text style={styles.inviteButtonText}>+ Invite</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Member list */}
      {family && family.members.length > 0 ? (
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
            Invite your family members using the button above
          </Text>
        </View>
      )}

      {/* Invite modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invite a Family Member</Text>
            <Text style={styles.modalSubtitle}>
              They'll receive an email with an 8-character code to join.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Email address"
              placeholderTextColor="#aaa"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setInviteModalVisible(false); setInviteEmail(''); }}
              >
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBtnText: { fontSize: 18 },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    alignItems: 'center',
  },
  manageCloneButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  manageCloneText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 14,
  },
  talkButton: {
    flex: 1,
  },
  inviteButton: {
    flex: 1,
  },
  inviteButtonGradient: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  inviteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  memberCard: {
    backgroundColor: colors.surface || '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 6,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarCreator: {
    backgroundColor: '#c7d2fe',
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4f46e5',
  },
  memberTextContainer: {
    flex: 1,
  },
  memberEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text || '#1a1a2e',
  },
  memberStatusRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  statusJoined: {
    backgroundColor: '#dcfce7',
  },
  statusPending: {
    backgroundColor: '#fef9c3',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusJoinedText: { color: '#16a34a' },
  statusPendingText: { color: '#ca8a04' },
  creatorBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  creatorBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4f46e5',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shareButtonText: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text || '#1a1a2e',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary || '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text || '#1a1a2e',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary || '#888',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.text || '#1a1a2e',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    color: colors.textSecondary || '#888',
    fontWeight: '600',
  },
  modalSend: {
    flex: 1,
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSendText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default FamilyManagementScreen;
