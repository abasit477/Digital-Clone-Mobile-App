/**
 * FaceScanScreen
 * Captures a selfie with the front camera and uploads it as the user's face avatar.
 * Saves the returned URL to AsyncStorage so FaceChatScreen can display it immediately.
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../store/authStore';
import { colors } from '../theme/colors';
import { storageKey, KEYS } from '../utils/userStorage';
import chatService from '../services/chatService';

const GUIDE_SIZE = 240;

const FaceScanScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [preview, setPreview]     = useState(null);   // { uri, base64 } after capture
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef(null);

  // ── Permission gate ───────────────────────────────────────────────────────

  if (!permission) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Face Avatar</Text>
          <View style={{ width: 60 }} />
        </LinearGradient>
        <View style={styles.permBody}>
          <Text style={styles.permIcon}>📷</Text>
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permSub}>We need your camera to capture your face avatar.</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.permBtnGradient}>
              <Text style={styles.permBtnText}>Allow Camera</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Capture ───────────────────────────────────────────────────────────────

  const capture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: true });
    setPreview({ uri: photo.uri, base64: photo.base64 });
  };

  // ── Upload & confirm ──────────────────────────────────────────────────────

  const confirm = async () => {
    if (!preview?.base64) return;
    setUploading(true);
    try {
      const { data, error } = await chatService.uploadAvatar(preview.base64);
      if (error) throw new Error(error.message ?? 'Upload failed');

      // Persist full URL so FaceChatScreen can load it immediately
      await AsyncStorage.setItem(
        storageKey(user?.username, KEYS.faceAvatarUrl),
        data.avatar_url
      );

      navigation.goBack();
    } catch (err) {
      Alert.alert('Upload failed', err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Retake ────────────────────────────────────────────────────────────────

  const retake = () => setPreview(null);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {preview ? 'Confirm Photo' : 'Scan Your Face'}
        </Text>
        <View style={{ width: 60 }} />
      </LinearGradient>

      <View style={styles.body}>
        {/* Camera / Preview */}
        <View style={styles.cameraWrapper}>
          {preview ? (
            <Image source={{ uri: preview.uri }} style={styles.previewImage} />
          ) : (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
            />
          )}
          {/* Circular guide overlay */}
          <View style={styles.guideOverlay} pointerEvents="none">
            <View style={styles.guideCircle} />
          </View>
        </View>

        <Text style={styles.hint}>
          {preview
            ? 'Looking good? Confirm to use this as your face avatar.'
            : 'Centre your face inside the circle, then tap capture.'}
        </Text>

        {/* Actions */}
        {preview ? (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={retake} disabled={uploading}>
              <Text style={styles.secondaryBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={confirm} disabled={uploading} activeOpacity={0.85}>
              <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.primaryBtnGradient}>
                {uploading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>Use This Photo</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.captureBtn} onPress={capture} activeOpacity={0.85}>
            <View style={styles.captureOuter}>
              <View style={styles.captureInner} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { width: 60 },
  backText:    { fontSize: 17, color: '#fff', fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  body: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 32 },

  // Camera / preview
  cameraWrapper: {
    width: GUIDE_SIZE + 60,
    height: GUIDE_SIZE + 60,
    borderRadius: (GUIDE_SIZE + 60) / 2,
    overflow: 'hidden',
    position: 'relative',
  },
  camera:       { width: '100%', height: '100%' },
  previewImage: { width: '100%', height: '100%' },

  // Guide circle overlay
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  guideCircle: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE,
    borderRadius: GUIDE_SIZE / 2,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
    borderStyle: 'dashed',
  },

  hint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14, textAlign: 'center',
    paddingHorizontal: 32, lineHeight: 20,
  },

  // Capture shutter button
  captureBtn: { alignItems: 'center', justifyContent: 'center' },
  captureOuter: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#fff',
  },

  // Confirm / retake row
  actionRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 24, width: '100%' },
  secondaryBtn: {
    flex: 1, height: 52, borderRadius: 14,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  primaryBtn:         { flex: 1, borderRadius: 14, overflow: 'hidden', height: 52 },
  primaryBtnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Permission screen
  permBody: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, backgroundColor: colors.background,
  },
  permIcon:  { fontSize: 56, marginBottom: 20 },
  permTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  permSub:   { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  permBtn:         { width: '100%', borderRadius: 14, overflow: 'hidden' },
  permBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  permBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default FaceScanScreen;
