import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { format, startOfMonth, subMonths } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Category, Transaction } from '@/types/models';
import { formatMoney } from '@/lib/money';
import { SectionHeader } from '@/components/ui';

type Props = {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  month: Date;
  locale?: string;
};

type InsightRow = {
  category: Category;
  thisMonth: number;
  average: number;
  monthsUsed: number;
};

function monthKey(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 7);
  return format(d, 'yyyy-MM');
}

function calmCompare(thisMonth: number, average: number): string {
  if (average <= 0 && thisMonth <= 0) return 'Nothing here yet';
  if (average <= 0) return 'First month with this';
  const ratio = thisMonth / average;
  if (ratio < 0.85) return 'Quieter than usual';
  if (ratio > 1.15) return 'A bit more than usual';
  return 'About usual';
}

export function CategoryInsights({ transactions, categories, currency, month, locale }: Props) {
  const { t } = useTranslation();
  const currentPrefix = format(month, 'yyyy-MM');

  const rows = useMemo(() => {
    const catIds = new Set(categories.map((c) => c.id));
    // month -> categoryId -> amount
    const byMonthCat = new Map<string, Map<string, number>>();

    for (const txn of transactions) {
      if (txn.currency !== currency) continue;
      if (!catIds.has(txn.categoryId)) continue;
      const mk = monthKey(txn.date);
      if (!byMonthCat.has(mk)) byMonthCat.set(mk, new Map());
      const m = byMonthCat.get(mk)!;
      m.set(txn.categoryId, (m.get(txn.categoryId) ?? 0) + txn.amountMinor);
    }

    // Average over up to last 6 complete months before the viewed month
    const historyKeys: string[] = [];
    for (let i = 1; i <= 6; i++) {
      historyKeys.push(format(subMonths(startOfMonth(month), i), 'yyyy-MM'));
    }

    const result: InsightRow[] = [];
    for (const category of categories) {
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
      if (thisMonth === 0 && average === 0) continue;
      result.push({ category, thisMonth, average, monthsUsed });
    }

    return result.sort((a, b) => b.thisMonth - a.thisMonth || b.average - a.average);
  }, [transactions, categories, currency, month, currentPrefix]);

  if (rows.length === 0) return null;

  const maxBar = Math.max(1, ...rows.map((r) => Math.max(r.thisMonth, r.average)));

  return (
    <View className="mt-2">
      <SectionHeader>Insights</SectionHeader>
      <Text className="mb-4 text-[15px] text-ink-muted leading-5">
        This month beside your recent monthly average — just the shape, nothing to fix.
      </Text>
      {rows.map(({ category, thisMonth, average, monthsUsed }) => {
        const label = t(`categories.${category.nameKey}`);
        const compare = calmCompare(thisMonth, average);
        const thisW = Math.max(thisMonth > 0 ? 4 : 0, (thisMonth / maxBar) * 100);
        const avgW = Math.max(average > 0 ? 4 : 0, (average / maxBar) * 100);

        return (
          <View key={category.id} className="mb-5">
            <View className="mb-1 flex-row items-baseline justify-between">
              <Text className="text-[17px] text-ink">{label}</Text>
              <Text className="text-[15px] text-ink-muted">{compare}</Text>
            </View>
            <View className="mb-2 flex-row items-baseline justify-between">
              <Text className="text-[15px] font-medium text-ink">
                {formatMoney(thisMonth, currency, locale)}
                <Text className="font-normal text-ink-muted"> this month</Text>
              </Text>
              <Text className="text-sm text-ink-faint">
                {monthsUsed > 0
                  ? `avg ${formatMoney(average, currency, locale)}`
                  : 'no prior months'}
              </Text>
            </View>
            <View className="gap-1.5">
              <View className="h-2 overflow-hidden rounded-full bg-dust">
                <View
                  className="h-2 rounded-full"
                  style={{ width: `${thisW}%`, backgroundColor: category.color }}
                />
              </View>
              <View className="h-1.5 overflow-hidden rounded-full bg-dust/70">
                <View
                  className="h-1.5 rounded-full bg-ink-faint/40"
                  style={{ width: `${avgW}%` }}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
