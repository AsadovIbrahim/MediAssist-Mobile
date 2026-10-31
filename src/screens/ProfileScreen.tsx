import React from 'react';
import {
  Alert,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronRight,
  LogOut,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { Button, Card, IconTile, KeyboardScrollView } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { patientFullName, usePatient } from '../context/PatientContext';
import { colors } from '../theme';

export function ProfileScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { patient, patients } = usePatient();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <KeyboardScrollView className="flex-1 px-4 pt-3">
        <Text className="mb-4 px-1 text-2xl font-bold text-ink">Profil</Text>

        {/* Doctor card */}
        <Card className="mb-5 flex-row items-center p-4">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Text className="text-2xl font-bold text-white">
              {(user?.fullName ?? 'H').replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-[18px] font-bold text-ink">{user?.fullName}</Text>
            <Text className="mt-1 text-[14px] font-medium text-ink-muted">{user?.email}</Text>
            {!!user?.roles?.length && (
              <Text className="mt-1 text-xs font-bold text-primary uppercase">
                {user.roles.join(' • ')}
              </Text>
            )}
          </View>
        </Card>

        {/* Active patient & patient management */}
        <Text className="mb-2.5 px-1 text-[13px] font-bold uppercase text-ink-muted">
          Pasiyent idarəetməsi
        </Text>

        <Card
          onPress={() => navigation.navigate('Patients')}
          className="mb-3 flex-row items-center p-4">
          <IconTile icon={UserCheck} tint="blue" size={48} iconSize={24} variant="soft" />
          <View className="ml-3.5 flex-1">
            <Text className="text-[16px] font-bold text-ink">Seçilmiş pasiyent</Text>
            <Text className="mt-0.5 text-[14px] font-medium text-ink-muted">
              {patient ? `${patientFullName(patient)} (${patient.phone})` : 'Seçilməyib'}
            </Text>
          </View>
          <ChevronRight size={22} color={colors.textLight} />
        </Card>

        <Card
          onPress={() => navigation.navigate('Patients')}
          className="mb-3 flex-row items-center p-4">
          <IconTile icon={Users} tint="green" size={48} iconSize={24} variant="soft" />
          <View className="ml-3.5 flex-1">
            <Text className="text-[16px] font-bold text-ink">Bütün pasiyentlər</Text>
            <Text className="mt-0.5 text-[14px] font-medium text-ink-muted">
              Cəmi {patients.length} pasiyent
            </Text>
          </View>
          <ChevronRight size={22} color={colors.textLight} />
        </Card>

        <Card
          onPress={() => navigation.navigate('PatientForm')}
          className="mb-6 flex-row items-center p-4">
          <IconTile icon={UserPlus} tint="orange" size={48} iconSize={24} variant="soft" />
          <View className="ml-3.5 flex-1">
            <Text className="text-[16px] font-bold text-ink">Yeni pasiyent əlavə et</Text>
            <Text className="mt-0.5 text-[14px] font-medium text-ink-muted">
              Yeni pasiyent kartı yarat
            </Text>
          </View>
          <ChevronRight size={22} color={colors.textLight} />
        </Card>

        <Button
          label="Hesabdan çıx"
          icon={LogOut}
          variant="danger"
          size="lg"
          onPress={() =>
            Alert.alert('Çıxış', 'Hesabdan çıxmaq istədiyinizə əminsiniz?', [
              { text: 'Ləğv et', style: 'cancel' },
              { text: 'Çıx', style: 'destructive', onPress: logout },
            ])
          }
        />
      </KeyboardScrollView>
    </SafeAreaView>
  );
}
