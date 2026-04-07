import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen       from '../screens/LoginScreen';
import SignupScreen      from '../screens/SignupScreen';
import VerificationScreen from '../screens/VerificationScreen';

const Stack = createStackNavigator();

const AuthNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      cardStyleInterpolator: ({ current, layouts }) => ({
        cardStyle: {
          opacity: current.progress,
          transform: [
            {
              translateX: current.progress.interpolate({
                inputRange:  [0, 1],
                outputRange: [layouts.screen.width * 0.08, 0],
              }),
            },
          ],
        },
      }),
    }}
  >
    <Stack.Screen name="Login"        component={LoginScreen} />
    <Stack.Screen name="Signup"       component={SignupScreen} />
    <Stack.Screen name="Verification" component={VerificationScreen} />
  </Stack.Navigator>
);

export default AuthNavigator;
