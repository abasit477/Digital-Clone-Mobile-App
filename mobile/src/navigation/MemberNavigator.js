/**
 * MemberNavigator
 * On mount checks AsyncStorage then verifies against the backend:
 *   No familyInfo / backend 404  → JoinFamily  (clears stale cache)
 *   familyInfo valid, no answers → MemberAssessment
 *   Both present                 → MemberTabs
 */
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import JoinFamilyScreen       from '../screens/JoinFamilyScreen';
import MemberAssessmentScreen from '../screens/MemberAssessmentScreen';
import FaceScanScreen         from '../screens/FaceScanScreen';
import MemberTabNavigator     from './MemberTabNavigator';
import { useAuth }            from '../store/authStore';
import { storageKey, KEYS }   from '../utils/userStorage';
import { colors }             from '../theme/colors';
import familyService          from '../services/familyService';

const Stack = createStackNavigator();

const MemberNavigator = () => {
  const { user } = useAuth();
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const resolve = async () => {
      try {
        const [[, fi], [, ma]] = await AsyncStorage.multiGet([
          storageKey(user?.username, KEYS.memberFamilyInfo),
          storageKey(user?.username, KEYS.memberAnswers),
        ]);

        if (!fi) {
          setInitialRoute('JoinFamily');
          return;
        }

        // Verify the cached family still exists on the backend
        const { error } = await familyService.getMyClone();
        if (error) {
          // Family or clone gone — clear stale cache and restart join flow
          await AsyncStorage.multiRemove([
            storageKey(user?.username, KEYS.memberFamilyInfo),
            storageKey(user?.username, KEYS.memberAnswers),
          ]);
          setInitialRoute('JoinFamily');
          return;
        }

        setInitialRoute(ma ? 'MemberTabs' : 'MemberAssessment');
      } catch {
        setInitialRoute('JoinFamily');
      }
    };

    resolve();
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
      <Stack.Screen name="FaceScan"         component={FaceScanScreen} />
    </Stack.Navigator>
  );
};

export default MemberNavigator;
