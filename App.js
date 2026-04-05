import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { SavedProvider } from './src/context/SavedContext';
import DirectoryScreen from './src/screens/DirectoryScreen';
import DetailScreen from './src/screens/DetailScreen';
import SavedScreen from './src/screens/SavedScreen';
import AboutScreen from './src/screens/AboutScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HEADER_STYLE = {
  headerStyle: { backgroundColor: '#1a3a5c' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

function DirectoryStack() {
  return (
    <Stack.Navigator screenOptions={HEADER_STYLE}>
      <Stack.Screen
        name="Directory"
        component={DirectoryScreen}
        options={{ title: 'SURGhub Pathways' }}
      />
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={{ title: 'Opportunity Details' }}
      />
    </Stack.Navigator>
  );
}

function SavedStack() {
  return (
    <Stack.Navigator screenOptions={HEADER_STYLE}>
      <Stack.Screen
        name="SavedList"
        component={SavedScreen}
        options={{ title: 'Saved' }}
      />
      <Stack.Screen
        name="SavedDetail"
        component={DetailScreen}
        options={{ title: 'Opportunity Details' }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SavedProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              const icons = {
                Explore: focused ? 'search' : 'search-outline',
                Saved:   focused ? 'bookmark' : 'bookmark-outline',
                About:   focused ? 'information-circle' : 'information-circle-outline',
              };
              return <Ionicons name={icons[route.name]} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#1a3a5c',
            tabBarInactiveTintColor: '#aaa',
            headerShown: false,
          })}
        >
          <Tab.Screen name="Explore" component={DirectoryStack} />
          <Tab.Screen name="Saved" component={SavedStack} />
          <Tab.Screen
            name="About"
            component={AboutScreen}
            options={{
              headerShown: true,
              headerTitle: 'About',
              headerStyle: { backgroundColor: '#1a3a5c' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SavedProvider>
  );
}
