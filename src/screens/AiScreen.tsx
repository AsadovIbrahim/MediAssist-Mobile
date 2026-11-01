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
import { useLanguage } from '../context/LanguageContext';
import { patientFullName, usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import { RECORDS, type RecordItem } from '../features/records';
import { formatDate } from '../utils/format';
import { useFocusData } from '../utils/hooks';

interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  text: string;
}

export function AiScreen() {
  const { language, t } = useLanguage();
  const { patient } = usePatient();
  const { colors } = useTheme();
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
        .map(i => `• ${i.title} (${formatDate(i.date, language)})${i.description ? ` — ${i.description}` : ''}`)
        .join('\n') || `• ${t('ai.noRecords')}`;

    const reply = [
      `${patientFullName(patient) || t('ai.notSelected')} ${t('ai.summaryPrefix')}`,
      `\n${t('record.complaints')} (${complaints.length}):\n${fmt(complaints)}`,
      `\n${t('record.diagnoses')} (${diagnoses.length}):\n${fmt(diagnoses)}`,
      `\n${t('record.treatments')} (${treatments.length}):\n${fmt(treatments)}`,
    ].join('\n');

    setMessages(prev => [
      ...prev,
      { id: `${Date.now()}-u`, role: 'user', text: trimmed },
      { id: `${Date.now()}-a`, role: 'ai', text: reply },
    ]);
    setQuestion('');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.background }} className="flex-1">
      <ScreenHeader title={t('ai.screenTitle')} />

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
                  <Text style={{ color: colors.text }} className="text-base font-bold">
                    {t('ai.cardTitle')}
                  </Text>
                  <Text style={{ color: colors.textMuted }} className="mt-0.5 text-xs">
                    {patientFullName(patient) || t('ai.notSelected')}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.textMuted }} className="mt-3 text-sm leading-5">
                {`${patientFullName(patient) || t('ai.notSelected')} (${data?.complaints.length ?? 0} ${t('record.complaints').toLowerCase()}, ${data?.diagnoses.length ?? 0} ${t('record.diagnoses').toLowerCase()}, ${data?.treatments.length ?? 0} ${t('record.treatments').toLowerCase()})`}
              </Text>

              <View className="mt-3 flex-row flex-wrap gap-2">
                {[
                  t('ai.prompt1'),
                  t('ai.prompt2'),
                  t('ai.prompt3'),
                ].map(prompt => (
                  <Pressable
                    key={prompt}
                    onPress={() => answerQuestion(prompt)}
                    style={{ backgroundColor: colors.field }}
                    className="flex-row items-center rounded-xl px-3 py-2 active:opacity-75">
                    <Sparkles size={13} color={colors.primary} />
                    <Text style={{ color: colors.text }} className="ml-1.5 text-xs font-medium">{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            {data && (
              <>
                <SummarySection
                  title={t('ai.recentComplaints')}
                  icon={FileText}
                  tint="blue"
                  items={data.complaints}
                  language={language}
                />
                <SummarySection
                  title={t('ai.recentDiagnoses')}
                  icon={Stethoscope}
                  tint="green"
                  items={data.diagnoses}
                  language={language}
                />
                <SummarySection
                  title={t('ai.recentTreatments')}
                  icon={Pill}
                  tint="orange"
                  items={data.treatments}
                  language={language}
                />
              </>
            )}

            {messages.map(m => (
              <View
                key={m.id}
                style={
                  m.role === 'user'
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }
                }
                className="mb-3 max-w-[88%] rounded-2xl p-3.5 self-start">
                <Text
                  style={{ color: m.role === 'user' ? '#ffffff' : colors.text }}
                  className="text-sm leading-5">
                  {m.text}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View
          style={{ backgroundColor: colors.surface, borderTopColor: colors.border }}
          className="flex-row items-center border-t px-4 py-2.5">
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder={t('ai.inputPlh')}
            placeholderTextColor={colors.textLight}
            style={{ backgroundColor: colors.field, color: colors.text }}
            className="mr-2 flex-1 rounded-xl px-3.5 py-2.5 text-sm"
          />
          <Pressable
            onPress={() => answerQuestion(question)}
            className="h-10 w-10 items-center justify-center rounded-xl bg-primary active:opacity-80">
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
  language,
}: {
  title: string;
  icon: typeof FileText;
  tint: 'blue' | 'green' | 'orange';
  items: RecordItem[];
  language?: string;
}) {
  const { colors } = useTheme();
  if (!items.length) {
    return null;
  }
  return (
    <Card className="mb-3 p-3.5">
      <View className="mb-2 flex-row items-center">
        <IconTile icon={icon} tint={tint} size={32} variant="soft" />
        <Text style={{ color: colors.text }} className="ml-2.5 text-sm font-bold">{title}</Text>
      </View>
      {items.slice(0, 3).map(i => (
        <View key={i.id} style={{ borderTopColor: colors.border }} className="mt-1.5 border-t pt-1.5">
          <Text style={{ color: colors.text }} className="text-sm font-medium">{i.title}</Text>
          <Text style={{ color: colors.textMuted }} className="text-xs">
            {formatDate(i.date, language)}
            {i.description ? ` • ${i.description}` : ''}
          </Text>
        </View>
      ))}
    </Card>
  );
}

