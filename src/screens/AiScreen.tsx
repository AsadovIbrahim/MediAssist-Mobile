import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Brain,
  FileText,
  FlaskConical,
  Pill,
  RotateCcw,
  Send,
  Sparkles,
  Stethoscope,
} from 'lucide-react-native';
import { Card, IconTile, KeyboardLiftView, Loading, ScreenHeader, useKeyboard } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { patientFullName, usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import { RECORDS, type RecordItem } from '../features/records';
import { appointmentsApi } from '../api/services';
import type { Appointment } from '../api/types';
import {
  runLocalClinicalEngine,
  type AiChatMessage,
  type AiRecordItem,
} from '../api/ai';
import { formatDate } from '../utils/format';
import { useFocusData } from '../utils/hooks';

type ScrollNode = React.ComponentRef<typeof ScrollView>;

export function AiScreen() {
  const insets = useSafeAreaInsets();
  const { keyboardHeight } = useKeyboard();
  const { language, t } = useLanguage();
  const { patient } = usePatient();
  const { colors } = useTheme();

  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);

  const chatStorageKey = `mediassist.ai.chat.${patient?.id || 'general'}`;
  const isLoadedRef = useRef(false);

  // Load chat history for current patient
  useEffect(() => {
    isLoadedRef.current = false;
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(chatStorageKey);
        if (raw && active) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
            isLoadedRef.current = true;
            return;
          }
        }
      } catch {}
      if (active) {
        setMessages([]);
        isLoadedRef.current = true;
      }
    })();
    return () => {
      active = false;
    };
  }, [chatStorageKey]);

  // Persist chat messages whenever they change
  useEffect(() => {
    if (!isLoadedRef.current) return;
    (async () => {
      try {
        if (messages.length > 0) {
          await AsyncStorage.setItem(chatStorageKey, JSON.stringify(messages));
        } else {
          await AsyncStorage.removeItem(chatStorageKey);
        }
      } catch {}
    })();
  }, [messages, chatStorageKey]);

  const scrollRef = useRef<ScrollNode>(null);

  // Fetch patient records and appointments
  const { data, loading } = useFocusData(async () => {
    if (!patient) {
      return null;
    }
    const [complaints, examinations, diagnoses, treatments, appointments] = await Promise.all([
      RECORDS.complaint.api.list(patient.id).catch(() => [] as RecordItem[]),
      RECORDS.examination.api.list(patient.id).catch(() => [] as RecordItem[]),
      RECORDS.diagnosis.api.list(patient.id).catch(() => [] as RecordItem[]),
      RECORDS.treatment.api.list(patient.id).catch(() => [] as RecordItem[]),
      appointmentsApi.list(patient.id).catch(() => [] as Appointment[]),
    ]);
    return { complaints, examinations, diagnoses, treatments, appointments };
  }, [patient?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const handleSend = (customPrompt?: string) => {
    const promptText = (customPrompt ?? question).trim();
    if (!promptText || thinking) {
      return;
    }

    const userMsg: AiChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: promptText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setQuestion('');
    setThinking(true);
    scrollToBottom();

    const complaints: RecordItem[] = data?.complaints ?? [];
    const examinations: RecordItem[] = data?.examinations ?? [];
    const diagnoses: RecordItem[] = data?.diagnoses ?? [];
    const treatments: RecordItem[] = data?.treatments ?? [];
    const appointments: Appointment[] = data?.appointments ?? [];

    const recordsPayload: AiRecordItem[] = [
      ...complaints.map(c => ({
        id: c.id,
        type: 'complaint' as const,
        title: c.title,
        description: c.description,
        date: formatDate(c.date, language),
        categoryOrKind: c.kind,
      })),
      ...examinations.map(ex => ({
        id: ex.id,
        type: 'examination' as const,
        title: ex.title,
        description: ex.description,
        date: formatDate(ex.date, language),
        categoryOrKind: ex.kind,
      })),
      ...diagnoses.map(d => ({
        id: d.id,
        type: 'diagnosis' as const,
        title: d.title,
        description: d.description,
        date: formatDate(d.date, language),
        categoryOrKind: d.kind,
      })),
      ...treatments.map(tr => ({
        id: tr.id,
        type: 'treatment' as const,
        title: tr.title,
        description: tr.description,
        date: formatDate(tr.date, language),
        categoryOrKind: tr.kind,
      })),
      ...appointments.map(a => ({
        id: a.id,
        type: 'appointment' as const,
        title: a.title,
        description: a.notes,
        date: formatDate(a.dateTime, language),
        categoryOrKind: a.type,
      })),
    ];

    // Execute internal clinical intelligence
    const clinicalSummary = runLocalClinicalEngine(
      patient
        ? {
            id: patient.id,
            name: patientFullName(patient),
            age: patient.age,
            phone: patient.phone,
            note: patient.note,
          }
        : null,
      recordsPayload,
      promptText,
      language,
    );

    // Quick natural transition for UX
    setTimeout(() => {
      const aiMsg: AiChatMessage = {
        id: `${Date.now()}-ai`,
        role: 'ai',
        text: clinicalSummary,
        provider: 'offline',
        model: 'MediAssist AI',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setThinking(false);
      scrollToBottom();
    }, 250);
  };

  const handleClearChat = () => {
    Alert.alert(
      t('ai.clearChat'),
      t('ai.clearChatConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setMessages([]);
            try {
              await AsyncStorage.removeItem(chatStorageKey);
            } catch {}
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }} className="flex-1">
      <ScreenHeader
        title={t('ai.screenTitle')}
        right={
          messages.length > 0 ? (
            <Pressable
              onPress={handleClearChat}
              hitSlop={10}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="h-10 w-10 items-center justify-center rounded-2xl border active:opacity-70 shadow-sm">
              <RotateCcw size={18} color={colors.textMuted} />
            </Pressable>
          ) : undefined
        }
      />

      <KeyboardLiftView fullBottom>
        {loading ? (
          <Loading />
        ) : (
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            className="flex-1 px-4 pt-1"
            contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Top Patient Summary & Action Card */}
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
                {`${patientFullName(patient) || t('ai.notSelected')} (${data?.complaints.length ?? 0} ${t('ai.complaints')}, ${data?.examinations.length ?? 0} ${t('ai.examinations')}, ${data?.diagnoses.length ?? 0} ${t('ai.diagnoses')}, ${data?.treatments.length ?? 0} ${t('ai.treatments')}${data?.appointments?.length ? `, ${data.appointments.length} ${t('ai.appointments')}` : ''})`}
              </Text>

              {/* Quick AI Action Prompt Chips */}
              <View className="mt-3 flex-row flex-wrap gap-2">
                {[
                  { text: t('ai.prompt1') },
                  { text: t('ai.promptExam') },
                  { text: t('ai.prompt2') },
                  { text: t('ai.prompt3') },
                  { text: t('ai.prompt4') },
                ].map(prompt => (
                  <Pressable
                    key={prompt.text}
                    disabled={thinking}
                    onPress={() => handleSend(prompt.text)}
                    style={{ backgroundColor: colors.field }}
                    className="flex-row items-center rounded-xl px-3 py-2 active:opacity-75">
                    <Sparkles size={13} color={colors.primary} />
                    <Text style={{ color: colors.text }} className="ml-1.5 text-xs font-medium">
                      {prompt.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            {/* Static Summary Sections (Shown when no chat messages yet) */}
            {messages.length === 0 && data && (
              <>
                <SummarySection
                  title={t('ai.recentComplaints')}
                  icon={FileText}
                  tint="blue"
                  items={data.complaints}
                  language={language}
                />
                <SummarySection
                  title={t('ai.recentExaminations')}
                  icon={FlaskConical}
                  tint="purple"
                  items={data.examinations}
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

            {/* Active Dialogue Message Bubbles */}
            {messages.map(m => (
              <View
                key={m.id}
                style={
                  m.role === 'user'
                    ? {
                        backgroundColor: colors.primary,
                        alignSelf: 'flex-end',
                      }
                    : {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                        alignSelf: 'flex-start',
                        width: '100%',
                      }
                }
                className="mb-3 max-w-[92%] rounded-2xl p-4 shadow-sm">
                {m.role === 'ai' && (
                  <View
                    className="mb-2 flex-row items-center border-b pb-2"
                    style={{ borderBottomColor: colors.border }}>
                    <Sparkles size={14} color={colors.primary} />
                    <Text style={{ color: colors.primary }} className="ml-1.5 text-xs font-bold">
                      MediAssist AI
                    </Text>
                  </View>
                )}

                {m.role === 'user' ? (
                  <Text
                    selectable
                    style={{ color: '#ffffff' }}
                    className="text-sm font-medium leading-5">
                    {m.text}
                  </Text>
                ) : (
                  <FormattedAiText text={m.text} color={colors.text} />
                )}
              </View>
            ))}

            {/* Thinking / Analyzing Indicator */}
            {thinking && (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                className="mb-3 flex-row items-center self-start rounded-2xl px-4 py-3 shadow-sm">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textMuted }} className="ml-2.5 text-xs font-medium">
                  {t('ai.thinking')}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Bottom Chat Input Bar */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingTop: 10,
            paddingBottom: keyboardHeight > 0 ? 10 : Math.max(insets.bottom, 10),
          }}
          className="flex-row items-center border-t px-4">
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder={t('ai.inputPlh')}
            placeholderTextColor={colors.textLight}
            editable={!thinking}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
            style={{ backgroundColor: colors.field, color: colors.text }}
            className="mr-2 flex-1 rounded-xl px-3.5 py-2.5 text-sm"
          />
          <Pressable
            disabled={thinking || !question.trim()}
            onPress={() => handleSend()}
            style={{
              backgroundColor:
                question.trim() && !thinking ? colors.primary : colors.field,
              opacity: question.trim() && !thinking ? 1 : 0.6,
            }}
            className="h-10 w-10 items-center justify-center rounded-xl active:opacity-80">
            {thinking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={18} color={question.trim() ? '#fff' : colors.textMuted} />
            )}
          </Pressable>
        </View>
      </KeyboardLiftView>
    </SafeAreaView>
  );
}

/**
 * Text formatter that renders bold (**text**), bullet points, and headers with clean styling.
 */
function FormattedAiText({ text, color }: { text: string; color: string }) {
  const lines = text.split('\n');

  return (
    <View className="space-y-1">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={lineIdx} className="h-1.5" />;
        }

        const isDivider = /^[-*_]{3,}$/.test(trimmed);
        if (isDivider) {
          return (
            <View
              key={lineIdx}
              style={{ borderBottomColor: color, opacity: 0.2 }}
              className="my-2 border-b"
            />
          );
        }

        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-');
        const isNumbered = /^\d+\.\s/.test(trimmed);
        const isHeader = trimmed.startsWith('###') || trimmed.startsWith('##') || trimmed.startsWith('#');
        let cleanLine = trimmed.replace(/^#{1,3}\s*/, '');
        if (isBullet) {
          cleanLine = cleanLine.replace(/^[•\-]\s*/, '');
        }

        // Split by **bold** delimiters
        const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);

        return (
          <View
            key={lineIdx}
            className={`flex-row flex-wrap ${isBullet || isNumbered ? 'pl-1' : ''}`}>
            {isBullet && (
              <Text style={{ color }} className="mr-1.5 text-sm font-bold">
                •
              </Text>
            )}
            <Text
              selectable
              style={{
                color,
                fontSize: isHeader ? 14.5 : 13.5,
                fontWeight: isHeader ? '700' : '400',
                lineHeight: isHeader ? 22 : 20,
                flex: 1,
              }}>
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <Text key={pIdx} style={{ fontWeight: '700', color }}>
                      {part.slice(2, -2)}
                    </Text>
                  );
                }
                return part;
              })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Summary Section Card
 */
function SummarySection({
  title,
  icon,
  tint,
  items,
  language,
}: {
  title: string;
  icon: typeof FileText;
  tint: 'blue' | 'purple' | 'green' | 'orange';
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
      {items.slice(0, 3).map(i => {
        const descTrimmed = i.description?.trim() || '';
        const titleTrimmed = i.title?.trim() || '';
        const extraDesc =
          descTrimmed && descTrimmed !== titleTrimmed
            ? descTrimmed.startsWith(titleTrimmed)
              ? descTrimmed.slice(titleTrimmed.length).trim()
              : descTrimmed
            : '';
        return (
          <View key={i.id} style={{ borderTopColor: colors.border }} className="mt-1.5 border-t pt-1.5">
            <Text style={{ color: colors.text }} className="text-sm font-medium">{i.title}</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs">
              {formatDate(i.date, language)}
              {extraDesc ? ` • ${extraDesc}` : ''}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}
