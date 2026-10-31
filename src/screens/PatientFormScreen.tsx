import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { fileUrl } from '../api/client';
import { patientsApi } from '../api/services';
import type { LocalFile } from '../api/types';
import { Button, Field, KeyboardScrollView, ScreenHeader } from '../components/ui';
import { usePatient } from '../context/PatientContext';
import type { RootScreenProps } from '../navigation/types';
import { colors, tints } from '../theme';
import { pickImages, takePhoto } from '../utils/media';

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

  const handleCamera = async () => {
    const taken = await takePhoto();
    if (taken[0]) {
      setPhoto(taken[0]);
    }
  };

  const handleGallery = async () => {
    const picked = await pickImages(1);
    if (picked[0]) {
      setPhoto(picked[0]);
    }
  };

  const choosePhoto = () => {
    Alert.alert('Pasiyent şəkli', 'Şəkli necə əlavə etmək istəyirsiniz?', [
      { text: 'Kamera ilə çək', onPress: handleCamera },
      { text: 'Qalereyadan seç', onPress: handleGallery },
      { text: 'Ləğv et', style: 'cancel' },
    ]);
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
      navigation.navigate('PatientDashboard');
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
        <View className="mb-6 items-center self-center">
          <Pressable onPress={choosePhoto} className="items-center">
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={{ width: 96, height: 96, borderRadius: 48 }}
              />
            ) : (
              <View
                style={{ backgroundColor: tints.blue.bg }}
                className="h-24 w-24 items-center justify-center rounded-full border-2 border-line">
                <Camera size={36} color={tints.blue.fg} />
              </View>
            )}
          </Pressable>

          <View className="mt-3.5 flex-row items-center gap-3">
            <Pressable
              onPress={handleCamera}
              className="flex-row items-center rounded-2xl bg-primary-soft px-4 py-2.5 active:opacity-80">
              <Camera size={18} color={colors.primary} />
              <Text className="ml-2 text-[14px] font-bold text-primary">Kamera ilə çək</Text>
            </Pressable>
            <Pressable
              onPress={handleGallery}
              className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-2.5 active:opacity-80 shadow-sm">
              <ImageIcon size={18} color={colors.textMuted} />
              <Text className="ml-2 text-[14px] font-bold text-ink">Qalereya</Text>
            </Pressable>
          </View>
        </View>

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
          placeholder="Məsələn: 1965"
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

        <View className="mt-2 mb-8">
          <Button
            label="Yadda saxla"
            size="lg"
            loading={saving}
            onPress={onSave}
          />
        </View>
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

