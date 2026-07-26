import { Tabs, Redirect } from 'expo-router';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { tabBarColors } from '@/theme/native';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text className={`text-[11px] ${focused ? 'font-medium text-ink' : 'text-ink-faint'}`}>
      {label}
    </Text>
  );
}

function TabIcon({
  focused,
  active,
  inactive,
  color,
}: {
  focused: boolean;
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return <Ionicons name={focused ? active : inactive} size={24} color={color} />;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { resolvedTheme, colors } = useTheme();
  const bar = tabBarColors(resolvedTheme);

  if (!loading && !user) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        ...bar,
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('calendar'),
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              active="calendar"
              inactive="calendar-outline"
              color={focused ? colors.ink : colors.inkFaint}
            />
          ),
          tabBarLabel: ({ focused }) => <TabLabel label="Spend" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: t('add'),
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              active="add-circle"
              inactive="add-circle-outline"
              color={focused ? colors.ink : colors.inkFaint}
            />
          ),
          tabBarLabel: ({ focused }) => <TabLabel label={t('add')} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              active="settings"
              inactive="settings-outline"
              color={focused ? colors.ink : colors.inkFaint}
            />
          ),
          tabBarLabel: ({ focused }) => <TabLabel label={t('settings')} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
