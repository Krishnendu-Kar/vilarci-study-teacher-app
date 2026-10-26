import React, { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import 'react-native-url-polyfill/auto';

import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { ToastProvider } from './src/components/ui/Toast';
import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AppShell ready={fontsLoaded} />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function AppShell({ ready }: { ready: boolean }) {
  const { colors, isDark } = useTheme();

  const render = useCallback(() => {
    if (!ready) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgApp }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    return <RootNavigator />;
  }, [ready, colors]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {render()}
    </>
  );
}
