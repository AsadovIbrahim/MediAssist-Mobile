import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brain, FileText, Pill, Send, Sparkles, Stethoscope } from 'lucide-react-native';
import { Card, IconTile, KeyboardLiftView, Loading, ScreenHeader } from '../components/ui';
import { patientFullName, usePatient } from '../context/PatientContext';
import { RECORDS, type RecordItem } from '../features/records';
import { colors } from '../theme';
import { formatDate } from '../utils/format';
import { useFocusData } from '../utils/hooks';

interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  text: string;
}

export function AiScreen() {
  const { patient } = usePatient();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const { data, loading } = useFocusData(async () => {
    if (!patient) {
      return null;
    }
    const [complaints, diagnoses, treatments] = await Promise.all([
      RECORDS.complaint.api.list(patient.id),
      RECORDS.diagnosis.api.list(patient.id),
      RECORDS.treatment.api.list(patient.id),
    ]);
    return { complaints, diagnoses, treatments };
  }, [patient?.id]);

  const answerQuestion = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      return;
    }
    const complaints = data?.complaints ?? [];
    const diagnoses = data?.diagnoses ?? [];
    const treatments = data?.treatments ?? [];

    const fmt = (items: RecordItem[]) =>
      items
        .slice(0, 3)
        .map(i => `• ${i.title} (${formatDate(i.date)})${i.description ? ` — ${i.description}` : ''}`)
        .join('\n') || '• Qeyd yoxdur';

    const reply = [
      `${patientFullName(patient) || 'Pasiyent'} üzrə tibbi xülasə:`,
      `\nŞikayətlər (${complaints.length}):\n${fmt(complaints)}`,
      `\nDiaqnozlar (${diagnoses.length}):\n${fmt(diagnoses)}`,
      `\nMüalicələr (${treatments.length}):\n${fmt(treatments)}`,
    ].join('\n');

    setMessages(prev => [
      ...prev,
      { id: `${Date.now()}-u`, role: 'user', text: trimmed },
      { id: `${Date.now()}-a`, role: 'ai', text: reply },
    ]);
    setQuestion('');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <ScreenHeader title="AI köməkçi və xülasə" />

      <KeyboardLiftView>
        {loading ? (
          <Loading />
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            className="flex-1 px-4 pt-1"
            contentContainerStyle={{ paddingBottom: 24 }}>
            <Card className="mb-4 p-4">
              <View className="flex-row items-center">
                <IconTile icon={Brain} tint="purple" size={48} variant="tile" />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-bold text-ink">
                    AI Tibbi Xülasə
                  </Text>
                  <Text className="mt-0.5 text-xs text-ink-muted">
                    {patientFullName(patient) || 'Pasiyent seçilməyib'}
                  </Text>
                </View>
              </View>

              <Text className="mt-3 text-sm leading-5 text-ink-muted">
                Pasiyentin şikayətləri ({data?.complaints.length ?? 0}), diaqnoz sənədləri (
                {data?.diagnoses.length ?? 0}) və müalicə planları ({data?.treatments.length ?? 0})
                əsasında avtomatik icmal.
              </Text>

              <View className="mt-3 flex-row flex-wrap gap-2">
                {[
                  'Son şikayətləri xülasə et',
                  'Aktiv müalicə planı nədir?',
                  'Son diaqnoz nəticələri',
                ].map(prompt => (
                  <Pressable
                    key={prompt}
                    onPress={() => answerQuestion(prompt)}
                    className="flex-row items-center rounded-xl bg-field px-3 py-2">
                    <Sparkles size={13} color={colors.primary} />
                    <Text className="ml-1.5 text-xs font-medium text-ink">{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            {data && (
              <>
                <SummarySection
                  title="Son şikayətlər"
                  icon={FileText}
                  tint="blue"
                  items={data.complaints}
                />
                <SummarySection
                  title="Son diaqnozlar"
                  icon={Stethoscope}
                  tint="green"
                  items={data.diagnoses}
                />
                <SummarySection
                  title="Son müalicələr"
                  icon={Pill}
                  tint="orange"
                  items={data.treatments}
                />
              </>
            )}

            {messages.map(m => (
              <View
                key={m.id}
                className={`mb-3 max-w-[88%] rounded-2xl p-3.5 ${
                  m.role === 'user'
                    ? 'self-end bg-primary'
                    : 'self-start border border-line bg-surface'
                }`}>
                <Text
                  className={`text-sm leading-5 ${
                    m.role === 'user' ? 'text-white' : 'text-ink'
                  }`}>
                  {m.text}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View className="flex-row items-center border-t border-line bg-surface px-4 py-2.5">
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="AI-dan soruşun..."
            placeholderTextColor={colors.textLight}
            className="mr-2 flex-1 rounded-xl bg-field px-3.5 py-2.5 text-sm text-ink"
          />
          <Pressable
            onPress={() => answerQuestion(question)}
            className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Send size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardLiftView>
    </SafeAreaView>
  );
}

function SummarySection({
  title,
  icon,
  tint,
  items,
}: {
  title: string;
  icon: typeof FileText;
  tint: 'blue' | 'green' | 'orange';
  items: RecordItem[];
}) {
  if (!items.length) {
    return null;
  }
  return (
    <Card className="mb-3 p-3.5">
      <View className="mb-2 flex-row items-center">
        <IconTile icon={icon} tint={tint} size={32} variant="soft" />
        <Text className="ml-2.5 text-sm font-bold text-ink">{title}</Text>
      </View>
      {items.slice(0, 3).map(i => (
        <View key={i.id} className="mt-1.5 border-t border-line pt-1.5">
          <Text className="text-sm font-medium text-ink">{i.title}</Text>
          <Text className="text-xs text-ink-muted">
            {formatDate(i.date)}
            {i.description ? ` • ${i.description}` : ''}
          </Text>
        </View>
      ))}
    </Card>
  );
}

