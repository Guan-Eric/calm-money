import React, { useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';
import { Screen, Title, Subtitle, PrimaryButton, SelectField } from '@/components/ui';
import { db } from '@/lib/firebase';
import {
  REGION_OPTIONS,
  CURRENCY_OPTIONS,
  defaultCurrencyForCountry,
  regionLabel,
  currencyLabel,
} from '@/lib/regions';

export default function RegionScreen() {
  const { t } = useTranslation();
  const { household, refreshHousehold } = useAuth();
  const [country, setCountry] = useState(household?.countryCode ?? 'US');
  const [currency, setCurrency] = useState(household?.defaultCurrency ?? 'USD');
  const [loading, setLoading] = useState(false);

  const countryOptions = useMemo(
    () => REGION_OPTIONS.map((r) => ({ value: r.code, label: regionLabel(r.code) })),
    [],
  );
  const currencyOptions = useMemo(() => {
    const codes = new Set(CURRENCY_OPTIONS.map((c) => c.code));
    // Ensure current value always appears even if custom
    if (currency && !codes.has(currency)) {
      return [{ value: currency, label: currency }, ...CURRENCY_OPTIONS.map((c) => ({
        value: c.code,
        label: currencyLabel(c.code),
      }))];
    }
    return CURRENCY_OPTIONS.map((c) => ({ value: c.code, label: currencyLabel(c.code) }));
  }, [currency]);

  const onCountryChange = (code: string) => {
    setCountry(code);
    setCurrency(defaultCurrencyForCountry(code));
  };

  const onSave = async () => {
    if (!household) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'households', household.id), {
        countryCode: country,
        defaultCurrency: currency,
      });
      await refreshHousehold();
      Alert.alert(t('appName'), 'Saved');
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('region'),
          headerTintColor: '#32302f',
          headerStyle: { backgroundColor: '#f9f8f7' },
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Screen className="pt-6">
        <Title>{t('region')}</Title>
        <Subtitle>Used for money formatting and which banks Plaid offers first.</Subtitle>
        <SelectField
          label={t('country')}
          value={country}
          options={countryOptions}
          onChange={onCountryChange}
        />
        <SelectField
          label={t('currency')}
          value={currency}
          options={currencyOptions}
          onChange={setCurrency}
        />
        <Text className="mt-3 text-sm text-ink-muted">
          Changing country updates the suggested currency. You can still pick another.
        </Text>
        <PrimaryButton label={t('save')} loading={loading} onPress={onSave} />
      </Screen>
    </>
  );
}
