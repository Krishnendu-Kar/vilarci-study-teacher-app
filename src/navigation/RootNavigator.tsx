import React from 'react';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

import { TodayScreen } from '../screens/TodayScreen';
import { BatchesScreen } from '../screens/BatchesScreen';
import { InstitutesScreen } from '../screens/InstitutesScreen';
import { InstituteScreen } from '../screens/InstituteScreen';
import { DeckScreen } from '../screens/DeckScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { HonoursLogScreen } from '../screens/HonoursLogScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { HelpScreen } from '../screens/HelpScreen';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const Tabs = createBottomTabNavigator();
const TodayStack = createNativeStackNavigator();
const BatchesStack = createNativeStackNavigator();
const InstitutesStack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();

/** Drill-in screens: the deck and institute workspaces slide over their hub. */
const pushOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'slide_from_right',
};

/** Each batch, section and institute is its own route, so opening another pushes fresh state. */
const routeId = ({ params }: { params?: object }) => (params as { id?: string } | undefined)?.id;

// The batch command deck is registered in every realm's stack so Back always
// returns to wherever the teacher entered it from.

function TodayNavigator() {
  return (
    <TodayStack.Navigator screenOptions={pushOptions}>
      <TodayStack.Screen name="TodayHome" component={TodayScreen} />
      <TodayStack.Screen name="Deck" component={DeckScreen} getId={routeId} />
    </TodayStack.Navigator>
  );
}

function BatchesNavigator() {
  return (
    <BatchesStack.Navigator screenOptions={pushOptions}>
      <BatchesStack.Screen name="BatchesHome" component={BatchesScreen} />
      <BatchesStack.Screen name="Deck" component={DeckScreen} getId={routeId} />
    </BatchesStack.Navigator>
  );
}

function InstitutesNavigator() {
  return (
    <InstitutesStack.Navigator screenOptions={pushOptions}>
      <InstitutesStack.Screen name="InstitutesHome" component={InstitutesScreen} />
      <InstitutesStack.Screen name="Institute" component={InstituteScreen} getId={routeId} />
      <InstitutesStack.Screen name="Deck" component={DeckScreen} getId={routeId} />
    </InstitutesStack.Navigator>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={pushOptions}>
      <MoreStack.Screen name="MoreHub" component={MoreScreen} />
      <MoreStack.Screen name="HonoursLog" component={HonoursLogScreen} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
      <MoreStack.Screen name="Help" component={HelpScreen} />
    </MoreStack.Navigator>
  );
}

const TAB_ICONS: Record<string, [IconName, IconName]> = {
  Today: ['today', 'today-outline'],
  Batches: ['people', 'people-outline'],
  Institutes: ['business', 'business-outline'],
  More: ['grid', 'grid-outline'],
};

function navTheme(isDark: boolean, colors: ReturnType<typeof useTheme>['colors']): Theme {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.bgApp,
      card: colors.surface,
      text: colors.textMain,
      border: colors.border,
      notification: colors.accent,
    },
  };
}

export function RootNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <NavigationContainer theme={navTheme(isDark, colors)}>
      <Tabs.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: Platform.OS === 'ios' ? 84 : 62,
            paddingTop: 6,
            paddingBottom: Platform.OS === 'ios' ? 26 : 8,
          },
          tabBarLabelStyle: { fontFamily: fonts.sansSemibold, fontSize: 10.5 },
          tabBarIcon: ({ color, size, focused }) => {
            const [active, idle] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
            return <Ionicons name={focused ? active : idle} size={size - 2} color={color} />;
          },
        })}
      >
        <Tabs.Screen name="Today" component={TodayNavigator} />
        <Tabs.Screen name="Batches" component={BatchesNavigator} />
        <Tabs.Screen name="Institutes" component={InstitutesNavigator} />
        <Tabs.Screen name="More" component={MoreNavigator} />
      </Tabs.Navigator>
    </NavigationContainer>
  );
}
