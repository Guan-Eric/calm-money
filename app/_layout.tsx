import '../global.css';
import '@/i18n';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/providers/AuthProvider';
import { PremiumProvider } from '@/providers/PremiumProvider';
import { ThemeProvider, useTheme } from '@/providers/ThemeProvider';
import { stackHeaderOptions } from '@/theme/native';

function RootNavigator() {
  const { resolvedTheme, colors } = useTheme();
  const header = stackHeaderOptions(resolvedTheme);

  return (
    <>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          ...header,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <PremiumProvider>
            <RootNavigator />
          </PremiumProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
