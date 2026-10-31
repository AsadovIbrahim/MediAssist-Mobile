import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Edit3, Trash2, UserPlus, Users } from 'lucide-react-native';
import { fileUrl } from '../api/client';
import { patientsApi } from '../api/services';
import type { Patient } from '../api/types';
import {
  AddButton,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  ScreenHeader,
  SearchBar,
} from '../components/ui';
import { patientFullName, usePatient } from '../context/PatientContext';
import type { RootScreenProps } from '../navigation/types';
import { colors, tints } from '../theme';

export function PatientsScreen({ navigation }: RootScreenProps<'Patients'>) {
  const { patients, patient: selected, loading, error, refresh, select } = usePatient();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return patients;
    }
    return patients.filter(
      p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q),
    );
  }, [patients, search]);

  const confirmDelete = (p: Patient) => {
    Alert.alert('Pasiyent silinsin?', patientFullName(p), [
      { text: 'Ləğv et', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await patientsApi.remove(p.id);
            await refresh();
          } catch (e) {
            Alert.alert('Xəta', (e as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <ScreenHeader
        title="Pasiyentlər"
        right={<AddButton onPress={() => navigation.navigate('PatientForm')} />}
      />

      <SearchBar
        placeholder="Pasiyent adı və ya telefon..."
        value={search}
        onChangeText={setSearch}
      />

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        renderItem={({ item }) => {
          const active = selected?.id === item.id;
          return (
            <Card
              onPress={async () => {
                await select(item.id);
                navigation.navigate('Tabs', { screen: 'Home' });
              }}
              className="mx-4 mb-3 flex-row items-center p-3.5">
              {item.photoUrl ? (
                <Image
                  source={{ uri: fileUrl(item.photoUrl) }}
                  style={{ width: 46, height: 46, borderRadius: 23 }}
                />
              ) : (
                <View
                  style={{ backgroundColor: tints.blue.tile }}
                  className="h-11 w-11 items-center justify-center rounded-full">
                  <Text style={{ color: tints.blue.fg }} className="text-base font-bold">
                    {item.firstName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View className="ml-3 flex-1">
                <Text className="text-[15px] font-semibold text-ink">
                  {patientFullName(item)}
                </Text>
                <Text className="mt-0.5 text-xs text-ink-muted">
                  {item.phone}
                  {item.age ? ` • ${item.age} yaş` : ''}
                </Text>
              </View>

              {active && (
                <View className="mr-2 h-7 w-7 items-center justify-center rounded-full bg-primary">
                  <Check size={15} color="#fff" />
                </View>
              )}

              <Pressable
                onPress={() => navigation.navigate('PatientForm', { id: item.id })}
                hitSlop={8}
                className="p-1.5">
                <Edit3 size={17} color={colors.textMuted} />
              </Pressable>
              <Pressable onPress={() => confirmDelete(item)} hitSlop={8} className="p-1.5">
                <Trash2 size={17} color={colors.textMuted} />
              </Pressable>
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={Users}
            title="Pasiyent yoxdur"
            text="Yeni pasiyent əlavə edərək tibbi qeydləri idarə edin."
            action={
              <Button
                label="Pasiyent əlavə et"
                icon={UserPlus}
                onPress={() => navigation.navigate('PatientForm')}
              />
            }
          />
        }
      />
    </SafeAreaView>
  );
}

