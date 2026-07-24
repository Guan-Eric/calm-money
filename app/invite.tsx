import { Redirect, useLocalSearchParams } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';

/** Deep link: calmmoney://invite?code=ABC123 */
export default function InviteDeepLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#486635" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href={{ pathname: '/sharing', params: { code: code ?? '' } }} />;
}
