import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Text, View, Switch, ScrollView, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/AuthProvider';
import { usePremium } from '@/providers/PremiumProvider';
import { Title, Subtitle, PrimaryButton, SoftButton, GhostButton } from '@/components/ui';
import { createPlaidLinkToken, exchangePlaidPublicToken, syncPlaidTransactions } from '@/lib/plaid';
import {
  listenBankAccounts,
  listenBankConnections,
  setBankAccountHidden,
} from '@/lib/bank';
import { REGION_OPTIONS } from '@/lib/regions';
import type { BankAccount, BankConnection } from '@/types/models';

export default function BankScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, household } = useAuth();
  const { isPremium } = usePremium();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const homeCountry = household?.countryCode || 'US';
  const [linkCountries, setLinkCountries] = useState<string[]>([homeCountry]);

  useEffect(() => {
    setLinkCountries((prev) => (prev.includes(homeCountry) ? prev : [homeCountry, ...prev]));
  }, [homeCountry]);

  useEffect(() => {
    if (!household?.id) return;
    return listenBankAccounts(household.id, setAccounts);
  }, [household?.id]);

  useEffect(() => {
    if (!user) return;
    return listenBankConnections(user.uid, setConnections);
  }, [user]);

  const countryChips = useMemo(() => REGION_OPTIONS.slice(0, 12), []);

  const requirePro = () => {
    if (isPremium) return true;
    Alert.alert(t('pro'), t('proRequired'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('upgrade'), onPress: () => router.push('/pro') },
    ]);
    return false;
  };

  const toggleLinkCountry = (code: string) => {
    setLinkCountries((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  const openPlaid = async () => {
    if (!household || !requirePro()) return;
    const countryCodes = linkCountries.length ? linkCountries : [homeCountry];
    setLoading(true);
    try {
      const linkToken = await createPlaidLinkToken(countryCodes);
      const { createPlaidLinkSession } = await import('react-native-plaid-link-sdk');
      const session = await createPlaidLinkSession({
        token: linkToken,
        onSuccess: async (success) => {
          await exchangePlaidPublicToken({
            publicToken: success.publicToken,
            institutionName: success.metadata.institution?.name,
            institutionId: success.metadata.institution?.id,
            countryCode: countryCodes[0],
          });
          const { count } = await syncPlaidTransactions();
          const name = success.metadata.institution?.name ?? 'Bank';
          setStatus(`${name} connected. Imported ${count} transactions. Add another anytime.`);
        },
        onExit: (exit) => {
          if (exit.error?.displayMessage) setStatus(exit.error.displayMessage);
        },
        onEvent: () => {},
      });
      await session.open();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('errorGeneric');
      if (msg.includes('Native module') || msg.includes('ExpoModules') || Platform.OS === 'web') {
        Alert.alert(
          t('connectBank'),
          'Plaid Link needs a development build. Upgrade Firebase to Blaze, deploy Functions, set Plaid secrets, then run npx expo run:ios.',
        );
      } else {
        Alert.alert(t('appName'), msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSync = async () => {
    if (!requirePro()) return;
    setLoading(true);
    try {
      const { count } = await syncPlaidTransactions();
      setStatus(`Updated ${count} transactions across ${connections.length} bank${connections.length === 1 ? '' : 's'}.`);
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const errorConnections = connections.filter((c) => c.status === 'error');
  const accountsByConnection = (connectionId: string) =>
    accounts.filter((a) => a.connectionId === connectionId);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('connectBank'),
          headerTintColor: '#32302f',
          headerStyle: { backgroundColor: '#f9f8f7' },
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 }}
      >
        <Title>{t('connectBank')}</Title>
        <Subtitle>
          Link as many institutions as you like. Each bank is a separate connection; sync pulls from all of them.
        </Subtitle>

        <Text className="mt-6 text-sm text-ink-muted">Countries to show in Link</Text>
        <View className="mt-2 flex-row flex-wrap">
          {countryChips.map((r) => {
            const on = linkCountries.includes(r.code);
            return (
              <Pressable
                key={r.code}
                onPress={() => toggleLinkCountry(r.code)}
                className="mb-2 mr-2 rounded-full px-3.5 py-2"
                style={{ backgroundColor: on ? '#486635' : '#efece8' }}
              >
                <Text className={`text-sm ${on ? 'text-surface' : 'text-ink'}`}>{r.code}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text className="mt-1 text-sm text-ink-faint">
          Select one or more. Home region is {homeCountry}.
        </Text>

        {errorConnections.map((c) => (
          <View key={c.id} className="mt-4 rounded-[20px] bg-sage-mist px-4 py-3">
            <Text className="text-[15px] text-ink">{c.institutionName} needs attention</Text>
            <Text className="mt-1 text-sm text-ink-muted">
              {c.errorMessage ?? 'Reconnect to continue syncing.'}
            </Text>
            <Pressable className="mt-2" onPress={openPlaid}>
              <Text className="text-sm font-medium text-sage">Reconnect</Text>
            </Pressable>
          </View>
        ))}

        {connections.length > 0 ? (
          <View className="mt-6">
            <Text className="mb-2 text-xl font-medium text-ink">
              Connected ({connections.length})
            </Text>
            {connections.map((c) => (
              <View key={c.id} className="mb-4 border-b border-line pb-3">
                <Text className="text-[17px] text-ink">{c.institutionName}</Text>
                <Text className="mt-1 text-sm text-ink-muted">
                  {c.status}
                  {c.countryCode ? ` · ${c.countryCode}` : ''}
                  {c.lastSyncedAt
                    ? ` · synced ${new Date(c.lastSyncedAt).toLocaleString()}`
                    : ''}
                </Text>
                {accountsByConnection(c.id).map((a) => (
                  <View
                    key={a.id}
                    className="mt-2 flex-row items-center justify-between py-2"
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-[15px] text-ink">
                        {a.name}
                        {a.mask ? ` ··${a.mask}` : ''}
                      </Text>
                      <Text className="mt-0.5 text-xs text-ink-muted">
                        {a.isHidden ? 'Hidden from calendar' : 'Shown on calendar'}
                      </Text>
                    </View>
                    <Switch
                      value={!a.isHidden}
                      onValueChange={(v) => {
                        void setBankAccountHidden(a.id, !v).catch((e) =>
                          Alert.alert(
                            t('appName'),
                            e instanceof Error ? e.message : t('errorGeneric'),
                          ),
                        );
                      }}
                      trackColor={{ true: '#486635', false: '#e4e2e1' }}
                      thumbColor="#fcfcfc"
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <PrimaryButton
          label={connections.length ? 'Add another bank' : t('connectBank')}
          loading={loading}
          onPress={openPlaid}
        />
        {connections.length > 0 ? <SoftButton label="Sync all banks" onPress={onSync} /> : null}
        <GhostButton label="Done" onPress={() => router.back()} />
        {status ? <Text className="mt-4 text-center text-sm text-sage">{status}</Text> : null}
      </ScrollView>
    </>
  );
}
