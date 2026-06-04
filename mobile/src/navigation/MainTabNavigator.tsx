import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { GitCompareArrows, Heart, Home as HomeIcon, Map } from 'lucide-react-native';
import HomeScreen from '../screens/HomeScreen';
import ComplexDetailScreen from '../screens/ComplexDetailScreen';
import CompareScreen from '../screens/CompareScreen';
import MapScreen from '../screens/MapScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import { theme } from '../theme';

type HomeStackParamList = {
  HomeMain: undefined;
  ComplexDetail: { id: string };
};

type MainTabParamList = {
  HomeTab: undefined;
  MapTab: undefined;
  CompareTab: undefined;
  FavoritesTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<HomeStackParamList>();

function HomeStack() {
  return (
    <Stack.Navigator id="home-stack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="ComplexDetail" component={ComplexDetailScreen} />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      id="main-tabs"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarStyle: {
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 24,
          height: 72,
          borderTopWidth: 0,
          borderRadius: 28,
          backgroundColor: theme.colors.surface,
          paddingBottom: 10,
          paddingTop: 10,
          ...theme.shadows.floating,
        },
        tabBarItemStyle: { marginHorizontal: 4, borderRadius: 22 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Обзор',
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="MapTab"
        component={MapScreen}
        options={{
          tabBarLabel: 'Карта',
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="CompareTab"
        component={CompareScreen}
        options={{
          tabBarLabel: 'Сравнение',
          tabBarIcon: ({ color, size }) => <GitCompareArrows color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="FavoritesTab"
        component={FavoritesScreen}
        options={{
          tabBarLabel: 'Избранное',
          tabBarIcon: ({ color, size }) => <Heart color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
