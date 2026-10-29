import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'lucide-react-native';
import { fileUrl } from '../api/client';
import { patientsApi } from '../api/services';
import type { LocalFile } from '../api/types';
import { Button, Field, KeyboardScrollView, ScreenHeader } from '../components/ui';
import { usePatient } from '../context/PatientContext';
import type { RootScreenProps } from '../navigation/types';
import { tints } from '../theme';
import { pickImages } from '../utils/media';

export function PatientFormScreen({ navigation, route }: RootScreenProps<'PatientForm'>) {
  const editId = route.params?.id;
  const { patients, refresh, select } = usePatient();
  const existing = patients.find(p => p.id === editId);

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [birthYear, setBirthYear] = useState(
    existing?.dateOfBirth ? String(new Date(existing.dateOfBirth).getFullYear()) : '',
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setFirstName(existing.firstName);
      setLastName(existing.lastName);
      setPhone(existing.phone);
      setNote(existing.note ?? '');
    }
  }, [existing]);

  const choosePhoto = async () => {
    const picked = await pickImages(1);
    if (picked[0]) {
      setPhoto(picked[0]);
    }
  };

  const onSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      Alert.alert('Diqqət', 'Ad, soyad və telefon nömrəsini daxil edin.');
      return;
    }
    const year = Number(birthYear);
    const dateOfBirth =
      birthYear.trim() && year > 1900 && year <= new Date().getFullYear()
        ? `${year}-01-01T00:00:00`
        : null;

    setSaving(true);
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        dateOfBirth,
        note: note.trim() || null,
      };
      const saved = editId
        ? await patientsApi.update(editId, payload)
        : await patientsApi.create(payload);

      if (photo) {
        try {
          await patientsApi.uploadPhoto(saved.id, photo);
        } catch {
          // non-fatal
        }
      }

      await refresh();
      await select(saved.id);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Xəta', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const previewUri = photo?.uri ?? fileUrl(existing?.photoUrl);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <ScreenHeader
        title={editId ? 'Pasiyenti redaktə et' : 'Yeni pasiyent'}
        right={<Button label="Saxla" size="sm" loading={saving} onPress={onSave} />}
      />

      <KeyboardScrollView className="flex-1 px-4 pt-3">
        <Pressable onPress={choosePhoto} className="mb-5 items-center self-center">
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={{ width: 84, height: 84, borderRadius: 42 }}
            />
          ) : (
            <View
              style={{ backgroundColor: tints.blue.bg }}
              className="h-20 w-20 items-center justify-center rounded-full">
              <Camera size={28} color={tints.blue.fg} />
            </View>
          )}
          <Text className="mt-2 text-xs font-semibold text-primary">Şəkil seç</Text>
        </Pressable>

        <Field
          label="Ad *"
          placeholder="Pasiyentin adını daxil edin"
          value={firstName}
          onChangeText={setFirstName}
        />
        <Field
          label="Soyad *"
          placeholder="Pasiyentin soyadını daxil edin"
          value={lastName}
          onChangeText={setLastName}
        />
        <Field
          label="Telefon *"
          placeholder="+994 XX XXX XX XX"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Field
          label="Doğum ili"
          placeholder="Doğum ilini daxil edin"
          keyboardType="number-pad"
          value={birthYear}
          onChangeText={setBirthYear}
        />
        <Field
          label="Qeyd"
          placeholder="Əlavə məlumat, allergiyalar..."
          multiline
          value={note}
          onChangeText={setNote}
        />
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

