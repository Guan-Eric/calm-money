import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/AuthProvider';
import { usePremium } from '@/providers/PremiumProvider';
import { SpendingCalendar } from '@/components/SpendingCalendar';
import {
  Eyebrow,
  HeroAmount,
  SegmentedControl,
  ActivityRow,
  SectionHeader,
} from '@/components/ui';
import { CategoryInsights } from '@/components/CategoryInsights';
import {
  fetchCategories,
  listenTransactions,
  filterVisibleTransactions,
  updateTransactionCategory,
  deleteTransaction,
  getSharingPrefs,
} from '@/lib/transactions';
import { listenBankAccounts } from '@/lib/bank';
import { formatMoney } from '@/lib/money';
import type { Category, Transaction, SharingPrefs } from '@/types/models';

export default function CalendarScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, profile, household } = useAuth();
  const { isPremium } = usePremium();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [mode, setMode] = useState<'mine' | 'ours'>('mine');
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [partnerSharing, setPartnerSharing] = useState<SharingPrefs | null>(null);
  const [hiddenAccountIds, setHiddenAccountIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!household?.id) return;
    void fetchCategories(household.id).then(setCategories);
  }, [household?.id]);

  useEffect(() => {
    if (!household?.id || !user) return;
    const unsub = listenTransactions({
      householdId: household.id,
      isPremium,
      onData: setTxns,
      onError: (e) => console.warn(e),
    });
    return unsub;
  }, [household?.id, user, isPremium]);

  useEffect(() => {
    if (!household?.id) return;
    return listenBankAccounts(household.id, (accounts) => {
      setHiddenAccountIds(new Set(accounts.filter((a) => a.isHidden).map((a) => a.id)));
    });
  }, [household?.id]);

  useEffect(() => {
    if (!household || !user) return;
    const partnerId = household.memberIds.find((id) => id !== user.uid);
    if (!partnerId) {
      setPartnerSharing(null);
      return;
    }
    void getSharingPrefs(partnerId, household.id).then(setPartnerSharing);
  }, [household, user]);

  const visible = useMemo(() => {
    if (!user) return [];
    return filterVisibleTransactions({
      txns,
      uid: user.uid,
      mode,
      partnerSharing,
      hiddenAccountIds,
    });
  }, [txns, user, mode, partnerSharing, hiddenAccountIds]);

  const onMonthChange = (next: Date) => {
    if (!isPremium && next.getFullYear() < new Date().getFullYear()) {
      return;
    }
    setMonth(next);
  };

  const currency = household?.defaultCurrency ?? 'USD';
  const monthPrefix = format(month, 'yyyy-MM');
  const monthTotal = useMemo(() => {
    return visible
      .filter((t) => t.currency === currency && t.date.startsWith(monthPrefix))
      .reduce((s, t) => s + t.amountMinor, 0);
  }, [visible, currency, monthPrefix]);

  const dayKey = format(selected, 'yyyy-MM-dd');
  const dayTxns = visible.filter((t) => t.date === dayKey);
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const hasPartner = (household?.memberIds.length ?? 0) > 1;

  const recent = useMemo(() => {
    const start = format(startOfMonth(month), 'yyyy-MM-dd');
    const end = format(endOfMonth(month), 'yyyy-MM-dd');
    return visible
      .filter((t) => t.date >= start && t.date <= end)
      .slice(0, 12);
  }, [visible, month]);

  const onChangeCategory = async (txn: Transaction, categoryId: string) => {
    if (!user || !household) return;
    try {
      await updateTransactionCategory({
        transactionId: txn.id,
        categoryId,
        userId: user.uid,
        merchant: txn.merchant,
        householdId: household.id,
      });
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 48, paddingHorizontal: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Eyebrow>{t('monthTotal')}</Eyebrow>
      <HeroAmount>{formatMoney(monthTotal, currency, profile?.locale)}</HeroAmount>
      <Text className="mt-1 text-[15px] text-ink-muted">{format(month, 'MMMM yyyy')}</Text>

      {hasPartner ? (
        <SegmentedControl
          value={mode}
          onChange={(k) => setMode(k as 'mine' | 'ours')}
          options={[
            { key: 'mine', label: t('mine') },
            { key: 'ours', label: t('ours') },
          ]}
        />
      ) : null}

      <View className="mt-8 rounded-[28px] bg-surface-raised px-4 py-5">
        <SpendingCalendar
          month={month}
          onMonthChange={onMonthChange}
          transactions={visible}
          currency={currency}
          selected={selected}
          onSelectDay={setSelected}
        />
      </View>

      <CategoryInsights
        transactions={visible}
        categories={categories}
        currency={currency}
        month={month}
        locale={profile?.locale}
      />

      {!isPremium ? (
        <Text className="mt-4 text-sm text-ink-faint">
          Free includes this year’s spending. Pro unlocks longer history.
        </Text>
      ) : null}

      <SectionHeader>{format(selected, 'EEEE, MMM d')}</SectionHeader>
      {dayTxns.length === 0 ? (
        <Text className="mt-3 text-[17px] text-ink-muted leading-6">{t('emptyDay')}</Text>
      ) : (
        dayTxns.map((txn) => {
          const cat = catMap[txn.categoryId];
          return (
            <View key={txn.id}>
              <ActivityRow
                title={txn.merchant}
                subtitle={
                  (txn.source === 'bank' ? t('synced') : t('youAdded')) +
                  (cat ? ` · ${t(`categories.${cat.nameKey}`)}` : '')
                }
                amount={formatMoney(txn.amountMinor, txn.currency, profile?.locale)}
                color={cat?.color ?? '#e4e2e1'}
                onPress={() => {
                  if (txn.createdBy !== user?.uid) return;
                  Alert.alert(txn.merchant, undefined, [
                    { text: t('cancel'), style: 'cancel' },
                    {
                      text: t('delete'),
                      style: 'destructive',
                      onPress: () => void deleteTransaction(txn.id),
                    },
                  ]);
                }}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => void onChangeCategory(txn, c.id)}
                    className="mr-2 rounded-full px-3.5 py-2"
                    style={{
                      backgroundColor: txn.categoryId === c.id ? c.color : '#efece8',
                    }}
                  >
                    <Text className="text-xs text-ink">{t(`categories.${c.nameKey}`)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          );
        })
      )}

      {recent.length > 0 && dayTxns.length === 0 ? (
        <>
          <SectionHeader>Activity</SectionHeader>
          {recent.map((txn) => {
            const cat = catMap[txn.categoryId];
            return (
              <ActivityRow
                key={`recent-${txn.id}`}
                title={txn.merchant}
                subtitle={txn.date}
                amount={formatMoney(txn.amountMinor, txn.currency, profile?.locale)}
                color={cat?.color ?? '#e4e2e1'}
                onPress={() => setSelected(new Date(txn.date + 'T12:00:00'))}
              />
            );
          })}
        </>
      ) : null}

      {visible.length === 0 ? (
        <Text className="mt-12 text-center text-[17px] text-ink-muted leading-7">{t('emptyCalendar')}</Text>
      ) : null}
    </ScrollView>
  );
}
