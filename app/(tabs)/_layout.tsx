import { Tabs, Redirect } from 'expo-router';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/AuthProvider';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text className={`text-[11px] ${focused ? 'font-medium text-ink' : 'text-ink-faint'}`}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  if (!loading && !user) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#f9f8f7',
          borderTopColor: '#e8e6e4',
          borderTopWidth: 1,
          height: 88,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#32302f',
        tabBarInactiveTintColor: '#94908d',
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('calendar'),
          tabBarLabel: ({ focused }) => <TabLabel label="Spend" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: t('add'),
          tabBarLabel: ({ focused }) => <TabLabel label={t('add')} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          tabBarLabel: ({ focused }) => <TabLabel label={t('settings')} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
