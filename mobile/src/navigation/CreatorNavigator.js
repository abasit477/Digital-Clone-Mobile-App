/**
 * CreatorNavigator — MVP version
 *
 * Stack:
 *   FamilyAssessment  — full-screen onboarding (no tab bar)
 *   MainTabs          — Home / Chat / Profile with bottom tab bar
 *
 * On mount: checks AsyncStorage for existing assessment answers.
 *   - Found  → MainTabs (Home dashboard)
 *   - Missing → FamilyAssessment (10-question MCQ)
 */
import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';

import FamilyAssessmentScreen  from '../screens/FamilyAssessmentScreen';
import FamilyManagementScreen  from '../screens/FamilyManagementScreen';
import VoiceRecordScreen        from '../screens/VoiceRecordScreen';
import MainTabNavigator         from './MainTabNavigator';
import { colors }               from '../theme/colors';

const Stack = createStackNavigator();

const CreatorNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    setInitialRoute('MainTabs');
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FamilyAssessment"  component={FamilyAssessmentScreen} />
      <Stack.Screen name="MainTabs"          component={MainTabNavigator} />
      <Stack.Screen name="FamilyManagement"  component={FamilyManagementScreen} />
      <Stack.Screen name="VoiceRecord"       component={VoiceRecordScreen} />
    </Stack.Navigator>
  );
};

export default CreatorNavigator;
