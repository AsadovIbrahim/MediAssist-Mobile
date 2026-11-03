import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertCircle,
  Brain,
  Check,
  Eye,
  EyeOff,
  FileText,
  Pill,
  RotateCcw,
  Send,
  Server,
  Settings,
  Sparkles,
  Stethoscope,
} from 'lucide-react-native';
import { Card, IconTile, KeyboardLiftView, Loading, ScreenHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { patientFullName, usePatient } from '../context/PatientContext';
import { useTheme } from '../context/ThemeContext';
import { RECORDS, type RecordItem } from '../features/records';
import { appointmentsApi } from '../api/services';
import type { Appointment } from '../api/types';
import {
  askAi,
  getAiConfig,
  getDefaultOllamaUrl,
  saveAiConfig,
  type AiChatMessage,
  type AiConfig,
  type AiProvider,
  type AiRecordItem,
} from '../api/ai';
import { formatDate } from '../utils/format';
import { useFocusData } from '../utils/hooks';

type ScrollNode = React.ComponentRef<typeof ScrollView>;

export function AiScreen() {
  const { language, t } = useLanguage();
  const { patient } = usePatient();
  const { colors } = useTheme();

  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    provider: 'hybrid',
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-flash',
    ollamaUrl: getDefaultOllamaUrl(),
    ollamaModel: 'llama3.2',
  });

  const scrollRef = useRef<ScrollNode>(null);

  // Load persistent AI configuration on mount
  useEffect(() => {
    (async () => {
      const cfg = await getAiConfig();
      setAiConfig(cfg);
    })();
  }, []);

  // Fetch patient records and appointments
  const { data, loading } = useFocusData(async () => {
    if (!patient) {
      return null;
    }
    const [complaints, diagnoses, treatments, appointments] = await Promise.all([
      RECORDS.complaint.api.list(patient.id).catch(() => [] as RecordItem[]),
      RECORDS.diagnosis.api.list(patient.id).catch(() => [] as RecordItem[]),
      RECORDS.treatment.api.list(patient.id).catch(() => [] as RecordItem[]),
      appointmentsApi.list(patient.id).catch(() => [] as Appointment[]),
    ]);
    return { complaints, diagnoses, treatments, appointments };
  }, [patient?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const handleSend = async (customPrompt?: string) => {
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

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setQuestion('');
    setThinking(true);
    scrollToBottom();

    const complaints: RecordItem[] = data?.complaints ?? [];
    const diagnoses: RecordItem[] = data?.diagnoses ?? [];
    const treatments: RecordItem[] = data?.treatments ?? [];
    const appointments: Appointment[] = data?.appointments ?? [];

    // Convert loaded records into standard AI context items
    const recordsPayload: AiRecordItem[] = [
      ...complaints.map(c => ({
        id: c.id,
        type: 'complaint' as const,
        title: c.title,
        description: c.description,
        date: formatDate(c.date, language),
        categoryOrKind: c.kind,
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

    try {
      const response = await askAi({
        patient: patient
          ? {
              id: patient.id,
              name: patientFullName(patient),
              age: patient.age,
              phone: patient.phone,
              note: patient.note,
            }
          : null,
        records: recordsPayload,
        history: messages,
        question: promptText,
      });

      const aiMsg: AiChatMessage = {
        id: `${Date.now()}-ai`,
        role: 'ai',
        text: response.text,
        provider: response.provider,
        model: response.model,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errorText =
        err?.message || 'AI ilə əlaqə zamanı gözlənilməz xəta baş verdi.';

      const isKeyMissing = errorText.includes('GEMINI_KEY_MISSING');
      const isConnectionIssue =
        errorText.includes('Ollama serverinə') || errorText.includes('Ollama xətası');

      let userFriendlyText = `⚠️ **Xəta baş verdi:**\n\n${errorText}`;
      if (isKeyMissing) {
        userFriendlyText =
          '🔑 **Google Gemini API açarı daxil edilməyib.**\n\nYuxarıdakı **Tənzimləmələr** düyməsinə toxunaraq Google AI Studio-dan pulsuz API açarınızı daxil edin və ya **Öz Modelimiz (Ollama)** rejimini seçin.';
      } else if (isConnectionIssue) {
        userFriendlyText =
          '🖥️ **Ollama serverinə qoşulmaq olmadı.**\n\nKompüterinizdə Ollama proqramının işlədiyinə və URL ünvanının (məsələn, eyni Wi-Fi üçün kompyuterinizin IP-si) düzgün qeyd olunduğuna əmin olun.';
      }

      const errorMsg: AiChatMessage = {
        id: `${Date.now()}-err`,
        role: 'ai',
        text: userFriendlyText,
        provider: 'offline',
        model: 'Sistem Xətası',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setThinking(false);
      scrollToBottom();
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      t('ai.clearChat'),
      'Bütün söhbət tarixçəsi təmizlənsin?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => setMessages([]),
        },
      ],
    );
  };

  const activeProviderLabel =
    aiConfig.provider === 'hybrid'
      ? 'Hibrid AI'
      : aiConfig.provider === 'offline'
      ? 'Daxili AI'
      : aiConfig.provider === 'ollama'
      ? `Ollama (${aiConfig.ollamaModel})`
      : 'Gemini 1.5';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: colors.background }} className="flex-1">
      <ScreenHeader
        title={t('ai.screenTitle')}
        right={
          <View className="flex-row items-center gap-1.5">
            {messages.length > 0 && (
              <Pressable
                onPress={handleClearChat}
                hitSlop={10}
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="h-10 w-10 items-center justify-center rounded-2xl border active:opacity-70 shadow-sm">
                <RotateCcw size={18} color={colors.textMuted} />
              </Pressable>
            )}
            <Pressable
              onPress={() => setSettingsOpen(true)}
              hitSlop={10}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="h-10 flex-row items-center rounded-2xl border px-3 active:opacity-70 shadow-sm">
              {aiConfig.provider === 'hybrid' ? (
                <Sparkles size={16} color={colors.primary} />
              ) : aiConfig.provider === 'offline' ? (
                <Brain size={16} color="#8B5CF6" />
              ) : aiConfig.provider === 'ollama' ? (
                <Server size={16} color="#10B981" />
              ) : (
                <Sparkles size={16} color={colors.primary} />
              )}
              <Text
                style={{ color: colors.text }}
                className="ml-1.5 text-xs font-semibold"
                numberOfLines={1}>
                {activeProviderLabel}
              </Text>
              <Settings size={14} color={colors.textMuted} className="ml-1.5" />
            </Pressable>
          </View>
        }
      />

      <KeyboardLiftView>
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
                  <View className="flex-row items-center">
                    <Text style={{ color: colors.text }} className="text-base font-bold">
                      {t('ai.cardTitle')}
                    </Text>
                    <View
                      style={{ backgroundColor: colors.primarySoft }}
                      className="ml-2 rounded-full px-2 py-0.5">
                      <Text style={{ color: colors.primary }} className="text-[10px] font-bold">
                        100% PULSUZ AI
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.textMuted }} className="mt-0.5 text-xs">
                    {patientFullName(patient) || t('ai.notSelected')}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.textMuted }} className="mt-3 text-sm leading-5">
                {`${patientFullName(patient) || t('ai.notSelected')} (${data?.complaints.length ?? 0} ${t('record.complaints').toLowerCase()}, ${data?.diagnoses.length ?? 0} ${t('record.diagnoses').toLowerCase()}, ${data?.treatments.length ?? 0} ${t('record.treatments').toLowerCase()}${data?.appointments?.length ? `, ${data.appointments.length} görüş` : ''})`}
              </Text>

              {/* Quick AI Action Prompt Chips */}
              <View className="mt-3 flex-row flex-wrap gap-2">
                {[
                  { text: t('ai.prompt1') },
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
                  <View className="mb-2 flex-row items-center justify-between border-b pb-2" style={{ borderBottomColor: colors.border }}>
                    <View className="flex-row items-center">
                      <Sparkles size={14} color={colors.primary} />
                      <Text style={{ color: colors.primary }} className="ml-1.5 text-xs font-bold">
                        MediAssist AI
                      </Text>
                    </View>
                    {m.model && (
                      <View
                        style={{ backgroundColor: colors.field }}
                        className="rounded-full px-2 py-0.5">
                        <Text style={{ color: colors.textMuted }} className="text-[10px] font-medium">
                          {m.model}
                        </Text>
                      </View>
                    )}
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
          style={{ backgroundColor: colors.surface, borderTopColor: colors.border }}
          className="flex-row items-center border-t px-4 py-2.5">
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

      {/* AI Settings Modal */}
      <AiSettingsModal
        visible={settingsOpen}
        config={aiConfig}
        onClose={() => setSettingsOpen(false)}
        onSave={updated => {
          setAiConfig(updated);
          setSettingsOpen(false);
        }}
      />
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

/**
 * AI Configuration Modal
 * Lets the doctor choose between Google Gemini (Free Tier) or Ollama (Self-Hosted Model),
 * set the API Key or Host URL, with zero recurring costs.
 */
function AiSettingsModal({
  visible,
  config,
  onClose,
  onSave,
}: {
  visible: boolean;
  config: AiConfig;
  onClose: () => void;
  onSave: (updated: AiConfig) => void;
}) {
  const { colors } = useTheme();
  const [provider, setProvider] = useState<AiProvider>(config.provider);
  const [geminiKey, setGeminiKey] = useState(config.geminiApiKey);
  const [geminiModel, setGeminiModel] = useState(config.geminiModel);
  const [ollamaUrl, setOllamaUrl] = useState(config.ollamaUrl);
  const [ollamaModel, setOllamaModel] = useState(config.ollamaModel);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setProvider(config.provider);
    setGeminiKey(config.geminiApiKey);
    setGeminiModel(config.geminiModel);
    setOllamaUrl(config.ollamaUrl);
    setOllamaModel(config.ollamaModel);
  }, [config, visible]);

  const handleSave = async () => {
    const updated = await saveAiConfig({
      provider,
      geminiApiKey: geminiKey.trim(),
      geminiModel: geminiModel.trim(),
      ollamaUrl: ollamaUrl.trim(),
      ollamaModel: ollamaModel.trim(),
    });
    onSave(updated);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-4">
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="w-full max-w-lg rounded-3xl border p-5 shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3">
            <View className="flex-row items-center">
              <View
                style={{ backgroundColor: colors.primarySoft }}
                className="h-9 w-9 items-center justify-center rounded-xl">
                <Sparkles size={18} color={colors.primary} />
              </View>
              <View className="ml-2.5">
                <Text style={{ color: colors.text }} className="text-base font-bold">
                  AI Model Tənzimləmələri
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-xs">
                  Pulsuz və ya Şəxsi Model seçimi
                </Text>
              </View>
            </View>
          </View>

          <ScrollView className="max-h-[460px] pt-1">
            {/* Provider Selection Tabs */}
            <Text style={{ color: colors.textMuted }} className="mb-2 text-xs font-bold uppercase tracking-wider">
              AI Mühərriki
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {[
                { id: 'hybrid' as const, label: 'Hibrid AI', sub: 'Online + Oflayn', icon: Sparkles },
                { id: 'offline' as const, label: 'Daxili Analiz', sub: 'İnternetsiz', icon: Brain },
                { id: 'ollama' as const, label: 'Lokal Ollama', sub: 'Kompüterdə', icon: Server },
                { id: 'gemini' as const, label: 'Google Gemini', sub: '100% Pulsuz', icon: Sparkles },
              ].map(opt => {
                const isSelected = provider === opt.id;
                const IconComp = opt.icon;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setProvider(opt.id)}
                    style={{
                      backgroundColor: isSelected ? colors.primarySoft : colors.field,
                      borderColor: isSelected ? colors.primary : colors.border,
                      width: '48%',
                    }}
                    className="items-center rounded-2xl border p-2.5 active:opacity-75">
                    <IconComp
                      size={18}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                    <Text
                      style={{ color: isSelected ? colors.primary : colors.text }}
                      className="mt-1 text-center text-xs font-bold">
                      {opt.label}
                    </Text>
                    <Text
                      style={{ color: isSelected ? colors.primary : colors.textMuted }}
                      className="text-[10px]">
                      {opt.sub}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Provider: Hybrid (Recommended Default) */}
            {provider === 'hybrid' && (
              <View
                style={{ backgroundColor: colors.field }}
                className="rounded-2xl p-4">
                <View className="flex-row items-center">
                  <Sparkles size={18} color={colors.primary} />
                  <Text style={{ color: colors.text }} className="ml-2 text-sm font-bold">
                    Hibrid AI Rejimi (Tövsiyə olunur)
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted }} className="mt-2 text-xs leading-5">
                  Tətbiq internet olduqda mərkəzi serverimizdəki modeldən cavab alır. İnternet kəsildikdə və ya zəif olduqda isə avtomatik olaraq daxili oflayn modelə keçir. Həkimin heç bir IP və ya xüsusi açar daxil etməsinə ehtiyac yoxdur.
                </Text>
              </View>
            )}

            {/* Provider: Google Gemini */}
            {provider === 'gemini' && (
              <View className="space-y-3">
                <View
                  style={{ backgroundColor: colors.field }}
                  className="rounded-2xl p-3">
                  <View className="flex-row items-center">
                    <AlertCircle size={15} color={colors.primary} />
                    <Text style={{ color: colors.text }} className="ml-1.5 text-xs font-bold">
                      Google AI Studio Free Tier
                    </Text>
                  </View>
                  <Text style={{ color: colors.textMuted }} className="mt-1 text-xs leading-4">
                    Google Gemini 1.5 Flash gündə 1,500 sorğuya qədər tamamilə pulsuzdur. Bank kartı tələb olunmur.
                  </Text>
                </View>

                <View>
                  <Text style={{ color: colors.text }} className="mb-1 text-xs font-semibold">
                    Gemini API Açarınız:
                  </Text>
                  <View
                    style={{ backgroundColor: colors.field, borderColor: colors.border }}
                    className="flex-row items-center rounded-xl border px-3">
                    <TextInput
                      value={geminiKey}
                      onChangeText={setGeminiKey}
                      placeholder="AIzaSy..."
                      placeholderTextColor={colors.textLight}
                      secureTextEntry={!showKey}
                      style={{ color: colors.text }}
                      className="flex-1 py-2 text-sm"
                    />
                    <Pressable onPress={() => setShowKey(!showKey)} hitSlop={10}>
                      {showKey ? (
                        <EyeOff size={16} color={colors.textMuted} />
                      ) : (
                        <Eye size={16} color={colors.textMuted} />
                      )}
                    </Pressable>
                  </View>
                  <Text style={{ color: colors.textLight }} className="mt-1 text-[11px]">
                    Açarı aistudio.google.com/app/apikey səhifəsindən ala bilərsiniz.
                  </Text>
                </View>

                <View>
                  <Text style={{ color: colors.text }} className="mb-1 text-xs font-semibold">
                    Model:
                  </Text>
                  <View className="flex-row gap-2">
                    {['gemini-1.5-flash', 'gemini-2.0-flash'].map(m => (
                      <Pressable
                        key={m}
                        onPress={() => setGeminiModel(m)}
                        style={{
                          backgroundColor:
                            geminiModel === m ? colors.primarySoft : colors.field,
                          borderColor:
                            geminiModel === m ? colors.primary : colors.border,
                        }}
                        className="flex-1 rounded-xl border py-2 active:opacity-75">
                        <Text
                          style={{
                            color:
                              geminiModel === m ? colors.primary : colors.text,
                          }}
                          className="text-center text-xs font-semibold">
                          {m}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Provider: Ollama / Self-Hosted */}
            {provider === 'ollama' && (
              <View className="space-y-3">
                <View
                  style={{ backgroundColor: colors.field }}
                  className="rounded-2xl p-3">
                  <View className="flex-row items-center">
                    <Server size={15} color="#10B981" />
                    <Text style={{ color: colors.text }} className="ml-1.5 text-xs font-bold">
                      Öz Modeliniz (Lokal / Şəxsi Server)
                    </Text>
                  </View>
                  <Text style={{ color: colors.textMuted }} className="mt-1 text-xs leading-4">
                    Kompüterinizdə Ollama (Llama 3.2, Mistral, DeepSeek) quraşdırıb heç bir üçüncü tərəfə məlumat ötürmədən tam oflayn və pulsuz istifadə edə bilərsiniz.
                  </Text>
                </View>

                <View>
                  <Text style={{ color: colors.text }} className="mb-1 text-xs font-semibold">
                    Ollama Server URL:
                  </Text>
                  <TextInput
                    value={ollamaUrl}
                    onChangeText={setOllamaUrl}
                    placeholder="http://192.168.1.100:11434"
                    placeholderTextColor={colors.textLight}
                    style={{ backgroundColor: colors.field, borderColor: colors.border, color: colors.text }}
                    className="rounded-xl border px-3 py-2 text-sm"
                  />
                  <Text style={{ color: colors.textLight }} className="mt-1 text-[11px]">
                    Android Emulator üçün: http://10.0.2.2:11434, Wi-Fi üçün kompüterinizin yerli IP-si.
                  </Text>
                </View>

                <View>
                  <Text style={{ color: colors.text }} className="mb-1 text-xs font-semibold">
                    Model Adı:
                  </Text>
                  <TextInput
                    value={ollamaModel}
                    onChangeText={setOllamaModel}
                    placeholder="llama3.2"
                    placeholderTextColor={colors.textLight}
                    style={{ backgroundColor: colors.field, borderColor: colors.border, color: colors.text }}
                    className="rounded-xl border px-3 py-2 text-sm"
                  />
                  <View className="mt-1.5 flex-row gap-1.5">
                    {['llama3.2', 'mistral', 'qwen2.5'].map(name => (
                      <Pressable
                        key={name}
                        onPress={() => setOllamaModel(name)}
                        style={{ backgroundColor: colors.field }}
                        className="rounded-lg px-2.5 py-1">
                        <Text style={{ color: colors.primary }} className="text-[11px] font-semibold">
                          {name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Provider: Offline / Built-in Clinical Analyzer */}
            {provider === 'offline' && (
              <View
                style={{ backgroundColor: colors.field }}
                className="rounded-2xl p-4">
                <View className="flex-row items-center">
                  <Brain size={18} color="#8B5CF6" />
                  <Text style={{ color: colors.text }} className="ml-2 text-sm font-bold">
                    Daxili Kliniki Analizator
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted }} className="mt-2 text-xs leading-5">
                  Heç bir internet bağlantısı, API açarı və ya server tələb olunmur. Pasiyentin şikayətlərini, diaqnozlarını və dərmanlarını daxili tibbi qaydalar sistemi ilə dərhal təhlil edir.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View className="mt-4 flex-row gap-2 border-t pt-3" style={{ borderTopColor: colors.border }}>
            <Pressable
              onPress={onClose}
              style={{ backgroundColor: colors.field }}
              className="flex-1 items-center justify-center rounded-xl py-3 active:opacity-75">
              <Text style={{ color: colors.textMuted }} className="text-sm font-semibold">
                Ləğv et
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={{ backgroundColor: colors.primary }}
              className="flex-1 flex-row items-center justify-center rounded-xl py-3 active:opacity-85 shadow-md">
              <Check size={16} color="#fff" />
              <Text className="ml-1.5 text-sm font-bold text-white">
                Yadda saxla
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
