import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';

import JoinFamilyScreen  from '../screens/JoinFamilyScreen';
import InteractionScreen from '../screens/InteractionScreen';
import ProfileScreen     from '../screens/ProfileScreen';
import familyService     from '../services/familyService';
import { colors }        from '../theme/colors';

const Stack = createStackNavigator();

/**
 * MemberNavigator
 * If the member has already joined a family, go straight to Interaction with their clone.
 * Otherwise show JoinFamilyScreen first.
 */
const MemberNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const [familyClone, setFamilyClone] = useState(null);

  useEffect(() => {
    familyService.getMyClone()
      .then(({ data }) => {
        if (data) {
          setFamilyClone(data);
          setInitialRoute('Interaction');
        } else {
          setInitialRoute('JoinFamily');
        }
      })
      .catch(() => setInitialRoute('JoinFamily'));
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="JoinFamily"   component={JoinFamilyScreen} />
      <Stack.Screen name="Interaction"  component={InteractionScreen}
        initialParams={familyClone ? { clone: familyClone } : undefined}
      />
      <Stack.Screen name="Profile"      component={ProfileScreen} />
    </Stack.Navigator>
  );
};

export default MemberNavigator;
