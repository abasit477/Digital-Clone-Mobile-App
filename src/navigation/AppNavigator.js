import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet } from 'react-native';

import { useAuth } from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import Loader from '../components/Loader';
import { colors } from '../theme/colors';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, isInitialized } = useAuth();

  // Block render until the session check is complete (prevents flash of wrong screen)
  if (!isInitialized) {
    return (
      <View style={styles.splash}>
        <Loader visible message="Loading…" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen
            name="Main"
            component={MainNavigator}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{
              animationTypeForReplace: 'pop',
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppNavigator;
