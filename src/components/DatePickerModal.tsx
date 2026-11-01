import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { MonthCalendar } from './MonthCalendar';
import { Button } from './ui';

export function DatePickerModal({
  visible,
  value,
  onClose,
  onChange,
}: {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onChange: (d: Date) => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [month, setMonth] = useState(value);
  const [selected, setSelected] = useState(value);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={() => {
        setMonth(value);
        setSelected(value);
      }}
      onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View
        style={{
          paddingBottom: Math.max(insets.bottom, 16) + 12,
          backgroundColor: colors.surface,
        }}
        className="rounded-t-3xl pt-5">
        <Text style={{ color: colors.text }} className="mb-4 text-center text-base font-semibold">{t('datePicker.selectDate')}</Text>
        <MonthCalendar
          month={month}
          selected={selected}
          onSelect={setSelected}
          onMonthChange={setMonth}
        />
        <View className="mt-4 flex-row gap-3 px-5">
          <Button label={t('common.cancel')} variant="soft" className="flex-1" onPress={onClose} />
          <Button
            label={t('datePicker.select')}
            className="flex-1"
            onPress={() => {
              const d = new Date(value);
              d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
              onChange(d);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

