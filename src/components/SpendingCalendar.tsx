import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import type { Transaction } from '@/types/models';

type Props = {
  month: Date;
  onMonthChange: (d: Date) => void;
  transactions: Transaction[];
  currency: string;
  selected: Date;
  onSelectDay: (d: Date) => void;
  prevDisabled?: boolean;
};

export function SpendingCalendar({
  month,
  onMonthChange,
  transactions,
  currency,
  selected,
  onSelectDay,
  prevDisabled,
}: Props) {
  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.currency !== currency) continue;
      map.set(t.date, (map.get(t.date) ?? 0) + t.amountMinor);
    }
    return map;
  }, [transactions, currency]);

  const max = Math.max(1, ...byDay.values());
  const weekPad = startOfMonth(month).getDay();

  return (
    <View>
      <View className="mb-5 flex-row items-center justify-between">
        <Pressable
          disabled={prevDisabled}
          onPress={() => onMonthChange(subMonths(month, 1))}
          className={`h-10 w-10 items-center justify-center rounded-full bg-dust ${
            prevDisabled ? 'opacity-30' : ''
          }`}
        >
          <Text className="text-lg text-ink">‹</Text>
        </Pressable>
        <Text className="text-base font-medium text-ink">{format(month, 'MMMM yyyy')}</Text>
        <Pressable
          onPress={() => onMonthChange(addMonths(month, 1))}
          className="h-10 w-10 items-center justify-center rounded-full bg-dust"
        >
          <Text className="text-lg text-ink">›</Text>
        </Pressable>
      </View>

      <View className="mb-2 flex-row">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={`${d}-${i}`} className="flex-1 text-center text-[11px] text-ink-faint">
            {d}
          </Text>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {Array.from({ length: weekPad }).map((_, i) => (
          <View key={`pad-${i}`} className="h-12 w-[14.28%]" />
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const spend = byDay.get(key) ?? 0;
          const intensity = spend / max;
          const selectedDay = isSameDay(day, selected);
          const bg =
            spend === 0
              ? 'bg-transparent'
              : intensity > 0.66
                ? 'bg-sage/35'
                : intensity > 0.33
                  ? 'bg-sage/20'
                  : 'bg-sage/10';
          return (
            <Pressable
              key={key}
              onPress={() => onSelectDay(day)}
              className={`h-12 w-[14.28%] items-center justify-center rounded-full ${bg} ${
                selectedDay ? 'bg-ink' : ''
              }`}
            >
              <Text
                className={`text-sm ${
                  selectedDay
                    ? 'font-medium text-surface'
                    : isSameMonth(day, month)
                      ? 'text-ink'
                      : 'text-ink-faint'
                }`}
              >
                {format(day, 'd')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
