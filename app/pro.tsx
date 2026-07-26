import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { usePremium } from '@/providers/PremiumProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { stackHeaderOptions } from '@/theme/native';
import { Screen, Title, Subtitle, PrimaryButton, GhostButton } from '@/components/ui';

export default function ProScreen() {
  const { t } = useTranslation();
  const { isPremium, presentPaywallHint, purchasePackageById, restore } = usePremium();
  const { resolvedTheme } = useTheme();
  const header = stackHeaderOptions(resolvedTheme);
  const [loading, setLoading] = useState(false);

  const onPurchase = async () => {
    setLoading(true);
    try {
      await purchasePackageById('$rc_monthly');
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('errorGeneric');
      if (msg.toLowerCase().includes('cancel')) return;
      Alert.alert(
        t('pro'),
        `${msg}\n\nSet EXPO_PUBLIC_REVENUECAT_* keys and use a dev client. For local UI testing set EXPO_PUBLIC_MOCK_PREMIUM=true (dev only).`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('pro'),
          ...header,
        }}
      />
      <Screen className="pt-6">
        <Title>{t('pro')}</Title>
        <Subtitle>{t('proBlurb')}</Subtitle>
        <Text className="mt-4 text-[17px] text-ink-muted leading-6">{presentPaywallHint}</Text>
        <Text className="mt-4 text-sm text-sage">
          Status: {isPremium ? 'Pro active' : 'Free tier'}
        </Text>
        {!isPremium ? (
          <PrimaryButton label={t('upgrade')} loading={loading} onPress={onPurchase} />
        ) : null}
        <GhostButton
          label={t('restore')}
          onPress={() => {
            void restore().catch((e) =>
              Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric')),
            );
          }}
        />
      </Screen>
    </>
  );
}
