import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import CloneListScreen    from '../screens/CloneListScreen';
import InteractionScreen  from '../screens/InteractionScreen';
import ProfileScreen      from '../screens/ProfileScreen';

const Stack = createStackNavigator();

const MainNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="CloneList"   component={CloneListScreen} />
    <Stack.Screen name="Interaction" component={InteractionScreen} />
    <Stack.Screen name="Profile"     component={ProfileScreen} />
  </Stack.Navigator>
);

export default MainNavigator;
