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
import { Button, Field, KeyboardScrollView, PhoneField, ScreenHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import type { RootScreenProps } from '../navigation/types';
import { pickImages, takePhoto } from '../utils/media';

export function PatientFormScreen({ navigation, route }: RootScreenProps<'PatientForm'>) {
  const editId = route.params?.id;
  const { t } = useLanguage();
  const { colors, tints } = useTheme();
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
    Alert.alert(t('patient.photoTitle'), t('patient.photoPrompt'), [
      { text: t('patient.takePhoto'), onPress: handleCamera },
      { text: t('patient.chooseGallery'), onPress: handleGallery },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const onSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      Alert.alert(t('common.attention'), t('patient.requiredError'));
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
        ? await patientsApi.update(editId, payload, photo ?? undefined)
        : await patientsApi.create(payload, photo ?? undefined);

      if (photo && !saved.id.startsWith('local_')) {
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
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const previewUri = photo?.uri ?? fileUrl(existing?.photoUrl);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.background }} className="flex-1">
      <ScreenHeader title={editId ? t('patient.editPatient') : t('patient.newPatient')} />

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
                style={{ backgroundColor: tints.blue.bg, borderColor: colors.border }}
                className="h-24 w-24 items-center justify-center rounded-full border-2">
                <Camera size={36} color={tints.blue.fg} />
              </View>
            )}
          </Pressable>

          <View className="mt-3.5 flex-row items-center gap-3">
            <Pressable
              onPress={handleCamera}
              style={{ backgroundColor: colors.primarySoft }}
              className="flex-row items-center rounded-2xl px-4 py-2.5 active:opacity-80">
              <Camera size={18} color={colors.primary} />
              <Text className="ml-2 text-[14px] font-bold text-primary">{t('patient.takePhoto')}</Text>
            </Pressable>
            <Pressable
              onPress={handleGallery}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="flex-row items-center rounded-2xl border px-4 py-2.5 active:opacity-80 shadow-sm">
              <ImageIcon size={18} color={colors.textMuted} />
              <Text style={{ color: colors.text }} className="ml-2 text-[14px] font-bold">{t('patient.gallery')}</Text>
            </Pressable>
          </View>
        </View>

        <Field
          label={t('patient.firstName')}
          placeholder={t('patient.firstNamePlh')}
          value={firstName}
          onChangeText={setFirstName}
        />
        <Field
          label={t('patient.lastName')}
          placeholder={t('patient.lastNamePlh')}
          value={lastName}
          onChangeText={setLastName}
        />
        <PhoneField
          label={t('patient.phone')}
          value={phone}
          onChangeText={setPhone}
        />
        <Field
          label={t('patient.birthYear')}
          placeholder={t('patient.birthYearPlh')}
          keyboardType="number-pad"
          value={birthYear}
          onChangeText={setBirthYear}
        />
        <Field
          label={t('patient.note')}
          placeholder={t('patient.notePlh')}
          multiline
          value={note}
          onChangeText={setNote}
        />

        <View className="mt-2 mb-8">
          <Button
            label={t('common.save')}
            size="lg"
            loading={saving}
            onPress={onSave}
          />
        </View>
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

