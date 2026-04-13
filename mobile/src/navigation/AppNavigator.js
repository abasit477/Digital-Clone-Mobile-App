import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet } from 'react-native';

import { useAuth } from '../store/authStore';
import AuthNavigator    from './AuthNavigator';
import MainNavigator    from './MainNavigator';
import AdminNavigator   from './AdminNavigator';
import CreatorNavigator from './CreatorNavigator';
import MemberNavigator  from './MemberNavigator';
import RoleSelectScreen from '../screens/RoleSelectScreen';
import Loader from '../components/Loader';
import { colors } from '../theme/colors';

const Stack = createStackNavigator();

function getAuthenticatedNavigator(user) {
  const role = user?.role;
  if (role === 'platform_admin' || role === 'admin') return { name: 'Admin',   component: AdminNavigator };
  if (role === 'creator')                             return { name: 'Creator', component: CreatorNavigator };
  if (role === 'member')                              return { name: 'Member',  component: MemberNavigator };
  // null/undefined role → first-time user picks their role
  return { name: 'RoleSelect', component: RoleSelectScreen };
}

const AppNavigator = () => {
  const { isAuthenticated, isInitialized, user } = useAuth();

  // Block render until the session check is complete (prevents flash of wrong screen)
  if (!isInitialized) {
    return (
      <View style={styles.splash}>
        <Loader visible message="Loading…" />
      </View>
    );
  }

  const { name, component } = isAuthenticated
    ? getAuthenticatedNavigator(user)
    : { name: 'Auth', component: AuthNavigator };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          key={name}
          name={name}
          component={component}
          options={{
            animationTypeForReplace: isAuthenticated ? 'push' : 'pop',
          }}
        />
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
