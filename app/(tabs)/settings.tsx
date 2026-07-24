import React, { useState } from 'react';
import { ScrollView, Text, Switch, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';
import { usePremium } from '@/providers/PremiumProvider';
import { Eyebrow, Title, CardRow, GhostButton, SoftButton, SectionHeader } from '@/components/ui';
import { db } from '@/lib/firebase';
import { seedDemoData } from '@/lib/seedDemo';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, household, signOut, refreshHousehold } = useAuth();
  const { isPremium } = usePremium();
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
      await setDoc(
        doc(db, 'users', user.uid),
        { isPremium: true, premiumSyncedAt: Date.now() },
        { merge: true },
      );
      const { transactionCount } = await seedDemoData({
        uid: user.uid,
        householdId: household.id,
        currency: household.defaultCurrency || 'USD',
        countryCode: household.countryCode || 'US',
      });
      await refreshHousehold();
      Alert.alert(
        t('appName'),
        `Added ${transactionCount} demo transactions, sample bank accounts, and Pro for testing. Open Spend to explore.`,
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

      <SectionHeader>Testing</SectionHeader>
      <Text className="mt-1 mb-2 text-sm text-ink-muted leading-5">
        Load sample spending, bank accounts, and Pro so you can try the calendar without Plaid.
      </Text>
      <SoftButton label={seeding ? 'Loading…' : 'Load demo data'} onPress={onSeedDemo} />

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
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: '#486635', false: '#e4e2e1' }}
        thumbColor="#fcfcfc"
      />
    </View>
  );
}
