import React, { useEffect, useState } from 'react';
import { Alert, Text, View, Share, Pressable } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';
import { usePremium } from '@/providers/PremiumProvider';
import { useTheme } from '@/providers/ThemeProvider';
import {
  Screen,
  Title,
  Subtitle,
  Label,
  Field,
  PrimaryButton,
  GhostButton,
  SoftButton,
  ThemedSwitch,
} from '@/components/ui';
import { stackHeaderOptions } from '@/theme/native';
import {
  createInvite,
  acceptInvite,
  leaveHousehold,
  revokeInvite,
  getPendingInviteForHousehold,
} from '@/lib/sharing';
import { getSharingPrefs, setShareTransactions } from '@/lib/transactions';
import { db } from '@/lib/firebase';

export default function SharingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { user, household, profile, refreshHousehold } = useAuth();
  const { isPremium } = usePremium();
  const { resolvedTheme } = useTheme();
  const header = stackHeaderOptions(resolvedTheme);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [share, setShare] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [loading, setLoading] = useState(false);

  const hasPartner = (household?.memberIds.length ?? 0) > 1;

  useEffect(() => {
    if (typeof params.code === 'string' && params.code) {
      setJoinCode(params.code.toUpperCase());
    }
  }, [params.code]);

  useEffect(() => {
    if (!user || !household) return;
    void getSharingPrefs(user.uid, household.id).then((p) => {
      setShare(p?.shareTransactions ?? false);
      if (p?.displayNameInHousehold) setDisplayName(p.displayNameInHousehold);
    });
    void getPendingInviteForHousehold(household.id, user.uid).then((inv) => {
      if (inv) {
        setInviteCode(inv.code);
        setDeepLink(`calmmoney://invite?code=${inv.code}`);
      }
    });
  }, [user, household]);

  const requirePro = () => {
    if (isPremium) return true;
    Alert.alert(t('pro'), t('proRequired'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('upgrade'), onPress: () => router.push('/pro') },
    ]);
    return false;
  };

  const onInvite = async () => {
    if (!user || !household || !requirePro()) return;
    setLoading(true);
    try {
      const inv = await createInvite({ householdId: household.id, createdBy: user.uid });
      setInviteCode(inv.code);
      setDeepLink(inv.deepLink ?? `calmmoney://invite?code=${inv.code}`);
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const onRevoke = async () => {
    setLoading(true);
    try {
      await revokeInvite();
      setInviteCode(null);
      setDeepLink(null);
      Alert.alert(t('appName'), 'Invite revoked');
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const onShareLink = async () => {
    if (!deepLink || !inviteCode) return;
    await Share.share({
      message: `Join me on Tally. Code ${inviteCode} or open ${deepLink}`,
    });
  };

  const onJoin = async () => {
    if (!user || !household || !requirePro()) return;
    setLoading(true);
    try {
      await acceptInvite({
        code: joinCode.trim(),
        uid: user.uid,
        currentHouseholdId: household.id,
      });
      await refreshHousehold();
      Alert.alert(t('appName'), t('partnerJoined'));
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const onToggleShare = async (value: boolean) => {
    if (!user || !household) return;
    setShare(value);
    try {
      await setShareTransactions({
        userId: user.uid,
        householdId: household.id,
        share: value,
      });
    } catch (e) {
      setShare(!value);
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    }
  };

  const onSaveDisplayName = async () => {
    if (!user || !household) return;
    const name = displayName.trim() || null;
    const prefId = `${user.uid}_${household.id}`;
    try {
      await setDoc(
        doc(db, 'sharingPrefs', prefId),
        {
          id: prefId,
          userId: user.uid,
          householdId: household.id,
          displayNameInHousehold: name,
          shareTransactions: share,
          shareAccountIds: [],
        },
        { merge: true },
      );
      await setDoc(doc(db, 'users', user.uid), { displayName: name }, { merge: true });
      Alert.alert(t('appName'), 'Saved');
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('sharing'),
          ...header,
        }}
      />
      <Screen className="pt-6">
        <View>
          <Title>{t('sharing')}</Title>
          <Subtitle>{t('sharingIntro')}</Subtitle>

          <Label>Display name</Label>
          <Field value={displayName} onChangeText={setDisplayName} placeholder="How your partner sees you" />
          <SoftButton label="Save name" onPress={onSaveDisplayName} />

          {hasPartner ? (
            <View className="mt-6 flex-row items-center justify-between border-b border-line py-4">
              <Text className="mr-3 flex-1 text-[17px] text-ink">{t('shareMyTransactions')}</Text>
              <ThemedSwitch value={share} onValueChange={(v) => void onToggleShare(v)} />
            </View>
          ) : (
            <Text className="mt-6 text-[17px] text-ink-muted">{t('waitingOnPartner')}</Text>
          )}

          {!hasPartner ? (
            <>
              <PrimaryButton label={t('invitePartner')} loading={loading} onPress={onInvite} />
              {inviteCode ? (
                <>
                  <Text className="mt-4 text-center text-2xl font-medium tracking-widest text-sage">
                    {inviteCode}
                  </Text>
                  <Pressable onPress={onShareLink} className="mt-2">
                    <Text className="text-center text-sm text-ink-soft">Share invite link</Text>
                  </Pressable>
                  <GhostButton label="Revoke invite" onPress={onRevoke} />
                </>
              ) : null}
              <Label>{t('enterCode')}</Label>
              <Field
                value={joinCode}
                onChangeText={setJoinCode}
                autoCapitalize="characters"
                placeholder="ABC123"
              />
              <PrimaryButton label={t('join')} loading={loading} onPress={onJoin} />
            </>
          ) : (
            <GhostButton
              label={t('leaveHousehold')}
              onPress={() => {
                if (!user || !household) return;
                Alert.alert(t('leaveHousehold'), 'You will go back to a solo household with fresh categories.', [
                  { text: t('cancel'), style: 'cancel' },
                  {
                    text: t('leaveHousehold'),
                    onPress: () => {
                      void leaveHousehold({ uid: user.uid, householdId: household.id }).then(() =>
                        refreshHousehold(),
                      );
                    },
                  },
                ]);
              }}
            />
          )}
        </View>
      </Screen>
    </>
  );
}
