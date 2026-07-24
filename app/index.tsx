import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#486635" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(tabs)/calendar" />;
}
