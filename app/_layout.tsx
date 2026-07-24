import '../global.css';
import '@/i18n';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/providers/AuthProvider';
import { PremiumProvider } from '@/providers/PremiumProvider';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <PremiumProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              headerBackButtonDisplayMode: 'minimal',
              headerTintColor: '#32302f',
              headerStyle: { backgroundColor: '#f9f8f7' },
            }}
          />
        </PremiumProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
