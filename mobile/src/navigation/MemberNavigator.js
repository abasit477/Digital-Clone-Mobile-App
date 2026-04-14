/**
 * MemberNavigator
 * On mount checks AsyncStorage to determine initial screen:
 *   No familyInfo       → JoinFamily
 *   familyInfo, no answers → MemberAssessment
 *   Both present        → MemberTabs
 */
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import JoinFamilyScreen       from '../screens/JoinFamilyScreen';
import MemberAssessmentScreen from '../screens/MemberAssessmentScreen';
import MemberTabNavigator     from './MemberTabNavigator';
import { useAuth }            from '../store/authStore';
import { storageKey, KEYS }   from '../utils/userStorage';
import { colors }             from '../theme/colors';

const Stack = createStackNavigator();

const MemberNavigator = () => {
  const { user } = useAuth();
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    AsyncStorage.multiGet([
      storageKey(user?.username, KEYS.memberFamilyInfo),
      storageKey(user?.username, KEYS.memberAnswers),
    ])
      .then(([[, fi], [, ma]]) => {
        if (!fi)      setInitialRoute('JoinFamily');
        else if (!ma) setInitialRoute('MemberAssessment');
        else          setInitialRoute('MemberTabs');
      })
      .catch(() => setInitialRoute('JoinFamily'));
  }, [user?.username]);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JoinFamily"       component={JoinFamilyScreen} />
      <Stack.Screen name="MemberAssessment" component={MemberAssessmentScreen} />
      <Stack.Screen name="MemberTabs"       component={MemberTabNavigator} />
    </Stack.Navigator>
  );
};

export default MemberNavigator;
