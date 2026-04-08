import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import CreateCloneScreen    from '../screens/CreateCloneScreen';
import ManageCloneScreen    from '../screens/ManageCloneScreen';

const Stack = createStackNavigator();

const AdminNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
    <Stack.Screen name="CreateClone"    component={CreateCloneScreen} />
    <Stack.Screen name="ManageClone"    component={ManageCloneScreen} />
  </Stack.Navigator>
);

export default AdminNavigator;
