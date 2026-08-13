import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/AuthProvider';
import { usePremium } from '@/providers/PremiumProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useTransactions } from '@/providers/TransactionsProvider';
import { SpendingCalendar } from '@/components/SpendingCalendar';
import {
  Eyebrow,
  HeroAmount,
  SegmentedControl,
  ActivityRow,
  SectionHeader,
} from '@/components/ui';
import { CategoryInsights } from '@/components/CategoryInsights';
import { updateTransactionCategory, deleteTransaction } from '@/lib/transactions';
import { takeCalendarFocus } from '@/lib/calendarFocus';
import { atLocalNoon, fromDateKey, toDateKey } from '@/lib/localDate';
import { formatMoney } from '@/lib/money';
import type { Transaction } from '@/types/models';

export default function CalendarScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, profile, household } = useAuth();
  const { isPremium } = usePremium();
  const { colors } = useTheme();
  const { categories, visible, refresh } = useTransactions();
  const [month, setMonth] = useState(() => atLocalNoon(new Date()));
  const [selected, setSelected] = useState(() => atLocalNoon(new Date()));
  const [mode, setMode] = useState<'mine' | 'ours'>('mine');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const dateKey = takeCalendarFocus();
      if (!dateKey) return;
      const day = fromDateKey(dateKey);
      setSelected(day);
      setMonth(day);
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const onMonthChange = (next: Date) => {
    const local = atLocalNoon(next);
    if (!isPremium && local.getFullYear() < new Date().getFullYear()) return;
    setMonth(local);
  };

  const visibleTxns = visible(mode);
  const currency = household?.defaultCurrency ?? 'USD';
  const monthPrefix = format(month, 'yyyy-MM');
  const monthTotal = useMemo(() => {
    return visibleTxns
      .filter((txn) => txn.currency === currency && txn.date.startsWith(monthPrefix))
      .reduce((s, txn) => s + txn.amountMinor, 0);
  }, [visibleTxns, currency, monthPrefix]);

  const dayKey = toDateKey(selected);
  const dayTxns = visibleTxns.filter((txn) => txn.date === dayKey);
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const hasPartner = (household?.memberIds.length ?? 0) > 1;

  const recent = useMemo(() => {
    const start = format(startOfMonth(month), 'yyyy-MM-dd');
    const end = format(endOfMonth(month), 'yyyy-MM-dd');
    return visibleTxns.filter((txn) => txn.date >= start && txn.date <= end).slice(0, 12);
  }, [visibleTxns, month]);

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

  const prevDisabled =
    !isPremium &&
    month.getFullYear() === new Date().getFullYear() &&
    month.getMonth() === 0;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 48, paddingHorizontal: 24 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={colors.sage}
          colors={[colors.sage]}
        />
      }
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
          transactions={visibleTxns}
          currency={currency}
          selected={selected}
          onSelectDay={(d) => setSelected(atLocalNoon(d))}
          prevDisabled={prevDisabled}
        />
      </View>

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
                color={cat?.color ?? colors.dust}
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
                      backgroundColor: txn.categoryId === c.id ? c.color : colors.chip,
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
                color={cat?.color ?? colors.dust}
                onPress={() => setSelected(fromDateKey(txn.date))}
              />
            );
          })}
        </>
      ) : null}

      <CategoryInsights
        transactions={visibleTxns}
        categories={categories}
        currency={currency}
        month={month}
        locale={profile?.locale}
      />

      {visibleTxns.length === 0 ? (
        <Text className="mt-12 text-center text-[17px] text-ink-muted leading-7">{t('emptyCalendar')}</Text>
      ) : null}
    </ScrollView>
  );
}
