/**
 * MemberTabNavigator
 * Bottom tabs for members: Home · Chat · Profile
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import MemberHomeScreen from '../screens/MemberHomeScreen';
import ChatScreen       from '../screens/ChatScreen';
import ProfileScreen    from '../screens/ProfileScreen';
import { colors }       from '../theme/colors';
import { typography }   from '../theme/typography';
import { radius }       from '../theme/spacing';

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

const MemberTabNavigator = () => {
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
      <Tab.Screen name="Home"    component={MemberHomeScreen} />
      <Tab.Screen name="Chat"    component={ChatScreen} />
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
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  iconWrapper: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapperActive: { backgroundColor: colors.indigo100 },
  iconEmoji: { fontSize: 20 },
  tabLabel: {
    fontSize: typography.xs, fontWeight: '500', color: colors.textMuted, marginTop: 2,
  },
  tabLabelActive: { color: colors.primary, fontWeight: '600' },
});

export default MemberTabNavigator;
