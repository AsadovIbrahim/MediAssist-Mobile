import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { http } from './client';
import { ENV } from './../env.local';

export type AiProvider = 'hybrid' | 'offline' | 'ollama' | 'gemini';

export interface AiConfig {
  provider: AiProvider;
  geminiApiKey: string;
  geminiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
}

export interface AiPatientContext {
  id?: string;
  name: string;
  age?: number | null;
  phone?: string | null;
  note?: string | null;
}

export interface AiRecordItem {
  id: string;
  type: 'complaint' | 'diagnosis' | 'treatment' | 'appointment';
  title: string;
  description?: string | null;
  date: string;
  categoryOrKind?: string | null;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  provider?: AiProvider;
  model?: string;
  timestamp?: number;
}

export interface AskAiOptions {
  patient: AiPatientContext | null;
  records: AiRecordItem[];
  history: AiChatMessage[];
  question: string;
  configOverride?: Partial<AiConfig>;
}

export interface AiResponse {
  text: string;
  provider: AiProvider;
  model: string;
}

const STORAGE_KEYS = {
  PROVIDER: 'mediassist.ai.provider',
  GEMINI_KEY: 'mediassist.ai.gemini_key',
  GEMINI_MODEL: 'mediassist.ai.gemini_model',
  OLLAMA_URL: 'mediassist.ai.ollama_url',
  OLLAMA_MODEL: 'mediassist.ai.ollama_model',
};

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
const DEFAULT_OLLAMA_MODEL = 'llama3.2';

export function getDefaultOllamaUrl(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:11434';
  }
  return 'http://localhost:11434';
}

export async function getAiConfig(): Promise<AiConfig> {
  try {
    const [provider, geminiKey, geminiModel, ollamaUrl, ollamaModel] =
      await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PROVIDER),
        AsyncStorage.getItem(STORAGE_KEYS.GEMINI_KEY),
        AsyncStorage.getItem(STORAGE_KEYS.GEMINI_MODEL),
        AsyncStorage.getItem(STORAGE_KEYS.OLLAMA_URL),
        AsyncStorage.getItem(STORAGE_KEYS.OLLAMA_MODEL),
      ]);

    const envKey = (ENV as any)?.GEMINI_API_KEY || '';
    const resolvedKey = geminiKey || envKey || '';

    // Default to 'hybrid' for seamless online + offline experience
    const resolvedProvider: AiProvider =
      (provider as AiProvider) || 'hybrid';

    return {
      provider: resolvedProvider,
      geminiApiKey: resolvedKey,
      geminiModel: geminiModel || DEFAULT_GEMINI_MODEL,
      ollamaUrl: ollamaUrl || getDefaultOllamaUrl(),
      ollamaModel: ollamaModel || DEFAULT_OLLAMA_MODEL,
    };
  } catch {
    return {
      provider: 'hybrid',
      geminiApiKey: (ENV as any)?.GEMINI_API_KEY || '',
      geminiModel: DEFAULT_GEMINI_MODEL,
      ollamaUrl: getDefaultOllamaUrl(),
      ollamaModel: DEFAULT_OLLAMA_MODEL,
    };
  }
}

export async function saveAiConfig(
  partial: Partial<AiConfig>,
): Promise<AiConfig> {
  const current = await getAiConfig();
  const updated: AiConfig = { ...current, ...partial };

  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.PROVIDER, updated.provider),
    AsyncStorage.setItem(STORAGE_KEYS.GEMINI_KEY, updated.geminiApiKey),
    AsyncStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, updated.geminiModel),
    AsyncStorage.setItem(STORAGE_KEYS.OLLAMA_URL, updated.ollamaUrl),
    AsyncStorage.setItem(STORAGE_KEYS.OLLAMA_MODEL, updated.ollamaModel),
  ]);

  return updated;
}

const SYSTEM_INSTRUCTION = `Sən MediAssist tibbi tətbiqinin ağıllı kliniki Süni İntellekt (AI) köməkçisisən.
Pasiyentə aid təqdim olunan tibbi dosye məlumatları (şikayətlər, qoyulmuş diaqnozlar, təyin edilmiş müalicələr, dərmanlar və qəbul tarixləri) əsasında həkimə (Dr. İbrahim Əsədov) kömək edirsən.

Tələblər:
1. Hər zaman səlis, peşəkar, tibbi terminologiyaya uyğun Azərbaycan dilində cavab ver.
2. Cavabları oxumaq üçün çox rahat et: vacib məqamları qalın (bold) yaz, maddələrlə (• bullet points) siyahıla, qısa və məzmunlu ol.
3. Həkimin sualına birbaşa cavab ver. Şikayətlər, diaqnozlar və müalicələr arasındakı əlaqəni analiz et.
4. Əgər dərman uyğunsuzluğu, əks göstəriş və ya təkrar müayinə zərurəti görsən, bunu mütləq həkimin diqqətinə çatdır.
5. Pasiyentin dosyəsində olmayan faktları uydurma. Məlumat çatışmırsa, həkimə hansı analizlərin tövsiyə oluna biləcəyini qeyd et.`;

function buildClinicalPrompt(
  patient: AiPatientContext | null,
  records: AiRecordItem[],
  question: string,
): string {
  const lines: string[] = [];
  lines.push('=== PASİYENTİN TİBBİ DOSYASI ===');
  if (patient) {
    lines.push(`Ad və Soyad: ${patient.name}`);
    if (patient.age !== null && patient.age !== undefined) {
      lines.push(`Yaşı: ${patient.age}`);
    }
    if (patient.phone) {
      lines.push(`Telefon: ${patient.phone}`);
    }
    if (patient.note) {
      lines.push(`Qeyd: ${patient.note}`);
    }
  } else {
    lines.push('Pasiyent seçilməyib (Ümumi tibbi məsləhət rejimi).');
  }

  const complaints = records.filter(r => r.type === 'complaint');
  const diagnoses = records.filter(r => r.type === 'diagnosis');
  const treatments = records.filter(r => r.type === 'treatment');
  const appointments = records.filter(r => r.type === 'appointment');

  lines.push(`\n--- ŞİKAYƏTLƏR (${complaints.length}) ---`);
  if (!complaints.length) {
    lines.push('Qeydə alınmış şikayət yoxdur.');
  } else {
    complaints.forEach((c, idx) => {
      lines.push(`${idx + 1}. [${c.date}] ${c.title}${c.description ? ` — ${c.description}` : ''}`);
    });
  }

  lines.push(`\n--- DİAQNOZLAR (${diagnoses.length}) ---`);
  if (!diagnoses.length) {
    lines.push('Qeydə alınmış diaqnoz yoxdur.');
  } else {
    diagnoses.forEach((d, idx) => {
      lines.push(`${idx + 1}. [${d.date}] ${d.title}${d.description ? ` — ${d.description}` : ''}`);
    });
  }

  lines.push(`\n--- MÜALİCƏ VƏ DƏRMANLAR (${treatments.length}) ---`);
  if (!treatments.length) {
    lines.push('Qeydə alınmış müalicə yoxdur.');
  } else {
    treatments.forEach((t, idx) => {
      lines.push(`${idx + 1}. [${t.date}] ${t.title}${t.description ? ` — ${t.description}` : ''}`);
    });
  }

  lines.push(`\n--- GÖRÜŞLƏR VƏ TƏQVİM (${appointments.length}) ---`);
  if (!appointments.length) {
    lines.push('Planlaşdırılmış görüş yoxdur.');
  } else {
    appointments.forEach((a, idx) => {
      lines.push(`${idx + 1}. [${a.date}] ${a.title}${a.description ? ` — ${a.description}` : ''}`);
    });
  }

  lines.push(`\n=== HƏKİMİN SUALI / SORĞUSU ===\n${question}`);
  return lines.join('\n');
}

/**
 * Calls our Central MediAssist Server Endpoint (when online)
 */
async function callServerAi(options: AskAiOptions): Promise<{ text: string; model?: string }> {
  const payload = {
    patient: options.patient,
    records: options.records,
    history: options.history.slice(-4).map(h => ({ role: h.role, text: h.text })),
    question: options.question,
  };

  const res = await http.post<{ text: string; model?: string; provider?: string }>('ai/ask', payload);
  if (!res?.text) {
    throw new Error('Server cavab qaytarmadı.');
  }
  return {
    text: res.text,
    model: res.model || 'MediAssist AI (Server)',
  };
}

async function callGemini(
  apiKey: string,
  modelName: string,
  fullPrompt: string,
  history: AiChatMessage[],
): Promise<string> {
  const model = modelName.trim() || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

  const contents: any[] = [];
  const recentHistory = history.slice(-4);
  for (const h of recentHistory) {
    contents.push({
      role: h.role === 'ai' ? 'model' : 'user',
      parts: [{ text: h.text }],
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: fullPrompt }],
  });

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1200,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let msg = `Gemini xətası (${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed?.error?.message) {
        msg = parsed.error.message;
      }
    } catch {}
    throw new Error(msg);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const reply = candidate?.content?.parts?.[0]?.text;

  if (!reply) {
    throw new Error('Gemini cavab yaratmadı.');
  }

  return reply.trim();
}

async function callOllama(
  ollamaUrl: string,
  modelName: string,
  fullPrompt: string,
  history: AiChatMessage[],
): Promise<string> {
  const cleanUrl = (ollamaUrl.trim() || getDefaultOllamaUrl()).replace(/\/+$/, '');
  const model = modelName.trim() || DEFAULT_OLLAMA_MODEL;
  const endpoint = `${cleanUrl}/api/chat`;

  const messages: any[] = [{ role: 'system', content: SYSTEM_INSTRUCTION }];
  const recentHistory = history.slice(-4);
  for (const h of recentHistory) {
    messages.push({
      role: h.role === 'ai' ? 'assistant' : 'user',
      content: h.text,
    });
  }

  messages.push({ role: 'user', content: fullPrompt });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: 0.3,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Ollama serverindən cavab gəlmədi (${response.status}).`);
    }

    const data = await response.json();
    const reply = data?.message?.content || data?.response;
    if (!reply) {
      throw new Error('Ollama modelindən boş cavab alındı.');
    }
    return reply.trim();
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      throw new Error('Ollama cavab vaxtı bitdi (45s). Modelin işlədiyini yoxlayın.');
    }
    throw new Error(
      `Ollama serverinə qoşulmaq mümkün olmadı (${cleanUrl}). Zəhmət olmasa Ollama tətbiqinin işlədiyini və ya IP ünvanını yoxlayın.`,
    );
  }
}

/**
 * Smart Local Clinical Rule Engine
 * Runs 100% offline on the mobile device with zero network dependency.
 * Fully supports Azerbaijani ('az'), Russian ('ru'), and English ('en').
 */
export function runLocalClinicalEngine(
  patient: AiPatientContext | null,
  records: AiRecordItem[],
  question: string,
  language: string = 'az',
): string {
  const q = question.toLowerCase();
  const lang = (language || 'az').toLowerCase();
  const isRu = lang.startsWith('ru');
  const isEn = lang.startsWith('en');

  const defaultPatientName = isRu ? 'Пациент' : isEn ? 'Patient' : 'Pasiyent';
  const patientName = patient?.name || defaultPatientName;

  const complaints = records.filter(r => r.type === 'complaint');
  const diagnoses = records.filter(r => r.type === 'diagnosis');
  const treatments = records.filter(r => r.type === 'treatment');
  const appointments = records.filter(r => r.type === 'appointment');

  const isGreeting =
    q === 'salam' || q.startsWith('salam') ||
    q === 'привет' || q.startsWith('привет') || q.startsWith('здравствуй') ||
    q === 'hello' || q.startsWith('hello') || q.startsWith('hi');

  if (isGreeting) {
    if (isRu) {
      return `👋 **Здравствуйте! Я клинический ассистент MediAssist.**\n\nДля пациента **${patientName}** я могу:\n• Обобщить последние жалобы и симптомы\n• Проверить активный план лечения и дозировки препаратов\n• Проанализировать установленные диагнозы\n• Оценить общее клиническое состояние и дать рекомендации\n\nВы можете нажать на одну из кнопок выше или написать свой вопрос.`;
    }
    if (isEn) {
      return `👋 **Hello! I am your MediAssist clinical AI assistant.**\n\nFor **${patientName}**, I can:\n• Summarize recent complaints and symptoms\n• Review the active treatment and medication regimen\n• Analyze confirmed diagnoses\n• Provide an overall clinical evaluation and recommendations\n\nFeel free to tap any of the quick action buttons above or type your question.`;
    }
    return `👋 **Salam! Mən MediAssist kliniki süni intellekt köməkçisiyəm.**\n\n**${patientName}** üçün:\n• Son şikayətləri xülasə edə,\n• Aktiv müalicə və dərman rejimini yoxlaya,\n• Qoyulmuş diaqnozları təhlil edə,\n• Ümumi kliniki vəziyyəti qiymətləndirib tövsiyələr verə bilərəm.\n\nYuxarıdakı hazır düymələrdən birinə toxuna və ya sualınızı yaza bilərsiniz.`;
  }

  const isComplaintQuery =
    q.includes('şikayət') || q.includes('simptom') || q.includes('ağrı') ||
    q.includes('жалоб') || q.includes('симптом') || q.includes('боль') || q.includes('болит') ||
    q.includes('complaint') || q.includes('symptom') || q.includes('pain') || q.includes('ache');

  const isTreatmentQuery =
    q.includes('müalicə') || q.includes('dərman') || q.includes('resept') || q.includes('plan') ||
    q.includes('лечени') || q.includes('лекарств') || q.includes('рецепт') || q.includes('препарат') || q.includes('таблетк') ||
    q.includes('treatment') || q.includes('medication') || q.includes('medicine') || q.includes('prescription') || q.includes('drug');

  const isDiagnosisQuery =
    q.includes('diaqnoz') || q.includes('nəticə') || q.includes('analiz') ||
    q.includes('диагноз') || q.includes('результат') || q.includes('анализ') || q.includes('заключени') ||
    q.includes('diagnosis') || q.includes('result') || q.includes('finding') || q.includes('test');

  const isCalendarQuery =
    q.includes('görüş') || q.includes('təqvim') || q.includes('qəbul') ||
    q.includes('прием') || q.includes('визит') || q.includes('запис') || q.includes('календар') ||
    q.includes('appointment') || q.includes('visit') || q.includes('schedule') || q.includes('calendar');

  if (isComplaintQuery) {
    if (!complaints.length) {
      if (isRu) {
        return `📋 Для пациента **${patientName}** жалоб пока не зарегистрировано.\n\n• Вы можете внести текущие симптомы и жалобы пациента в медицинскую карту.`;
      }
      if (isEn) {
        return `📋 No complaints have been recorded for **${patientName}** yet.\n\n• You can record current symptoms and patient concerns in the medical file.`;
      }
      return `📋 **${patientName}** üçün hələ heç bir şikayət qeydə alınmayıb.\n\n• Pasiyentdən hazırkı vəziyyəti və narahatlıqları barədə məlumat alıb qeydlərə əlavə edə bilərsiniz.`;
    }

    const list = complaints
      .map((c, i) => {
        if (isRu) {
          return `**${i + 1}. ${c.title}** (${c.date})\n${c.description ? `   • Симптомы: ${c.description}` : '   • Дополнительного описания нет.'}`;
        }
        if (isEn) {
          return `**${i + 1}. ${c.title}** (${c.date})\n${c.description ? `   • Symptoms: ${c.description}` : '   • No additional description.'}`;
        }
        return `**${i + 1}. ${c.title}** (${c.date})\n${c.description ? `   • Əlamətlər: ${c.description}` : '   • Əlavə təsvir yoxdur.'}`;
      })
      .join('\n\n');

    if (isRu) {
      return `🩺 **Клиническое резюме жалоб пациента:**\n\n${list}\n\n💡 **Клиническая заметка:** Рекомендуется отслеживать динамику жалоб и сопоставлять их с данными обследований.`;
    }
    if (isEn) {
      return `🩺 **Patient Complaints Clinical Summary:**\n\n${list}\n\n💡 **Clinical Note:** It is recommended to monitor symptom dynamics and correlation with diagnostic findings.`;
    }
    return `🩺 **Pasiyentin Şikayətlər Xülasəsi:**\n\n${list}\n\n💡 **Kliniki Qeyd:** Şikayətlərin inkişaf dinamikasını izləmək və diaqnozla uyğunluğunu yoxlamaq tövsiyə olunur.`;
  }

  if (isTreatmentQuery) {
    if (!treatments.length) {
      if (isRu) {
        return `💊 Для пациента **${patientName}** активных планов лечения или назначений не найдено.\n\n• Вы можете составить новый план лечения или рецепт в соответствии с диагнозом.`;
      }
      if (isEn) {
        return `💊 No active treatment plans or prescriptions found for **${patientName}**.\n\n• You can create a treatment plan or prescription based on diagnosis.`;
      }
      return `💊 **${patientName}** üçün hazırda aktiv müalicə və ya dərman təyinatı yoxdur.\n\n• Diaqnoza uyğun olaraq yeni müalicə planı və ya resept tərtib edə bilərsiniz.`;
    }

    const list = treatments
      .map((t, i) => {
        if (isRu) {
          return `**${i + 1}. ${t.title}** (${t.date})\n${t.description ? `   • Дозировка / Режим: ${t.description}` : '   • Дополнительных указаний нет.'}`;
        }
        if (isEn) {
          return `**${i + 1}. ${t.title}** (${t.date})\n${t.description ? `   • Dosage / Regimen: ${t.description}` : '   • No additional instructions noted.'}`;
        }
        return `**${i + 1}. ${t.title}** (${t.date})\n${t.description ? `   • Doza / Qəbul qaydası: ${t.description}` : '   • Əlavə təlimat qeyd edilməyib.'}`;
      })
      .join('\n\n');

    if (isRu) {
      return `💊 **Активный план лечения и назначений:**\n\n${list}\n\n⚠️ **Рекомендация:** Уточните у пациента соблюдение режима приема препаратов и переносимость.`;
    }
    if (isEn) {
      return `💊 **Active Treatment and Prescriptions Plan:**\n\n${list}\n\n⚠️ **Recommendation:** Verify medication adherence and monitor for potential adverse effects.`;
    }
    return `💊 **Aktiv Müalicə və Təyinat Planı:**\n\n${list}\n\n⚠️ **Tövsiyə:** Dərmanların qəbul rejimini və mümkün yanaşı təsirlərini pasiyentlə dəqiqləşdirmək faydalı olar.`;
  }

  if (isDiagnosisQuery) {
    if (!diagnoses.length) {
      if (isRu) {
        return `🔬 Для пациента **${patientName}** подтвержденных диагнозов пока нет.\n\n• Можно установить предварительный диагноз на основе симптомов и лабораторных данных.`;
      }
      if (isEn) {
        return `🔬 No confirmed diagnosis records found for **${patientName}**.\n\n• Preliminary diagnoses can be assigned following laboratory and clinical evaluations.`;
      }
      return `🔬 **${patientName}** üçün təsdiqlənmiş diaqnoz qeydi tapılmadı.\n\n• Əlamətlər və instrumental/laborator müayinələr əsasında ilkin diaqnoz təyin edilə bilər.`;
    }

    const list = diagnoses
      .map((d, i) => {
        if (isRu) {
          return `**${i + 1}. ${d.title}** (${d.date})\n${d.description ? `   • Описание / Заметки: ${d.description}` : ''}`;
        }
        if (isEn) {
          return `**${i + 1}. ${d.title}** (${d.date})\n${d.description ? `   • Notes / Findings: ${d.description}` : ''}`;
        }
        return `**${i + 1}. ${d.title}** (${d.date})\n${d.description ? `   • Təsvir / Qeyd: ${d.description}` : ''}`;
      })
      .join('\n\n');

    if (isRu) {
      return `🔬 **Результаты установленных диагнозов:**\n\n${list}\n\n📌 **Наблюдение:** Контролируйте течение заболевания и терапевтический ответ на лечение.`;
    }
    if (isEn) {
      return `🔬 **Confirmed Diagnosis Findings:**\n\n${list}\n\n📌 **Observation:** Track disease progression and therapeutic response.`;
    }
    return `🔬 **Təsdiqlənmiş Diaqnoz Nəticələri:**\n\n${list}\n\n📌 **Müşahidə:** Diaqnozun dinamikası və müalicəyə cavab reaksiyası nəzarətdə saxlanılmalıdır.`;
  }

  if (isCalendarQuery) {
    if (!appointments.length) {
      if (isRu) {
        return `📅 Для пациента **${patientName}** запланированных приемов нет.\n\n• Вы можете назначить контрольный визит или консультацию в календаре.`;
      }
      if (isEn) {
        return `📅 No upcoming visits or appointments scheduled for **${patientName}**.\n\n• You can schedule a follow-up or review in the calendar section.`;
      }
      return `📅 **${patientName}** üçün planlaşdırılmış qəbul və ya görüş yoxdur.\n\n• Təqvim bölməsindən təkrar baxış və ya nəzarət müayinəsi təyin edə bilərsiniz.`;
    }

    const list = appointments
      .map((a, i) => `**${i + 1}. ${a.title}** — ${a.date}${a.description ? ` (${a.description})` : ''}`)
      .join('\n');

    if (isRu) {
      return `📅 **Запланированные визиты и приемы:**\n\n${list}`;
    }
    if (isEn) {
      return `📅 **Scheduled Appointments:**\n\n${list}`;
    }
    return `📅 **Planlaşdırılmış Qəbullar:**\n\n${list}`;
  }

  // General Comprehensive Clinical Summary
  if (isRu) {
    const lines: string[] = [
      `👨‍⚕️ **${patientName} — Общий клинический анализ состояния:**`,
      '',
      `• **Жалобы:** ${complaints.length > 0 ? `${complaints.length} зап. (${complaints.map(c => c.title).slice(0, 2).join(', ')})` : 'Записей нет'}`,
      `• **Диагнозы:** ${diagnoses.length > 0 ? diagnoses.map(d => d.title).join(', ') : 'Не установлены'}`,
      `• **Лечение:** ${treatments.length > 0 ? treatments.map(t => t.title).join(', ') : 'Не назначено'}`,
      `• **Визиты:** ${appointments.length > 0 ? `${appointments[0].title} (${appointments[0].date})` : 'Не запланированы'}`,
      '',
      '📌 **Клинические рекомендации:**',
    ];

    if (!diagnoses.length && complaints.length > 0) {
      lines.push('1. Назначение первичных лабораторно-диагностических исследований по текущим жалобам.');
    }
    if (diagnoses.length > 0 && !treatments.length) {
      lines.push('2. Начало фармакологического или физиотерапевтического протокола согласно диагнозу.');
    }
    if (!appointments.length) {
      lines.push('3. Внесение даты контрольного приема в календарь для оценки эффективности терапии.');
    }
    if (lines.length <= 8) {
      lines.push('1. Контроль текущего режима и общего самочувствия пациента.');
      lines.push('2. Плановый осмотр и лабораторный контроль при необходимости.');
    }
    return lines.join('\n');
  }

  if (isEn) {
    const lines: string[] = [
      `👨‍⚕️ **${patientName} — General Clinical Assessment:**`,
      '',
      `• **Complaints:** ${complaints.length > 0 ? `${complaints.length} records (${complaints.map(c => c.title).slice(0, 2).join(', ')})` : 'None recorded'}`,
      `• **Diagnoses:** ${diagnoses.length > 0 ? diagnoses.map(d => d.title).join(', ') : 'None assigned'}`,
      `• **Treatments:** ${treatments.length > 0 ? treatments.map(t => t.title).join(', ') : 'None prescribed'}`,
      `• **Appointments:** ${appointments.length > 0 ? `${appointments[0].title} (${appointments[0].date})` : 'None scheduled'}`,
      '',
      '📌 **Clinical Recommendations:**',
    ];

    if (!diagnoses.length && complaints.length > 0) {
      lines.push('1. Schedule primary diagnostic and laboratory tests matching current complaints.');
    }
    if (diagnoses.length > 0 && !treatments.length) {
      lines.push('2. Initiate pharmacological or physical therapy protocol appropriate for the diagnosis.');
    }
    if (!appointments.length) {
      lines.push('3. Record a follow-up visit in the calendar to assess treatment efficacy.');
    }
    if (lines.length <= 8) {
      lines.push('1. Monitor current lifestyle and patient adherence.');
      lines.push('2. Routine follow-up review as needed.');
    }
    return lines.join('\n');
  }

  // Azerbaijani (Default)
  const lines: string[] = [
    `👨‍⚕️ **${patientName} — Tibbi Vəziyyətin Ümumi Analizi:**`,
    '',
    `• **Şikayətlər:** ${complaints.length > 0 ? `${complaints.length} qeyd (${complaints.map(c => c.title).slice(0, 2).join(', ')})` : 'Qeyd yoxdur'}`,
    `• **Diaqnozlar:** ${diagnoses.length > 0 ? diagnoses.map(d => d.title).join(', ') : 'Qoyulmayıb'}`,
    `• **Müalicə:** ${treatments.length > 0 ? treatments.map(t => t.title).join(', ') : 'Təyin edilməyib'}`,
    `• **Görüşlər:** ${appointments.length > 0 ? `${appointments[0].title} (${appointments[0].date})` : 'Təyin edilməyib'}`,
    '',
    '📌 **Kliniki Tövsiyələr:**',
  ];

  if (!diagnoses.length && complaints.length > 0) {
    lines.push('1. Mövcud şikayətlərə əsasən ilkin laborator-diaqnostik müayinələrin aparılması.');
  }
  if (diagnoses.length > 0 && !treatments.length) {
    lines.push('2. Təyin olunmuş diaqnoza uyğun farmakoloji və ya fizioterapevtik müalicə protokolunun başlanması.');
  }
  if (!appointments.length) {
    lines.push('3. Müalicənin effektivliyini qiymətləndirmək üçün təkrar qəbul tarixinin təqvimdə qeyd edilməsi.');
  }
  if (lines.length <= 8) {
    lines.push('1. Pasiyentin cari rejimini və həyat tərzini nəzarətdə saxlamaq.');
    lines.push('2. Zəruri hallarda planlı təkrar müayinə təyin etmək.');
  }

  return lines.join('\n');
}

export async function askAi(options: AskAiOptions): Promise<AiResponse> {
  const config = await getAiConfig();
  const activeConfig: AiConfig = { ...config, ...options.configOverride };

  // 1. HYBRID (Standard Mode: Online Server Model, falls back automatically to Offline)
  if (activeConfig.provider === 'hybrid') {
    try {
      const serverRes = await callServerAi(options);
      return {
        text: serverRes.text,
        provider: 'hybrid',
        model: serverRes.model || 'MediAssist AI (Online)',
      };
    } catch {
      // Automatic and instant fallback to offline clinical engine
      const localText = runLocalClinicalEngine(
        options.patient,
        options.records,
        options.question,
      );
      return {
        text: localText,
        provider: 'offline',
        model: 'MediAssist AI (Oflayn)',
      };
    }
  }

  // 2. OFFLINE ONLY (100% on device)
  if (activeConfig.provider === 'offline') {
    const localText = runLocalClinicalEngine(
      options.patient,
      options.records,
      options.question,
    );
    return {
      text: localText,
      provider: 'offline',
      model: 'MediAssist AI (Oflayn)',
    };
  }

  const clinicalPrompt = buildClinicalPrompt(
    options.patient,
    options.records,
    options.question,
  );

  // 3. GOOGLE GEMINI (Cloud API)
  if (activeConfig.provider === 'gemini') {
    if (activeConfig.geminiApiKey) {
      try {
        const text = await callGemini(
          activeConfig.geminiApiKey,
          activeConfig.geminiModel,
          clinicalPrompt,
          options.history,
        );
        return {
          text,
          provider: 'gemini',
          model: activeConfig.geminiModel,
        };
      } catch (err: any) {
        const localSummary = runLocalClinicalEngine(
          options.patient,
          options.records,
          options.question,
        );
        return {
          text: `⚠️ **Gemini ilə əlaqə xətası:** ${err?.message || 'Serverə qoşulmaq olmadı.'}\n\n*Məlumat daxili kliniki analizator tərəfindən hazırlandı:*\n\n---\n\n${localSummary}`,
          provider: 'offline',
          model: 'Daxili Analizator (Ehtiyat)',
        };
      }
    } else {
      const localSummary = runLocalClinicalEngine(
        options.patient,
        options.records,
        options.question,
      );
      return {
        text: `${localSummary}\n\n*(Məlumat daxili kliniki analizator tərəfindən hazırlandı. Yuxarıdakı tənzimləmələrdən pulsuz Google Gemini API açarı daxil edərək generativ AI rejimini aktivləşdirə bilərsiniz).*`,
        provider: 'offline',
        model: 'Daxili Analizator',
      };
    }
  }

  // 4. OLLAMA (Custom Local Developer Model)
  if (activeConfig.provider === 'ollama') {
    try {
      const text = await callOllama(
        activeConfig.ollamaUrl,
        activeConfig.ollamaModel,
        clinicalPrompt,
        options.history,
      );
      return {
        text,
        provider: 'ollama',
        model: activeConfig.ollamaModel,
      };
    } catch (err: any) {
      const localSummary = runLocalClinicalEngine(
        options.patient,
        options.records,
        options.question,
      );
      return {
        text: `🖥️ **Ollama serverinə qoşulmaq olmadı** (${activeConfig.ollamaUrl}).\n\n*Kompüterinizdə Ollama işləyənə qədər cavab daxili kliniki analizator tərəfindən təqdim edilir:*\n\n---\n\n${localSummary}`,
        provider: 'offline',
        model: 'Daxili Analizator (Ehtiyat)',
      };
    }
  }

  // Final fallback
  const fallbackText = runLocalClinicalEngine(
    options.patient,
    options.records,
    options.question,
  );
  return {
    text: fallbackText,
    provider: 'offline',
    model: 'MediAssist AI (Oflayn)',
  };
}
