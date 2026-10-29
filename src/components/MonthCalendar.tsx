import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '../theme';
import { MONTHS, WEEKDAYS, dayKey, isSameDay } from '../utils/format';

interface Props {
  /** Any date within the displayed month */
  month: Date;
  selected: Date;
  onSelect: (d: Date) => void;
  onMonthChange: (d: Date) => void;
  /** dayKey -> marker color */
  markers?: Record<string, string>;
}

/** Monday-first month grid matching the "Təqvim və müayinələr" mockup. */
export function MonthCalendar({ month, selected, onSelect, onMonthChange, markers = {} }: Props) {
  const weeks = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday = 0
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const rows: Date[][] = [];
    const cursor = new Date(start);
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let d = 0; d < 7; d++) {
        row.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      rows.push(row);
      // stop early when the next row is fully in the next month
      if (cursor.getMonth() !== month.getMonth() && w >= 4) {
        break;
      }
    }
    return rows;
  }, [month]);

  const shift = (n: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const today = new Date();

  return (
    <View className="px-3">
      <View className="mb-3 flex-row items-center justify-between px-1">
        <Pressable onPress={() => shift(-1)} hitSlop={12} className="p-1">
          <ChevronLeft size={20} color={colors.text} />
        </Pressable>
        <Text className="text-base font-semibold text-ink">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={12} className="p-1">
          <ChevronRight size={20} color={colors.text} />
        </Pressable>
      </View>

      <View className="mb-1 flex-row">
        {WEEKDAYS.map(w => (
          <Text key={w} className="flex-1 text-center text-xs font-medium text-ink-muted">
            {w}
          </Text>
        ))}
      </View>

      {weeks.map((row, i) => (
        <View key={i} className="flex-row">
          {row.map(d => {
            const inMonth = d.getMonth() === month.getMonth();
            const isSelected = isSameDay(d, selected);
            const isToday = isSameDay(d, today);
            const marker = markers[dayKey(d)];
            return (
              <Pressable
                key={d.toISOString()}
                onPress={() => onSelect(d)}
                className="h-11 flex-1 items-center justify-center">
                <View
                  className={`h-8 w-8 items-center justify-center rounded-full ${
                    isSelected ? 'bg-primary' : ''
                  }`}>
                  <Text
                    className={`text-sm ${
                      isSelected
                        ? 'font-semibold text-white'
                        : !inMonth
                          ? 'text-ink-light/60'
                          : isToday
                            ? 'font-bold text-primary'
                            : 'text-ink'
                    }`}>
                    {d.getDate()}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: marker && !isSelected ? marker : 'transparent',
                  }}
                  className="mt-0.5 h-1 w-1 rounded-full"
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

