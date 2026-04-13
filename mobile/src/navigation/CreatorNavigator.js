import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';

import CreatorHomeScreen       from '../screens/CreatorHomeScreen';
import CloneTypeSelectScreen   from '../screens/CloneTypeSelectScreen';
import CreatorOnboardingScreen from '../screens/CreatorOnboardingScreen';
import FamilyManagementScreen  from '../screens/FamilyManagementScreen';
import PersonalCloneScreen     from '../screens/PersonalCloneScreen';
import ManageCloneScreen       from '../screens/ManageCloneScreen';
import InteractionScreen       from '../screens/InteractionScreen';
import ProfileScreen           from '../screens/ProfileScreen';
import cloneService            from '../services/cloneService';
import familyService           from '../services/familyService';
import { colors }              from '../theme/colors';

const Stack = createStackNavigator();

/**
 * CreatorNavigator
 *
 * Routing logic on mount:
 *   - No clone yet          → CreatorHome (user initiates creation themselves)
 *   - Clone + family exists → FamilyManagement
 *   - Clone, no family      → PersonalClone
 */
const CreatorNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const resolve = async () => {
      try {
        const { data: clones } = await cloneService.listClones();
        if (!clones || clones.length === 0) {
          return setInitialRoute('CreatorHome');
        }
        // Has a clone — check if it's linked to a family
        const { data: family } = await familyService.getMyFamily();
        setInitialRoute(family ? 'FamilyManagement' : 'PersonalClone');
      } catch {
        setInitialRoute('CreatorHome');
      }
    };
    resolve();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CreatorHome"       component={CreatorHomeScreen} />
      <Stack.Screen name="CloneTypeSelect"   component={CloneTypeSelectScreen} />
      <Stack.Screen name="CreatorOnboarding" component={CreatorOnboardingScreen} />
      <Stack.Screen name="FamilyManagement"  component={FamilyManagementScreen} />
      <Stack.Screen name="PersonalClone"     component={PersonalCloneScreen} />
      <Stack.Screen name="ManageClone"       component={ManageCloneScreen} />
      <Stack.Screen name="Interaction"       component={InteractionScreen} />
      <Stack.Screen name="Profile"           component={ProfileScreen} />
    </Stack.Navigator>
  );
};

export default CreatorNavigator;
