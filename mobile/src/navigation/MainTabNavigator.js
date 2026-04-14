/**
 * MainTabNavigator
 * Tabs: Home · Chat (hidden until clone exists) · Profile
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import HomeScreen    from '../screens/HomeScreen';
import ChatScreen    from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useAuth }   from '../store/authStore';
import { storageKey, KEYS } from '../utils/userStorage';
import { colors }    from '../theme/colors';
import { typography } from '../theme/typography';
import { radius }    from '../theme/spacing';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home:    '🏠',
  Chat:    '💬',
  Profile: '👤',
};

const TabIcon = ({ name, focused }) => (
  <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
    <Text style={styles.iconEmoji}>{TAB_ICONS[name]}</Text>
  </View>
);

const TabLabel = ({ name, focused }) => (
  <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{name}</Text>
);

// Wrapper so we can use useFocusEffect to recheck clone status on every focus
const MainTabNavigator = () => {
  const { user } = useAuth();
  const [hasClone, setHasClone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(storageKey(user?.username, KEYS.assessmentAnswers))
        .then(raw => setHasClone(!!raw))
        .catch(() => setHasClone(false));
    }, [user?.username])
  );

  const screenOptions = ({ route }) => ({
    headerShown: false,
    tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
    tabBarLabel: ({ focused }) => <TabLabel name={route.name} focused={focused} />,
    tabBarStyle: styles.tabBar,
    tabBarItemStyle: styles.tabItem,
    tabBarActiveTintColor:   colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
  });

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarButton: hasClone ? undefined : () => null,
          tabBarStyle: !hasClone ? { ...styles.tabBar, paddingHorizontal: 40 } : styles.tabBar,
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: Platform.OS === 'ios' ? 82 : 62,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    elevation: 0,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: colors.indigo100,
  },
  iconEmoji: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize: typography.xs,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 2,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default MainTabNavigator;
