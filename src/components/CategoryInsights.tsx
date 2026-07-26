import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, subMonths } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Category, Transaction } from '@/types/models';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/providers/ThemeProvider';

type Props = {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  month: Date;
  locale?: string;
};

function monthKey(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 7);
  return format(d, 'yyyy-MM');
}

function calmCompare(thisMonth: number, average: number): string {
  if (average <= 0 && thisMonth <= 0) return '';
  if (average <= 0) return 'New this month';
  const ratio = thisMonth / average;
  if (ratio < 0.85) return 'Quieter';
  if (ratio > 1.15) return 'A bit more';
  return 'About usual';
}

export function CategoryInsights({ transactions, categories, currency, month, locale }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const currentPrefix = format(month, 'yyyy-MM');

  const rows = useMemo(() => {
    const catIds = new Set(categories.map((c) => c.id));
    const byMonthCat = new Map<string, Map<string, number>>();

    for (const txn of transactions) {
      if (txn.currency !== currency) continue;
      if (!catIds.has(txn.categoryId)) continue;
      const mk = monthKey(txn.date);
      if (!byMonthCat.has(mk)) byMonthCat.set(mk, new Map());
      const m = byMonthCat.get(mk)!;
      m.set(txn.categoryId, (m.get(txn.categoryId) ?? 0) + txn.amountMinor);
    }

    const historyKeys: string[] = [];
    for (let i = 1; i <= 6; i++) {
      historyKeys.push(format(subMonths(startOfMonth(month), i), 'yyyy-MM'));
    }

    return categories
      .map((category) => {
        const thisMonth = byMonthCat.get(currentPrefix)?.get(category.id) ?? 0;
        let sum = 0;
        let monthsUsed = 0;
        for (const mk of historyKeys) {
          const amt = byMonthCat.get(mk)?.get(category.id) ?? 0;
          if (amt > 0) {
            sum += amt;
            monthsUsed += 1;
          }
        }
        const average = monthsUsed > 0 ? Math.round(sum / monthsUsed) : 0;
        return { category, thisMonth, average };
      })
      .filter((r) => r.thisMonth > 0)
      .sort((a, b) => b.thisMonth - a.thisMonth)
      .slice(0, 4);
  }, [transactions, categories, currency, month, currentPrefix]);

  if (rows.length === 0) return null;

  const maxBar = Math.max(1, ...rows.map((r) => r.thisMonth));

  return (
    <View className="mt-2">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="mt-8 flex-row items-center justify-between py-1"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
      >
        <Text className="text-xl font-medium text-ink tracking-tight">{t('insights')}</Text>
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={22}
          color={colors.inkFaint}
        />
      </Pressable>

      {open
        ? rows.map(({ category, thisMonth, average }) => {
            const compare = calmCompare(thisMonth, average);
            const width = Math.max(6, (thisMonth / maxBar) * 100);
            return (
              <View key={category.id} className="mt-4">
                <View className="mb-1 flex-row items-baseline justify-between">
                  <Text className="text-[17px] text-ink">{t(`categories.${category.nameKey}`)}</Text>
                  <Text className="text-[15px] font-medium text-ink">
                    {formatMoney(thisMonth, currency, locale)}
                  </Text>
                </View>
                {compare ? (
                  <Text className="mb-2 text-sm text-ink-muted">{compare}</Text>
                ) : null}
                <View className="h-1.5 overflow-hidden rounded-full bg-dust">
                  <View
                    className="h-1.5 rounded-full"
                    style={{ width: `${width}%`, backgroundColor: category.color }}
                  />
                </View>
              </View>
            );
          })
        : null}
    </View>
  );
}
