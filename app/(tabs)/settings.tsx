import React, { useState } from 'react';
import { ScrollView, Text, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/providers/AuthProvider';
import { usePremium } from '@/providers/PremiumProvider';
import { useTheme } from '@/providers/ThemeProvider';
import {
  Eyebrow,
  Title,
  CardRow,
  GhostButton,
  SoftButton,
  SectionHeader,
  SegmentedControl,
  ThemedSwitch,
} from '@/components/ui';
import { db, functions } from '@/lib/firebase';
import { seedDemoData } from '@/lib/seedDemo';
import type { AppearancePreference } from '@/theme/native';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, household, signOut, refreshHousehold } = useAuth();
  const { isPremium } = usePremium();
  const { appearance, setAppearance } = useTheme();
  const [seeding, setSeeding] = useState(false);

  const prefs = profile?.notificationPrefs ?? {
    syncComplete: true,
    weeklyDigest: false,
    partnerInvite: true,
  };

  const togglePref = async (key: keyof typeof prefs, value: boolean) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        [`notificationPrefs.${key}`]: value,
      });
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    }
  };

  const onSeedDemo = async () => {
    if (!user || !household) return;
    setSeeding(true);
    try {
      try {
        await httpsCallable(functions, 'syncPremiumStatus')({ isPremium: true });
      } catch {
        // Sandbox Pro mirror may fail if Functions not deployed — demo seed still useful
      }
      const { transactionCount } = await seedDemoData({
        uid: user.uid,
        householdId: household.id,
        currency: household.defaultCurrency || 'USD',
        countryCode: household.countryCode || 'US',
      });
      await refreshHousehold();
      Alert.alert(
        t('appName'),
        `Added ${transactionCount} sample transactions so you can explore Spend.`,
      );
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 48, paddingHorizontal: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Eyebrow>Account</Eyebrow>
      <Title>{t('settings')}</Title>
      <Text className="mt-2 text-[15px] text-ink-muted">
        {profile?.email ?? profile?.displayName ?? ''}
      </Text>

      <SectionHeader>{t('appearance')}</SectionHeader>
      <SegmentedControl
        value={appearance}
        onChange={(k) => setAppearance(k as AppearancePreference)}
        options={[
          { key: 'system', label: t('appearanceSystem') },
          { key: 'light', label: t('appearanceLight') },
          { key: 'dark', label: t('appearanceDark') },
        ]}
      />

      <SectionHeader>Money</SectionHeader>
      <CardRow
        title={t('sharing')}
        subtitle={t('sharingIntro')}
        onPress={() => router.push('/sharing')}
      />
      <CardRow
        title={t('connectBank')}
        subtitle={t('bankIntro')}
        onPress={() => router.push('/bank')}
      />
      <CardRow
        title={t('region')}
        subtitle="Country and currency"
        onPress={() => router.push('/region')}
      />
      <CardRow
        title={t('pro')}
        subtitle={isPremium ? 'Active' : t('proBlurb')}
        onPress={() => router.push('/pro')}
      />

      <SectionHeader>{t('notifications')}</SectionHeader>
      <PrefRow
        label={t('notifSync')}
        value={prefs.syncComplete}
        onChange={(v) => void togglePref('syncComplete', v)}
      />
      <PrefRow
        label={t('notifDigest')}
        value={prefs.weeklyDigest}
        onChange={(v) => void togglePref('weeklyDigest', v)}
      />
      <PrefRow
        label={t('notifPartner')}
        value={prefs.partnerInvite}
        onChange={(v) => void togglePref('partnerInvite', v)}
      />

      {__DEV__ ? (
        <>
          <SectionHeader>Testing</SectionHeader>
          <Text className="mt-1 mb-2 text-sm text-ink-muted leading-5">
            Sample spending for exploring the calendar without a bank link.
          </Text>
          <SoftButton label={seeding ? 'Loading…' : 'Load demo data'} onPress={onSeedDemo} />
        </>
      ) : null}

      <GhostButton label={t('signOut')} onPress={() => void signOut()} />
    </ScrollView>
  );
}

function PrefRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between border-b border-line py-4">
      <Text className="mr-3 flex-1 text-[17px] text-ink">{label}</Text>
      <ThemedSwitch value={value} onValueChange={onChange} />
    </View>
  );
}
