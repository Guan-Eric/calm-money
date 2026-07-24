import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, Platform } from 'react-native';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { Eyebrow, Title, Label, Field, PrimaryButton } from '@/components/ui';
import {
  fetchCategories,
  suggestCategoryId,
  createManualTransaction,
  getSharingPrefs,
} from '@/lib/transactions';
import { parseAmountToMinor } from '@/lib/money';
import type { Category } from '@/types/models';

export default function AddScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, household } = useAuth();
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [dateObj, setDateObj] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const date = format(dateObj, 'yyyy-MM-dd');

  useEffect(() => {
    if (!household?.id) return;
    void fetchCategories(household.id).then((cats) => {
      setCategories(cats);
      setCategoryId(cats.find((c) => c.nameKey === 'other')?.id ?? cats[0]?.id ?? null);
    });
  }, [household?.id]);

  useEffect(() => {
    if (!user || !merchant || categories.length === 0) return;
    const handle = setTimeout(() => {
      void suggestCategoryId({ userId: user.uid, merchant, categories }).then((id) => {
        if (id) setCategoryId(id);
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [merchant, user, categories]);

  const onSave = async () => {
    if (!user || !household) return;
    const amountMinor = parseAmountToMinor(amount);
    if (amountMinor == null || amountMinor === 0) {
      Alert.alert(t('appName'), 'Enter an amount');
      return;
    }
    if (!merchant.trim()) {
      Alert.alert(t('appName'), 'What was it?');
      return;
    }
    if (!categoryId) return;
    setLoading(true);
    try {
      const prefs = await getSharingPrefs(user.uid, household.id);
      await createManualTransaction({
        householdId: household.id,
        uid: user.uid,
        amountMinor,
        currency: household.defaultCurrency,
        date,
        merchant: merchant.trim(),
        categoryId,
        note: note.trim() || undefined,
        shareTransactions: prefs?.shareTransactions ?? false,
      });
      setAmount('');
      setMerchant('');
      setNote('');
      router.push('/(tabs)/calendar');
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 48, paddingHorizontal: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Eyebrow>New</Eyebrow>
      <Title>{t('add')}</Title>
      <Text className="mt-2 text-[17px] text-ink-muted">Quick and quiet.</Text>

      <Label>{t('amount')}</Label>
      <Field
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        autoFocus
      />
      <Label>{t('merchant')}</Label>
      <Field value={merchant} onChangeText={setMerchant} placeholder="Coffee, groceries…" />
      <Label>{t('date')}</Label>
      <Pressable
        onPress={() => setShowPicker(true)}
        className="rounded-full border border-line bg-surface-raised px-5 py-4"
      >
        <Text className="text-[17px] text-ink">{format(dateObj, 'EEE, MMM d yyyy')}</Text>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            if (Platform.OS !== 'ios') setShowPicker(false);
            if (selected) setDateObj(selected);
          }}
        />
      ) : null}
      {Platform.OS === 'ios' && showPicker ? (
        <Pressable onPress={() => setShowPicker(false)} className="mt-2 items-end">
          <Text className="text-sage">Done</Text>
        </Pressable>
      ) : null}
      <Label>{t('category')}</Label>
      <View className="mt-1 flex-row flex-wrap">
        {categories.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setCategoryId(c.id)}
            className="mb-2 mr-2 rounded-full px-4 py-2.5"
            style={{
              backgroundColor: categoryId === c.id ? c.color : '#efece8',
            }}
          >
            <Text className="text-sm text-ink">{t(`categories.${c.nameKey}`)}</Text>
          </Pressable>
        ))}
      </View>
      <Label>{t('note')}</Label>
      <Field value={note} onChangeText={setNote} placeholder="Optional" />
      <PrimaryButton label={t('save')} loading={loading} onPress={onSave} />
    </ScrollView>
  );
}
