// ⚠️ Must be the very first import — polyfills crypto.getRandomValues
// so that amazon-cognito-identity-js SRP math uses a secure RNG.
import 'react-native-get-random-values';

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/store/authStore';
import { syncStorage } from './src/utils/syncStorage';
import { colors } from './src/theme/colors';

export default function App() {
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    // Load persisted Cognito keys into the in-memory sync store
    // before any auth operations run.
    syncStorage.hydrate().then(() => setStorageReady(true));
  }, []);

  if (!storageReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <AppNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
