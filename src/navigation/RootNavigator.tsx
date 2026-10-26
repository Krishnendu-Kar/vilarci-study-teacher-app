import React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { elevation, fonts } from '../theme/tokens';
import { useAuth } from '../lib/AuthProvider';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { TeacherHomeScreen } from '../screens/real/TeacherHomeScreen';
import { TeacherProfileFormScreen } from '../screens/real/TeacherProfileFormScreen';
import { AccountScreen } from '../screens/real/AccountScreen';
import { BatchesScreen as RealBatchesScreen } from '../screens/real/BatchesScreen';
import { BatchFormScreen } from '../screens/real/BatchFormScreen';
import { BatchDetailScreen } from '../screens/real/BatchDetailScreen';
import { ComingSoonScreen, InstitutesComingSoon } from '../screens/real/ComingSoonScreen';
import { MoreScreen as RealMoreScreen } from '../screens/real/MoreScreen';

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
const AuthStack = createNativeStackNavigator();
const RealTabs = createBottomTabNavigator();
const RealHomeStack = createNativeStackNavigator();
const RealBatchesStack = createNativeStackNavigator();
const RealMoreStack = createNativeStackNavigator();

function RealHomeNavigator() {
  return (
    <RealHomeStack.Navigator screenOptions={pushOptions}>
      <RealHomeStack.Screen name="TeacherHome" component={TeacherHomeScreen} />
      <RealHomeStack.Screen name="TeacherProfileForm" component={TeacherProfileFormScreen} />
      <RealHomeStack.Screen name="Account" component={AccountScreen} />
    </RealHomeStack.Navigator>
  );
}

function RealBatchesNavigator() {
  return (
    <RealBatchesStack.Navigator screenOptions={pushOptions}>
      <RealBatchesStack.Screen name="BatchList" component={RealBatchesScreen} />
      <RealBatchesStack.Screen name="BatchForm" component={BatchFormScreen} />
      <RealBatchesStack.Screen name="BatchDetail" component={BatchDetailScreen} />
    </RealBatchesStack.Navigator>
  );
}

function RealMoreNavigator() {
  return (
    <RealMoreStack.Navigator screenOptions={pushOptions}>
      <RealMoreStack.Screen name="MoreHub" component={RealMoreScreen} />
      <RealMoreStack.Screen name="Account" component={AccountScreen} />
      <RealMoreStack.Screen name="ComingSoon" component={ComingSoonScreen} />
    </RealMoreStack.Navigator>
  );
}

const REAL_TAB_ICONS: Record<string, [IconName, IconName]> = {
  Home: ['home', 'home-outline'],
  Batches: ['people', 'people-outline'],
  Institutes: ['business', 'business-outline'],
  More: ['grid', 'grid-outline'],
};

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
  const { session, loading, recovering, demo } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgApp }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Signed out (or mid password reset) → login / signup / reset.
  if ((!session && !demo) || recovering) {
    return (
      <NavigationContainer theme={navTheme(isDark, colors)}>
        <AuthStack.Navigator screenOptions={pushOptions}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Signup" component={SignupScreen} />
          <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }

  // Signed in → the real teacher app; the demo below opens from its Demo button.
  if (session && !demo) {
    return (
      <NavigationContainer theme={navTheme(isDark, colors)}>
        <RealTabs.Navigator
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
              const [active, idle] = REAL_TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
              return <Ionicons name={focused ? active : idle} size={size - 2} color={color} />;
            },
          })}
        >
          <RealTabs.Screen name="Home" component={RealHomeNavigator} />
          <RealTabs.Screen name="Batches" component={RealBatchesNavigator} />
          <RealTabs.Screen name="Institutes" component={InstitutesComingSoon} />
          <RealTabs.Screen name="More" component={RealMoreNavigator} />
        </RealTabs.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <>
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
    {session ? <BackToAccountPill /> : null}
    </>
  );
}

/** Floating way back from the demo screens to the signed-in real app. */
function BackToAccountPill() {
  const { colors } = useTheme();
  const { exitDemo } = useAuth();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: (Platform.OS === 'ios' ? 84 : 62) + insets.bottom + 10, alignItems: 'center' }}>
      <Pressable
        onPress={exitDemo}
        accessibilityRole="button"
        accessibilityLabel="Back to my account"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          backgroundColor: colors.primary,
          opacity: pressed ? 0.85 : 1,
          ...elevation(2, colors.shadowColor, colors.shadowOpacity + 0.1),
        })}
      >
        <Ionicons name="arrow-undo-outline" size={15} color="#fff" />
        <Text style={{ color: '#fff', fontFamily: fonts.sansSemibold, fontSize: 12.5 }}>Demo · Back to my account</Text>
      </Pressable>
    </View>
  );
}
